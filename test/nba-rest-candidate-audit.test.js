'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {fit,metrics}=require('../scripts/nba-rest-candidate-audit');
test('offline rest candidate fits supplied training residuals and leaves frozen weights unchanged on evaluation',()=>{
 const train=Array.from({length:60},(_,i)=>({restDifference:i%3-1,predictedMargin:5,actualMargin:8+2*(i%3-1)}));
 const home=fit(train),rest=fit(train,true);
 assert.equal(home.homeMargin,3);assert.equal(home.restPointsPerDay,0);
 assert.equal(rest.homeMargin,3);assert.ok(Math.abs(rest.restPointsPerDay-4/3)<1e-12);
 const frozen=JSON.stringify(rest);
 metrics([{predictedMargin:5,actualMargin:-200,restDifference:1}],rest);
 assert.equal(JSON.stringify(rest),frozen);
 assert.throws(()=>fit(train.slice(0,10)),/30/);
 assert.throws(()=>fit([...train,{predictedMargin:0,actualMargin:NaN,restDifference:0}]),/Invalid/);
});
test('offline candidate grades winners separately from margin error and does not count forecast ties as picks',()=>{
 const rows=[{predictedMargin:0,actualMargin:5,restDifference:0},{predictedMargin:2,actualMargin:5,restDifference:0},{predictedMargin:-1,actualMargin:5,restDifference:0}];
 const result=metrics(rows,{homeMargin:0,restPointsPerDay:0});
 assert.equal(result.games,3);assert.equal(result.winnerDecisions,2);assert.equal(result.winnerAccuracy,.5);assert.equal(result.marginMAE,14/3);
});
