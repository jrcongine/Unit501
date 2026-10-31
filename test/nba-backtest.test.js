'use strict';
const {test}=require('node:test'), assert=require('node:assert/strict');
const {backtest}=require('../nba-backtest');
function game(id,day,away,home,a,h){return {id,league:'standard',stage:2,season:2026,date:{start:`2026-10-${String(day).padStart(2,'0')}T23:00:00Z`},status:{short:3},teams:{visitors:{id:away,name:`Team ${away}`},home:{id:home,name:`Team ${home}`}},scores:{visitors:{points:a},home:{points:h}}};}
test('NBA replay uses earlier results only and grades the actual baseline',()=>{
 const history=[game(1,1,1,3,100,90),game(2,2,2,4,110,100),game(3,3,1,3,100,90),game(4,4,2,4,110,100),game(5,5,1,3,100,90),game(6,6,2,4,110,100)];
 const target=game(7,8,1,2,105,108);
 const future=game(8,9,1,2,200,50);
 const first=backtest([...history,target],'season');
 const extended=backtest([...history,target,future],'season');
 const a=first.games.find(g=>g.id===7),b=extended.games.find(g=>g.id===7);
 assert.deepEqual(a,b); assert.equal(a.predictedAway,100); assert.equal(a.predictedHome,100);
 assert.equal(a.winnerCorrect,null); assert.equal(first.evaluated,1);
 assert.equal(first.metrics.teamScoreMAE,6.5); assert.equal(first.metrics.totalMAE,13);
 assert.equal(first.metrics.winnerAccuracy,null);
});
test('conflicting duplicates and unscorable games are not graded',()=>{
 const one=game(1,1,1,2,100,90), conflicting=game(1,1,1,2,101,90);
 const out=backtest([one,conflicting,game(2,2,1,2,100,100)]);
 assert.equal(out.evaluated,0); assert.equal(out.skipped,2);
 assert.throws(()=>backtest([], 'unknown'),/scope/);
});

test('NBA replay excludes explicitly foreign leagues and mismatched seasons from targets and histories',()=>{
 const history=[game(1,1,1,3,100,90),game(2,2,2,4,110,100),game(3,3,1,3,100,90),game(4,4,2,4,110,100),game(5,5,1,3,100,90),game(6,6,2,4,110,100)];
 const target=game(7,8,1,2,105,108),baseline=backtest([...history,target],'season');
 for(const patch of [{league:'africa'},{league:''},{season:2025},{season:true},{season:'2026.0'}]){
  const foreign={...game(9,7,1,2,190,50),...patch};
  const report=backtest([...history,target,foreign],'season');
  assert.deepEqual(report.games,baseline.games);assert.equal(report.invalid,1);
  assert.equal(backtest([...history,{...target,...patch}],'season').evaluated,0);
 }
 assert.equal(backtest([...history,{...target,season:'2026'}],'season').evaluated,1);
});
test('NBA replay withholds later estimates after a tied final history record',()=>{
 const raw=Array.from({length:6},(_,i)=>game(i+1,i+1,1,2,100,90));
 const report=backtest([...raw,game(7,7,1,2,100,100),game(8,8,1,2,105,108)],'season');
 assert.ok(report.games.some(g=>g.id===6));assert.ok(!report.games.some(g=>g.id===8));
});

test('NBA replay does not hide malformed history when filtering unrelated scopes',()=>{
 const raw=Array.from({length:6},(_,i)=>game(i+1,i+1,1,2,100,90));
 const report=backtest([...raw,{}],'season');assert.equal(report.invalid,1);assert.equal(report.evaluated,0);
});

test('optional simulation replay uses production simulation and cannot read target or future outcomes',()=>{
 const history=Array.from({length:7},(_,i)=>game(i+1,i+1,1,2,100+i,90+i)),target=game(8,10,1,2,95,100);
 const a=backtest([...history,target],'season',{simulationRuns:1000}).games.find(g=>g.id===8);
 const b=backtest([...history,{...target,scores:{visitors:{points:180},home:{points:60}}},game(9,11,1,2,200,100)],'season',{simulationRuns:1000}).games.find(g=>g.id===8);
 assert.equal(a.simulation.available,true);assert.deepEqual(a.simulation,b.simulation);assert.notEqual(a.winnerCorrect,b.winnerCorrect);
 assert.equal('simulation' in backtest([...history,target],'season').games[0],false);
 assert.throws(()=>backtest([],'season',{simulationRuns:1.5}),/runs/);
});
