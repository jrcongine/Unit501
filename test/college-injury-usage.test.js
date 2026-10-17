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
