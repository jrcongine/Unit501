'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {validate,fit}=require('../backtest');
const {summarize}=require('../rankings');
function season() {
  const roster=Array.from({length:32},(_,id)=>({id:id+1,name:'Team '+id}));
  const games=[];
  for(let week=0;week<8;week++)for(let i=0;i<32;i+=2)games.push({
    league:{id:1,season:2026},game:{id:games.length+1,stage:'Regular Season',status:{short:'FT'},date:{timestamp:100+week*100}},
    teams:{away:roster[i],home:roster[i+1]},scores:{away:{total:18+(week%3)*4},home:{total:27+(week%2)*3}}
  });
  return {roster,games};
}
test('chronological replay withholds warmup and variance until enough earlier games',()=>{
  const {roster,games}=season();
  const query={league:'1',season:'2026',before:1000000};
  const calls=[];
  const result=validate(games,query,before=>{
    calls.push(before);
    return summarize(games,new Map(),{...query,before},roster);
  });
  assert.equal(result.games,96);assert.equal(result.skipped,32);
  assert.equal(result.probabilityGames,64); // first 32 scored predictions train only
  assert.equal(result.calibration.games,96);
  assert.equal(calls.length,8);
  assert.equal(result.bins.reduce((s,b)=>s+b.games,0),64);
  assert.ok(result.brier>=0&&result.brier<=1);
  assert.ok(result.legacy.scoreMAE>=0);
});
test('later results cannot change earlier predictions or calibration; cutoff and duplicate games honored',()=>{
  const {roster,games}=season();
  const query={league:'1',season:'2026',before:1000000};
  const run=rows=>validate(rows,query,before=>summarize(rows,new Map(),{...query,before},roster));
  const first=run(games);
  const modified=games.map(g=>g.game.date.timestamp===800?{...g,scores:{away:{total:99},home:{total:0}}}:g);
  const next=run([...modified,modified[0]]);
  assert.deepEqual(next.records.filter(r=>r.kickoff<800000),first.records.filter(r=>r.kickoff<800000));
  assert.equal(next.games,first.games);
  const short=validate(games,{...query,before:500000},before=>summarize(games,new Map(),{...query,before},roster));
  assert.ok(short.records.every(r=>r.kickoff<500000));assert.equal(short.games,32);
});
test('variance captures bias, is bounded and keeps too-small samples uncalibrated',()=>{
  assert.equal(fit(Array.from({length:29},()=>({away:1,home:1}))),null);
  const large=fit(Array.from({length:30},()=>({away:100,home:-100})));
  assert.equal(large.awaySD,30);assert.equal(large.correlation,-.8);
  const small=fit(Array.from({length:30},()=>({away:0,home:0})));
  assert.equal(small.awaySD,3);assert.equal(small.correlation,0);
});
