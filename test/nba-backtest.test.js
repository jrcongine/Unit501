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
