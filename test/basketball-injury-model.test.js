'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const model=require('../public/basketball-injury-model');
const nba=require('../public/nba-model'),collegeModel=require('../public/ncaab-model');
const now=Date.parse('2026-10-30T12:00:00Z');
function fixture(college=false){
 const game={id:'100',tipoff:'2026-10-31T12:00:00Z',away:'Team A',home:'Team B',awayId:'1',homeId:'2',statusCode:1,status:'Scheduled',timeKnown:true,stage:2};
 const rows=Array.from({length:6},(_,i)=>({id:String(i+1),tipoff:new Date(now-(i+1)*86400000).toISOString(),for:i<3?90:110,against:100,scored:i<3?90:110,allowed:100}));
 const result=rows.slice(3).map(g=>({gameId:g.id,tipoff:g.tipoff,minutes:30}));
 const inactive=rows.slice(0,3).map(g=>({gameId:g.id,tipoff:g.tipoff}));
 const context={gameId:game.id,tipoff:game.tipoff,checkedAt:now,stage:2};
 for(const [i,s] of ['away','home'].entries())context[s]={id:String(i+1),name:game[s],available:true,recent10:{games:6,scored:100,allowed:100,pointsFor:100,pointsAgainst:100},recentGames:rows};
 const history={gameId:game.id,tipoff:game.tipoff,checkedAt:now,teams:[{name:'Team A',available:true,players:[{name:'Player One',results:result,inactive}]},{name:'Team B',available:true,players:[]}]};
 const report={gameId:game.id,tipoff:game.tipoff,reportAt:now,checkedAt:now,teams:[{name:'Team A',team:'Team A',available:true,players:[{name:'Player One',status:'Out'}]},{name:'Team B',team:'Team B',available:true,players:[]}]};
 const base=(college?collegeModel:nba).project(game,context,'recent10',now);
 return {game,context,history,report,base};
}
for(const college of [false,true]){
 const run=x=>model.apply(x.base,x.game,x.context,x.history,x.report,'recent10',now,college);
 test((college?'CBB':'NBA')+' matched absence evidence changes score and reaches simulation',()=>{
  const x=fixture(college),r=run(x);
  assert.equal(x.base.away,100);assert.equal(r.away,95);assert.equal(r.home,100);assert.equal(r.total,195);
  assert.equal(r.injury.applied.length,1);assert.match(model.describe(r),/Observed association/);
  const engine=college?collegeModel:nba;
  const lines=college?{spread:0,total:198}:{awaySpread:0,total:198};
  const a=engine.simulate(x.base,x.context,lines,100,()=>.6),b=engine.simulate(r,x.context,lines,100,()=>.6);
  assert.equal(a.available,true);assert.equal(b.available,true);assert.notDeepEqual(a,b);
  assert.equal(run(x).away,r.away); // Repeated render starts from the original baseline.
 });
 test((college?'CBB':'NBA')+' unknown, stale, conflicting and mismatched evidence cannot move the score',()=>{
  const mutations=[
   x=>x.report.gameId='different',x=>x.report.tipoff='2027-01-01',x=>x.report.checkedAt=x.report.reportAt=now-7200001,
   x=>x.history.checkedAt=now-1800001,x=>x.context.checkedAt=now+1,x=>x.report.teams.reverse(),
   x=>x.history.teams[0].name='Different',x=>x.report.teams[0].available=false,
   x=>x.report.teams[0].players[0].status='Questionable',x=>x.history.teams[0].players.push({...x.history.teams[0].players[0]}),
   x=>x.history.teams[0].players[0].inactive.pop(),x=>x.history.teams[0].players[0].results[0].minutes=null,
   x=>x.history.teams[0].players[0].inactive[0].tipoff='2000-01-01',
   x=>x.context.away.recentGames[0].id=x.context.away.recentGames[1].id,
   x=>x.context.away.recent10.pointsFor=x.context.away.recent10.scored=200,
   x=>x.context.away.recent10.games=20
  ];
  for(const mutate of mutations){const x=fixture(college);mutate(x);const r=run(x);assert.equal(r.away,100);assert.equal(r.injury.applied.length,0);}
 });
 test((college?'CBB':'NBA')+' simultaneous absences require a joint sample and never stack player values',()=>{
  const x=fixture(college);x.report.teams[0].players.push({name:'Player Two',status:'Out'});x.history.teams[0].players.push({...structuredClone(x.history.teams[0].players[0]),name:'Player Two'});
  assert.equal(run(x).away,95);assert.equal(run(x).injury.applied.length,1);
  x.history.teams[0].players[1].inactive=[];assert.equal(run(x).away,100);
 });
}

