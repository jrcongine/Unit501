'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {validate,fit}=require('../backtest');
const {summarize}=require('../rankings');
function season() {
  const roster=Array.from({length:32},(_,id)=>({id:id+1,name:'Team '+id}));
  const games=[];
  for(let week=0;week<8;week++)for(let i=0;i<32;i+=2)games.push({
    league:{id:1,season:2026},game:{id:games.length+1,stage:'Regular Season',status:{short:'FT'},date:{timestamp:(100+week*100)*1000}},
    teams:{away:roster[i],home:roster[i+1]},scores:{away:{total:18+(week%3)*4},home:{total:27+(week%2)*3}}
  });
  return {roster,games};
}
test('chronological replay withholds warmup and variance until enough earlier games',()=>{
  const {roster,games}=season();
  const query={league:'1',season:'2026',before:1000000000};
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
  const query={league:'1',season:'2026',before:1000000000};
  const run=rows=>validate(rows,query,before=>summarize(rows,new Map(),{...query,before},roster));
  const first=run(games);
  const modified=games.map(g=>g.game.date.timestamp===800000?{...g,scores:{away:{total:99},home:{total:0}}}:g);
  const next=run([...modified,modified[0]]);
  assert.deepEqual(next.records.filter(r=>r.kickoff<800000000),first.records.filter(r=>r.kickoff<800000000));
  assert.equal(next.games,first.games);
  const short=validate(games,{...query,before:500000000},before=>summarize(games,new Map(),{...query,before},roster));
  assert.ok(short.records.every(r=>r.kickoff<500000000));assert.equal(short.games,32);
});
test('variance captures bias, is bounded and keeps too-small samples uncalibrated',()=>{
  assert.equal(fit(Array.from({length:29},()=>({away:1,home:1}))),null);
  const large=fit(Array.from({length:30},()=>({away:100,home:-100})));
  assert.equal(large.awaySD,30);assert.equal(large.correlation,-.8);
  const small=fit(Array.from({length:30},()=>({away:0,home:0})));
  assert.equal(small.awaySD,3);assert.equal(small.correlation,0);
});

test('probability fitting evaluates later games only and future results cannot change calibrated earlier records',()=>{
 const {roster,games}=season();
 let seed=7;const next=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 const rows=[];
 for(let week=0;week<20;week++)for(let i=0;i<16;i++)rows.push({...games[i],game:{...games[i].game,id:week*16+i+1,date:{timestamp:(100+week*100)*1000}},scores:{away:{total:14+Math.floor(next()*28)},home:{total:14+Math.floor(next()*28)}}});
 const query={league:'1',season:'2026',before:3000000000};
 const run=rows=>validate(rows,query,before=>summarize(rows,new Map(),{...query,before},roster));
 const result=run(rows);assert.ok(result.records.some(r=>Number.isFinite(r.calibratedWin)));
 assert.ok(result.probabilityChecks.cover.games>=30);assert.ok(result.probabilityChecks.over.games>=30);
 const modified=rows.map(g=>g.game.date.timestamp>=1900000?{...g,scores:{away:{total:99},home:{total:0}}}:g);
 const later=run(modified);
 assert.deepEqual(result.records.filter(r=>r.kickoff<1900000000),later.records.filter(r=>r.kickoff<1900000000));
 for(const key of ['win','cover','over'])if(result.probabilityCalibration[key]){
  assert.ok(result.probabilityChecks[key].games>=30);
  assert.ok(result.probabilityChecks[key].brier<result.probabilityChecks[key].rawBrier);
 }
});
test('tied finals are not losses in reliability checks; other leagues, seasons and unfinished games are excluded',()=>{
 const {roster,games}=season();const rows=games.map(g=>({...g,scores:{away:{total:24},home:{total:24}}}));
 const query={league:'1',season:'2026',before:1000000000};
 const invalid=[{...rows[0],league:{id:2,season:2026}},{...rows[0],league:{id:1,season:2025}},{...rows[0],game:{...rows[0].game,status:{short:'NS'}}}];
 const result=validate([...rows,...invalid],query,before=>summarize(rows,new Map(),{...query,before},roster));
 assert.equal(result.games,96);assert.equal(result.probabilityGames,0);assert.equal(result.probabilityCalibration.win,null);
});

