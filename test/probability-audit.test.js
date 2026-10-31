'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {audit,metrics,seededRandom}=require('../probability-audit');
const splitAt=Date.parse('2025-01-01T00:00:00Z');
const row=(id,day,p,y)=>({id,kickoff:splitAt+day*86400000,forecastAt:splitAt+day*86400000-1,knownAt:splitAt+day*86400000+18000000,simulation:{available:true,homeWin:p*.9,awayWin:(1-p)*.9,tie:.1},homeWon:y});
const options={splitAt,minTraining:10,minEvaluation:10};
const fixture=()=>Array.from({length:80},(_,i)=>row(i,i-40,i%2?.8:.2,i%3?1:0));
test('probability scoring gives correct Brier, log-loss and reliability counts including 0 and 1',()=>{
 const m=metrics([{p:.75,y:1},{p:.25,y:0}]);assert.equal(m.brier,.0625);assert.ok(Math.abs(m.logLoss+Math.log(.75))<1e-12);assert.equal(m.reliability.reduce((n,b)=>n+b.games,0),2);
 assert.equal(metrics([{p:0,y:1},{p:1,y:0}]).brier,1);assert.ok(Number.isFinite(metrics([{p:0,y:1}]).logLoss));
 assert.equal(metrics([]).brier,null);for(const p of [null,NaN,-1,2])assert.throws(()=>metrics([{p,y:1}]),/Invalid/);
});
test('recalibration is deterministic, separates dates and never opts into deployment',()=>{
 const a=audit(fixture(),options),b=audit([...fixture()].reverse(),options);assert.deepEqual(a,b);
 assert.equal(a.training.games,40);assert.equal(a.evaluation.games,40);assert.equal(a.status,'research-only');assert.equal(a.deploymentEligible,false);
 assert.ok(a.candidate.training.logLoss<a.training.logLoss);assert.ok(a.candidate.coefficients.slope<1);
 assert.ok(a.candidate.brierDeltaInterval95.every(Number.isFinite));
 const rng=seededRandom('game1'),same=seededRandom('game1');for(let i=0;i<5;i++)assert.equal(rng(),same());
});
test('evaluation outcomes cannot change fitted calibration or training metrics',()=>{
 const rows=fixture(),a=audit(rows,options),b=audit(rows.map(r=>r.kickoff>=splitAt?{...r,homeWon:1-r.homeWon}:r),options);
 assert.deepEqual(a.candidate.coefficients,b.candidate.coefficients);assert.deepEqual(a.training,b.training);
 const late=rows.map(r=>r.id===39?{...r,knownAt:splitAt+1}:r);assert.equal(audit(late,options).training.games,39);
});
test('invalid and all-tied simulations cannot produce invented win probabilities',()=>{
 const rows=fixture();
 rows[0].simulation={available:true,homeWin:0,awayWin:0,tie:1};rows[1].simulation.homeWin=2;rows[2].forecastAt=rows[2].kickoff;rows[3].knownAt=rows[3].kickoff;rows[4].homeWon=null;
 const a=audit(rows,options);assert.equal(a.allTies,1);assert.equal(a.invalid,4);assert.equal(a.valid,75);
 assert.equal(audit(fixture(),{splitAt}).status,'insufficient');assert.equal(audit(fixture(),{splitAt}).candidate,null);
});
test('duplicate forecasts cannot overweight calibration; conflicting copies fail closed',()=>{
 const rows=fixture();assert.deepEqual(audit(rows,options),audit([...rows,rows[0]],options));
 assert.throws(()=>audit([...rows,{...rows[0],homeWon:1-rows[0].homeWon}],options),/Conflicting/);
 assert.throws(()=>audit([{...rows[0],id:null}],options),/identity/);
});
