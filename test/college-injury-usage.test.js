'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {buildUsage,createCollegeInjuryUsage}=require('../college-injury-usage');
const games=[3,2,1].map(id=>({game:{id,date:{timestamp:id}}}));
function boxes(values){
 return new Map(games.map((g,i)=>{
  const player={player:{id:7,name:'Receiver'},statistics:[{name:'Receptions',value:values[i]}]};
  const team={team:{id:10},groups:[{name:'Receiving',players:[player]}]};
  return [String(g.game.id),[team]];
 }));
}
test('college role requires repeated meaningful workload including latest team game',()=>{
 const roster=[{id:'7',position:'WR'}];
 assert.equal(buildUsage(games,boxes([4,3,0]),10,roster).length,1);
 assert.equal(buildUsage(games,boxes([0,4,3]),10,roster).length,0);
 assert.equal(buildUsage(games,boxes([4,0,0]),10,roster).length,0);
 assert.equal(buildUsage(games,boxes([null,4,3]),10,roster).length,0);
 assert.throws(()=>buildUsage(games,boxes([4,3,3]),11,roster),/Team box score missing/);
});
test('usage failure stays unavailable and no-Out report needs no boxscore calls',async()=>{
 let calls=0;const enrich=createCollegeInjuryUsage(async()=>{calls++;throw Error('offline');},()=>1000);
 const team={id:'10',official:{available:true,kickoff:2000,rows:[{status:'Out'}]}};
 await enrich({league:'2',season:'2026',game:'4'},[team]);
 assert.equal(team.injuryUsage.available,false);
 team.official.rows=[];
 await enrich({league:'2',season:'2026',game:'4'},[team]);
 assert.equal(team.injuryUsage.available,true);assert.equal(calls,1);
 assert.equal(team.injuryUsage.gameId,'4');
});

test('NFL workload uses completed regular-season games before kickoff and ignores preseason',async()=>{
 const now=Date.parse('2026-10-18T16:00:00Z'),kickoff=now+3600000;
 const schedule=[1,2,3].map((id,i)=>({league:{id:1,season:2026},teams:{home:{id:10},away:{id:11}},game:{id,stage:i===0?'Pre Season':'Regular Season',status:{short:'FT'},date:{timestamp:(now-(i+1)*86400000)/1000}}}));
 const requested=[];
 const enrich=createCollegeInjuryUsage(async path=>{
  if(path.startsWith('/games?'))return {response:schedule};
  requested.push(path);
  return {response:[{team:{id:10},groups:[{name:'Rushing',players:[{player:{id:7,name:'Runner'},statistics:[{name:'Total Rushes',value:10}]}]}]}]};
 },()=>now);
 const t={id:'10',official:{available:true,kickoff,rows:[{id:'7',status:'Out'}]},roster:{rows:[{id:'7',position:'RB'}]}};
 await enrich({league:'1',season:'2026',game:'4'},[t]);
 assert.equal(t.injuryUsage.available,true);assert.equal(t.injuryUsage.rows[0].id,'7');
 assert.deepEqual(requested.sort(),['/games/statistics/players?id=2','/games/statistics/players?id=3']);
});
