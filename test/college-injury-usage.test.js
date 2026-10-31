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

test('defensive workload requires repeated recorded tackles including the latest game',()=>{
 const defensiveBoxes=values=>new Map(games.map((g,i)=>[String(g.game.id),defenseBox(values[i])]));
 for(const position of ['CB','DB','S','LB','MLB','EDGE','EDG','DL','DT']){
  const rows=buildUsage(games,defensiveBoxes([4,3,0]),10,[{id:'7',position}]);
  assert.equal(rows.length,1);assert.equal(rows[0].metric,'tackles');
  assert.equal(rows[0].role,'recent defensive contributor');
 }
 for(const values of [[0,4,3],[4,0,0],[null,4,3],[true,4,3],['--',4,3],[-1,4,3],[3.5,0,3]])
  assert.equal(buildUsage(games,defensiveBoxes(values),10,[{id:'7',position:'LB'}]).length,0);
 assert.equal(buildUsage(games,defensiveBoxes([4,3,3]),10,[{id:'7',position:'OL'}]).length,0);
 assert.throws(()=>buildUsage([games[0],games[0]],defensiveBoxes([4,3,3]),10,[{id:'7',position:'LB'}]),/Duplicate/);
});

test('workload cache preserves source age and repeated schedule rows cannot establish a role',async()=>{
 let clock=Date.parse('2026-10-30T18:00:00Z');const at=clock,kickoff=clock+3600000;
 const game={league:{id:2,season:2026},teams:{home:{id:10},away:{id:11}},game:{id:1,status:{short:'FT'},date:{timestamp:(clock-86400000)/1000}}};
 let schedule=[game,structuredClone(game)];
 const enrich=createCollegeInjuryUsage(async path=>({response:path.startsWith('/games?')?schedule:defenseBox(4)}),()=>clock);
 const team={id:'10',official:{available:true,kickoff,rows:[{id:'7',status:'Out'}]},roster:{rows:[{id:'7',position:'LB'}]}};
 const q={league:'2',season:'2026',game:'4'};
 await enrich(q,[team]);assert.equal(team.injuryUsage.available,false);
 // A fresh adapter sees two distinct games; subsequent reads keep the source timestamp.
 schedule=[game,{...game,game:{...game.game,id:2,date:{timestamp:(clock-2*86400000)/1000}}}];
 const clean=createCollegeInjuryUsage(async path=>({response:path.startsWith('/games?')?schedule:defenseBox(4)}),()=>clock);
 await clean(q,[team]);assert.equal(team.injuryUsage.rows.length,1);
 clock+=60000;await clean(q,[team]);assert.equal(team.injuryUsage.checkedAt,at);
});

function defenseBox(value){
 const player={player:{id:7,name:'Defender'},statistics:[{name:'Tackles',value}]};
 return [{team:{id:10},groups:[{name:'Defensive',players:[player]}]}];
}

test('workload diagnostics distinguish actual zero, missing data, low usage and unsupported positions',()=>{
 const {buildUsageReport}=require('../college-injury-usage');
 const roster=[{id:'7',position:'WR'},{id:'9',position:'OL'}];
 for(const [values,reason] of [[[null,4,3],'latest-stat-unverified'],[[0,4,3],'latest-below-threshold'],[[2,4,3],'latest-below-threshold'],[[4,1,1],'insufficient-repeated-workload'],[[4,3,1],'eligible']]){
  const report=buildUsageReport(games,boxes(values),10,roster);
  assert.equal(report.assessments[0].reason,reason);
  assert.equal(report.assessments[0].games[0].value,values[0]);
  assert.equal(report.assessments[0].games[0].id,'3');
  assert.equal(report.assessments[1].reason,'unsupported-position');
  assert.equal(report.rows.length,reason==='eligible'?1:0);
 }
});

test('verified historical reports recover missing offensive workload for either football league',()=>{
 const {buildUsageReport}=require('../college-injury-usage');
 for(const league of ['1','2']){
  const schedule=games.map(g=>({...g,teams:{away:{id:10,name:'Away'},home:{id:11,name:'Home'}},scores:{away:{total:20},home:{total:21}}}));
  const empty=new Map(games.map(g=>[String(g.game.id),[{team:{id:10,name:'Away'},groups:[]}]]));
  const reports=games.map(g=>({available:true,league,season:'2026',gameId:String(g.game.id),gameDate:g.game.date.timestamp,nameFormat:'full',source:'https://site.api.espn.com/apis/site/v2/sports/football/'+(league==='1'?'nfl':'college-football')+'/summary?event=123',teams:[{id:'10',name:'Away',scored:20,allowed:21,players:[{name:'Test Receiver',participation:'played',markets:['rec'],rec:4}]},{id:'11',name:'Home',scored:21,allowed:20,players:[]}]}));
  const roster=[{id:'7',name:'Test Receiver',position:'WR'}],scope={league,season:'2026'};
  assert.equal(buildUsageReport(schedule,empty,10,roster,reports,scope).rows.length,1);
  for(const change of [{league:'wrong'},{gameDate:999},{gameId:'999'}]){
   assert.equal(buildUsageReport(schedule,empty,10,roster,reports.map(r=>({...r,...change})),scope).rows.length,0);
  }
  const dnp=structuredClone(reports);dnp[0].teams[0].players[0].participation='dnp';
  assert.equal(buildUsageReport(schedule,empty,10,roster,dnp,scope).rows.length,0);
  const ambiguous=[...roster,{id:'8',name:'Test Receiver',position:'WR'}];
  assert.equal(buildUsageReport(schedule,empty,10,ambiguous,reports,scope).rows.length,0);
  const conflict=boxes([1,1,1]);for(const rows of conflict.values()){rows[0].team.name='Away';rows[0].groups[0].players[0].player.name='Test Receiver';}
  const result=buildUsageReport(schedule,conflict,10,roster,reports,scope);
  assert.equal(result.rows.length,0);assert.ok(result.assessments[0].games.every(g=>g.value===null));
 }
});

test('missing workload invokes reconciliation for all matchups; failures preserve unknowns',async()=>{
 for(const league of ['1','2']){
  const now=Date.parse('2026-10-30T18:00:00Z'),kickoff=now+3600000;
  const schedule=[1,2].map(id=>({league:{id:league,season:2026},teams:{away:{id:10,name:'Away'},home:{id:11,name:'Home'}},scores:{away:{total:20},home:{total:21}},game:{id,stage:'Regular Season',status:{short:'FT'},date:{timestamp:(now-id*86400000)/1000}}}));
  let calls=0;
  const enrich=createCollegeInjuryUsage(async path=>({response:path.startsWith('/games?')?schedule:[{team:{id:10,name:'Away'},groups:[]}]}),()=>now,async()=>{calls++;throw Error('unavailable');});
  const team={id:'10',official:{available:true,kickoff,rows:[{id:'7',status:'Out'}]},roster:{rows:[{id:'7',name:'Test Receiver',position:'WR'}]}};
  await enrich({league,season:'2026',game:'4'},[team]);
  assert.equal(calls,2);assert.equal(team.injuryUsage.available,true);assert.equal(team.injuryUsage.rows.length,0);
  assert.ok(team.injuryUsage.assessments[0].games.every(g=>g.value===null));
 }
});
