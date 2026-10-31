'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {backtest}=require('../ncaab-backtest');
function event(id,day,away=1,home=2,a=70,h=60){return {id:String(id),date:`2026-11-${String(day).padStart(2,'0')}T20:00:00Z`,timeValid:true,season:{year:2027,type:2},competitions:[{timeValid:true,status:{type:{name:'STATUS_FINAL',state:'post',completed:true}},competitors:[{homeAway:'away',team:{id:String(away),displayName:'Team '+away},score:a},{homeAway:'home',team:{id:String(home),displayName:'Team '+home},score:h}]}]};}
const history=()=>[event(1,1,1,3,70,60),event(2,2,2,4,80,70),event(3,3,1,3,70,60),event(4,4,2,4,80,70),event(5,5,1,3,70,60),event(6,6,2,4,80,70)];
test('college replay grades the production baseline without target or future result leakage',()=>{
 const target=event(7,8,1,2,75,78),raw=[...history(),target];
 const a=backtest(raw),b=backtest([...raw,event(8,9,1,2,120,40)]);
 assert.deepEqual(a.games[0],b.games.find(g=>g.id==='7'));
 assert.equal(a.evaluated,1);assert.equal(a.games[0].predictedAway,70);assert.equal(a.games[0].predictedHome,70);
 assert.equal(a.metrics.teamScoreMAE,6.5);assert.equal(a.metrics.totalMAE,13);assert.equal(a.metrics.winnerAccuracy,null);
 assert.deepEqual(backtest([...raw,target]),a);
});
test('college replay rejects contradictory observations and withholds games after known history gaps',()=>{
 const raw=[...history(),event(7,8,1,2,75,78)],conflict=structuredClone(raw[0]);conflict.competitions[0].competitors[0].score=71;
 for(const rows of [[...raw,conflict],[conflict,...raw]])assert.throws(()=>backtest(rows),/Conflicting/);
 const missing=event(9,7,1,3,null,60);assert.equal(backtest([...raw,missing]).evaluated,0);
 const missingTime=event(9,7,1,3);missingTime.timeValid=false;assert.equal(backtest([...raw,missingTime]).evaluated,0);
 assert.throws(()=>backtest(raw,'unknown'),/scope/);
 assert.equal(backtest([{}]).invalid,1);
});

test('college replay withholds later estimates after a tied final history record',()=>{
 const raw=[...history(),event(7,8,1,2,75,78)];
 assert.equal(backtest(raw).evaluated,1);
 assert.equal(backtest([...raw,event(8,7,1,3,70,70)]).evaluated,0);
});

test('college simulation replay is reproducible and excludes target/future results',()=>{
 const prior=Array.from({length:7},(_,i)=>event(i+1,i+1,1,2,75+i,65+i)),target=event(8,10,1,2,60,80);
 const a=backtest([...prior,target],'season',{simulationRuns:1000}).games.find(g=>g.id==='8');
 const b=backtest([...prior,event(8,10,1,2,100,50),event(9,11,1,2,150,40)],'season',{simulationRuns:1000}).games.find(g=>g.id==='8');
 assert.equal(a.simulation.available,true);assert.deepEqual(a.simulation,b.simulation);assert.notEqual(a.winnerCorrect,b.winnerCorrect);
 assert.equal('simulation' in backtest([...prior,target]).games[0],false);
 assert.throws(()=>backtest([],'season',{simulationRuns:100001}),/runs/);
});
