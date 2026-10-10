'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {fit,apply}=require('../public/probability-calibration');
test('calibration softens overconfident probabilities and retains symmetry',()=>{
 const rows=Array.from({length:200},(_,i)=>({id:String(i),p:i<100?.9:.1,y:i<100?(i%10<6?1:0):(i%10<4?1:0)}));
 const f=fit(rows);assert.ok(f.slope<1);assert.ok(apply(.9,f)<.9);assert.ok(apply(.9,f)>.5);
 assert.ok(Math.abs(apply(.1,f)+apply(.9,f)-1)<1e-12);assert.equal(apply(.5,f),.5);
 assert.ok(apply(0,f)>0);assert.ok(apply(1,f)<1);
});
test('repeated thresholds are not independent games and sparse or one-sided samples cannot calibrate',()=>{
 const rows=Array.from({length:99},(_,i)=>({id:String(i),p:.7,y:i%2}));
 assert.equal(fit([...rows,...rows,...rows]),null);
 assert.equal(fit(Array.from({length:200},(_,i)=>({id:String(i),p:.9,y:1}))),null);
 assert.equal(apply(.5,{method:'temperature-v1',games:200,slope:NaN}),null);
 assert.equal(apply(.5,{method:'temperature-v1',games:99,slope:1}),null);
});
test('each game carries the same fitting weight even with repeated thresholds',()=>{
 const rows=Array.from({length:150},(_,i)=>({id:String(i),p:i%2?.9:.1,y:i%3?1:0}));
 assert.ok(Math.abs(fit(rows).slope-fit([...rows,...rows,...rows]).slope)<1e-10);
});
