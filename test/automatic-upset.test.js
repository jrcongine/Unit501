'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {upsetOutlook}=require('../public/unit501-shared-ui');
test('cross-sport upset classifier requires an outright underdog win using unrounded scores',()=>{
 const p=(away,home)=>({available:true,away,home});
 assert.equal(upsetOutlook(p(24.2,24.1),3).upset,true);
 assert.equal(upsetOutlook(p(24.1,24.2),-3).upset,true);
 for(const [away,home,line] of [[24,27,7],[24,24,7],[27,24,-7],[27,24,0]])assert.equal(upsetOutlook(p(away,home),line).upset,false);
 for(const line of [null,undefined,'3',NaN,Infinity])assert.equal(upsetOutlook(p(27,24),line),null);
 assert.equal(upsetOutlook({available:false},3),null);
});
