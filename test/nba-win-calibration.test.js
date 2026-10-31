'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const model=require('../public/nba-win-calibration');
const prior=require('../data/basketball-probability-audit-2026-10-30.json');
const independent=require('../data/nba-independent-calibration-2026-10-31.json');
function fixture(){return [{stage:2},{available:true,version:'nba-scoring-baseline-v1',scope:'season',injury:{applied:[]}},{available:true,homeWin:.6,awayWin:.38,tie:.02,sampleGames:[10,10]}];}
test('NBA calibration preserves the frozen fit and passes independent-season probability criteria',()=>{
 assert.deepEqual(model.coefficients,prior.nba.candidate.coefficients);assert.deepEqual(model.coefficients,independent.coefficients);
 assert.equal(independent.baseline.games,1151);assert.ok(independent.candidate.brier<independent.baseline.brier);assert.ok(independent.candidate.logLoss<independent.baseline.logLoss);assert.ok(independent.brierDeltaInterval95[1]<0);
 const r=model.apply(...fixture());assert.ok(r.home>.6);assert.equal(r.home+r.away,1);assert.equal(r.evaluationGames,1151);
 assert.equal(model.percent(0),'<0.1%');assert.equal(model.percent(1),'>99.9%');
});
test('NBA calibration is withheld for unsupported scopes, injury changes, playoffs and invalid simulations',()=>{
 const changes=[x=>x[0].stage=3,x=>x[1].scope='recent5',x=>x[1].version='other',x=>x[1].injury.applied.push({}),x=>delete x[1].injury,x=>x[2].sampleGames=[4,10],x=>x[2].homeWin=NaN,x=>x[2].homeWin=.9,x=>Object.assign(x[2],{homeWin:0,awayWin:0,tie:1})];
 for(const change of changes){const x=fixture();change(x);assert.equal(model.apply(...x),null);}
});
