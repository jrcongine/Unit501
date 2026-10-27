'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const monitor=require('../odds-monitor');
test('odds allowance observer accepts numeric remaining headers without keys or response content',()=>{
 const seen=[];monitor.setObserver(x=>seen.push(x));
 try{
  for(const raw of ['0','100',null,'','NaN','-1'])monitor.observe({status:200,headers:{get:()=>raw},body:'SECRET'});
  assert.deepEqual(seen.map(x=>x.remaining),[0,100,null,null,null,null]);
  assert.ok(seen.every(x=>Object.keys(x).sort().join(',')==='remaining,status'));
 }finally{monitor.setObserver(null);}
});
