'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {upsetOutlook}=require('../public/unit501-shared-ui');
const {outcome}=require('../public/team-model');
for(const [name,classify] of [['shared/NBA',upsetOutlook],['NFL/CFB',outcome]]){
 test(name+' upset alerts require meaningful margin and raw win support',()=>{
  const p=(away,home)=>({available:true,away,home});
  for(const [a,h,line,sim] of [[23.2,23,3,{win:.496,tie:.02}],[23,23.2,-3,{win:.484,tie:.02}],[24.2,24.1,3,{win:.7,tie:0}],[27,24,3,{win:.54,tie:.02}],[24,27,-3,{win:.44,tie:.02}]]){
   const r=classify(p(a,h),line,sim);assert.equal(r.lean,true);assert.equal(r.upset,false);
  }
  assert.equal(classify(p(27,24),3,{awayWin:.6,tie:.02}).upset,true);
  assert.equal(classify(p(24,27),-3,{win:.38,tie:.02}).upset,true);
  for(const sim of [undefined,{win:NaN,tie:0},{win:.8,tie:.4},{win:1,tie:0}])assert.equal(classify(p(24,27),-3,sim).upset,false);
  assert.equal(classify(p(27,24),0,{win:.6,tie:.02}).upset,false);
  assert.equal(classify(p(24,24),3,{win:.6,tie:.02}).upset,false);
  for(const line of [null,undefined,'3',NaN,Infinity])assert.equal(classify(p(27,24),line),null);
 });
}