test('later formula comparison freezes simultaneous warm-up games and matches paired errors',()=>{
 const {roster,games}=season(),query={league:'1',season:'2026',before:1000000000};
 const run=before=>validate(games,{...query,before},cutoff=>summarize(games,new Map(),{...query,before:cutoff},roster));
 const result=run(query.before),check=result.laterComparison;
 assert.equal(check.warmupGames,32);assert.equal(check.games,64);assert.equal(check.sufficient,true);
 const later=result.records.filter(r=>r.kickoff>result.records[29].kickoff);
 const score=rows=>rows.reduce((s,r)=>s+(Math.abs(r.away)+Math.abs(r.home))/2,0)/rows.length;
 assert.equal(check.current.scoreMAE,score(later));
 assert.equal(check.previous.scoreMAE,score(later.map(r=>({away:r.legacyAwayError,home:r.legacyHomeError}))));
 const early=run(500000000).laterComparison;assert.equal(early.games,0);assert.equal(early.current,null);assert.equal(early.sufficient,false);
 const small=run(600000000).laterComparison;assert.equal(small.games,16);assert.equal(small.sufficient,false);
});

test('offense diagnostics group only by pre-kickoff scoring and report paired bias',()=>{
 const {roster,games}=season(),query={league:'1',season:'2026',before:1000000000};
 const run=rows=>validate(rows,query,before=>summarize(rows,new Map(),{...query,before},roster));
 const result=run(games),groups=result.offenseDiagnostics.overall;
 assert.equal(groups.belowAverage.teamGames,result.games);assert.equal(groups.atOrAboveAverage.teamGames,result.games);
 const away=result.records.map(r=>r.away);
 assert.equal(groups.belowAverage.bias,-away.reduce((s,v)=>s+v,0)/away.length);
 assert.equal(groups.belowAverage.scoreMAE,away.reduce((s,v)=>s+Math.abs(v),0)/away.length);
 const modified=games.map(g=>g.game.date.timestamp===800000?{...g,scores:{away:{total:99},home:{total:0}}}:g);
 const next=run(modified);assert.deepEqual(next.records.filter(r=>r.kickoff<800000000),result.records.filter(r=>r.kickoff<800000000));
 assert.equal(next.offenseDiagnostics.overall.belowAverage.teamGames,groups.belowAverage.teamGames);
});

test('overlapping earlier kickoffs cannot leak final scores or error fits into a later replay',()=>{
 const {roster,games}=season(),query={league:'1',season:'2026',before:1000000000};
 const overlapping={...games[0],game:{...games[0].game,id:9999,date:{timestamp:650000}},scores:{away:{total:20},home:{total:21}}};
 const run=overlap=>{const rows=[...games,overlap];return validate(rows,query,before=>summarize(rows,new Map(),{...query,before},roster));};
 const first=run(overlapping),changed=run({...overlapping,scores:{away:{total:99},home:{total:0}}});
 assert.deepEqual(changed.records.filter(r=>r.kickoff===700000000),first.records.filter(r=>r.kickoff===700000000));
 assert.ok(first.records.every(r=>r.historyBefore===r.kickoff-86400000));
 assert.notDeepEqual(changed.records.filter(r=>r.kickoff===800000000),first.records.filter(r=>r.kickoff===800000000));
});

test('probability evaluation gives games equal weight when pushes remove thresholds',()=>{
 const {probabilitySummary}=require('../backtest');
 const rows=[{id:'a',brier:.8,rawBrier:.4},...Array.from({length:3},()=>({id:'b',brier:.1,rawBrier:.4}))];
 const result=probabilitySummary(rows);
 assert.equal(result.games,2);assert.equal(result.thresholds,4);
 assert.ok(Math.abs(result.brier-.45)<1e-12);
 assert.ok(result.brier>result.rawBrier); // Threshold averaging would incorrectly favor calibration.
 assert.equal(probabilitySummary([]).brier,null);
});
test('exported variance excludes games inside the final 24-hour safety window',()=>{
 const {roster,games}=season();
 const before=800000000+3600000,query={league:'1',season:'2026',before};
 const run=rows=>validate(rows,query,cutoff=>summarize(rows,new Map(),{...query,before:cutoff},roster));
 const result=run(games);
 const expected=fit(result.records.filter(r=>r.kickoff<before-86400000));
 assert.deepEqual(result.calibration,expected);
 assert.equal(result.calibration.games,80);
 const changed=games.map(g=>g.game.date.timestamp===800000?{...g,scores:{away:{total:99},home:{total:0}}}:g);
 assert.deepEqual(run(changed).calibration,result.calibration);
});
