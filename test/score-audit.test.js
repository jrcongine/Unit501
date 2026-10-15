'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {audit}=require('../public/score-audit');
const day=86400000;
const season=()=>Array.from({length:70},(_,i)=>({id:String(i),kickoff:(i+1)*7*day,forecastAt:(i+1)*7*day-1000,knownAt:(i+1)*7*day+day,projectedAway:20,projectedHome:30,actualAway:19,actualHome:25}));
test('total inflation and favorite margin signs are invariant to home/away and distinguish compression',()=>{
 const r=season()[0],a=audit([r]);assert.equal(a.overall.totalBias,6);assert.equal(a.overall.favoriteMarginBias,4);
 const reversed={...r,projectedAway:30,projectedHome:20,actualAway:25,actualHome:19};assert.deepEqual(a.overall,audit([reversed]).overall);
 assert.equal(audit([{...r,actualHome:35}]).overall.favoriteMarginBias,-6);
 assert.equal(audit([{...r,projectedHome:20}]).overall.favoriteMarginBias,null);
 assert.equal(audit([{...r,actualHome:10}]).overall.favoriteMarginBias,19);
});
test('candidate fits only known earlier results and future outcomes cannot rewrite earlier checks',()=>{
 const rows=season(),a=audit(rows);assert.equal(a.candidate.checks.length,40);assert.equal(a.candidate.status,'review-candidate');
 assert.equal(a.candidate.checks[0].trainingGames,30);assert.equal(a.candidate.checks[0].totalCorrection,6);
 const b=audit(rows.map((r,i)=>i>=60?{...r,actualHome:100}:r));
 assert.deepEqual(a.candidate.checks.filter(r=>+r.id<60),b.candidate.checks.filter(r=>+r.id<60));
 assert.equal(audit(rows.map(r=>({...r,knownAt:1000*day}))).candidate.checks.length,0);
 assert.equal(audit(rows.map(r=>({...r,forecastAt:day}))).candidate.checks.length,0);
});
test('duplicates, missing results and overlapping kickoffs cannot create evidence',()=>{
 const rows=season();assert.equal(audit([rows[0],rows[0]]).overall.games,0);
 assert.equal(audit([{...rows[0],actualHome:null}]).overall.games,0);
 assert.equal(audit(rows.map(r=>({...r,kickoff:day,knownAt:2*day}))).candidate.checks.length,0);
 assert.equal(audit(rows.slice(0,59)).candidate.status,'insufficient');
 assert.equal(audit([]).overall.totalBias,null);
});
test('margin bands use pregame projected magnitude, including exact boundaries',()=>{
 const rows=season().slice(0,4).map((r,i)=>({...r,projectedAway:20,projectedHome:20+[0,7,14,-14][i]}));
 assert.deepEqual(audit(rows).marginBands.map(b=>b.games),[1,1,2]);
});