for(const college of [false,true])test((college?'CBB':'NBA')+' injury adjustments reject incomplete samples and invalid scoring evidence',()=>{
 const mutations=[
  x=>x.history.teams[0].players[0].missing=[{gameId:'9'}],
  x=>x.history.teams[0].players[0].coverage={missing:1},
  x=>x.history.teams[0].players[0].unverified=[{gameId:'9'}],
  x=>x.context.away.recent10.pointsFor=x.context.away.recent10.scored=undefined,
  x=>x.context.away.recent10.pointsAgainst=x.context.away.recent10.allowed=NaN,
  x=>x.context.away.recent10.pointsFor=x.context.away.recent10.scored='100',
  x=>x.context.away.id='999',
  x=>x.history.teams[0].id='999',
  x=>x.context.away.recentGames[0].against=x.context.away.recentGames[0].allowed=90,
  x=>x.history.teams[0].players[0].inactive.push(null),
  x=>x.history.teams[0].players[0].results.push(null),
  x=>x.history.teams[0].players[0].inactive.push({...x.history.teams[0].players[0].inactive[0]})
 ];
 for(const [i,mutate] of mutations.entries()){
  const x=fixture(college);mutate(x);
  const r=model.apply(x.base,x.game,x.context,x.history,x.report,'recent10',now,college);
  assert.equal(r.away,100,'mutation '+i);assert.equal(r.injury.applied.length,0,'mutation '+i);
 }
});

test('NBA reconciles distinct provider game IDs only with an exact verified game fingerprint',()=>{
 function mapped(){
  const x=fixture(false);
  x.context.away.recentGames=x.context.away.recentGames.map(g=>({...g,opponent:'Boston Celtics',venue:'away'}));
  x.history.teams[0].gameSource='espn';
  x.history.teams[0].gameLog=structuredClone(x.context.away.recentGames);
  x.context.away.recentGames=x.context.away.recentGames.map(g=>({...g,id:String(1000+Number(g.id))}));
  return x;
 }
 const run=x=>model.apply(x.base,x.game,x.context,x.history,x.report,'recent10',now,false);
 assert.equal(run(mapped()).away,95);
 const mutations=[
  x=>x.history.teams[0].gameLog[0].opponent='Other opponent',
  x=>x.history.teams[0].gameLog[0].for=91,
  x=>x.history.teams[0].gameLog[0].against=101,
  x=>x.history.teams[0].gameLog[0].venue='home',
  x=>x.history.teams[0].gameLog[0].tipoff=new Date(now-86400000+60000).toISOString(),
  x=>x.history.teams[0].gameLog.push({...x.history.teams[0].gameLog[0]}),
  x=>x.history.teams[0].gameLog[0].id=x.history.teams[0].gameLog[1].id,
  x=>delete x.history.teams[0].gameLog,
  x=>x.history.teams[0].gameSource='unknown'
 ];
 for(const change of mutations){const x=mapped();change(x);assert.equal(run(x).away,100);}
 const x=mapped();x.history.teams[0].gameLog[0].id='9999';assert.equal(run(x).away,100,'Fingerprint cannot create a missing participation record');
});

test('NBA accepts the actual ISO team-context timestamp contract without weakening expiry',()=>{
 const x=fixture();x.context.checkedAt=new Date(now).toISOString();
 const run=()=>model.apply(x.base,x.game,x.context,x.history,x.report,'recent10',now);
 assert.equal(run().away,95);
 for(const at of [new Date(now-1800001).toISOString(),new Date(now+1).toISOString(),'2026-10-30',String(now),'garbage',null]){x.context.checkedAt=at;assert.equal(run().away,100);}
});

test('NBA provider team IDs use the server-verified mapping without relaxing game fingerprints',()=>{
 const x=fixture();x.game.provider='api-nba';
 const h=x.history.teams[0];h.id='4';h.gameSource='espn';h.selectedProvider='api-nba';h.selectedTeamId='1';
 x.context.away.recentGames=x.context.away.recentGames.map(g=>({...g,opponent:'Boston Celtics',venue:'away'}));
 h.gameLog=structuredClone(x.context.away.recentGames);
 const run=()=>model.apply(x.base,x.game,x.context,x.history,x.report,'recent10',now);
 assert.equal(run().away,95);
 h.selectedTeamId='999';assert.equal(run().away,100);
 h.selectedTeamId='1';h.selectedProvider='unknown';assert.equal(run().away,100);
 h.selectedProvider='api-nba';h.gameLog[0].for=99;assert.equal(run().away,100);
});
