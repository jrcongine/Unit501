'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createProviderQueue}=require('../provider-queue');
test('independent consumers share pacing and observed minute capacity without spending while queued',async()=>{
 let clock=0,quota=null;const starts=[];
 const queue=createProviderQueue({now:()=>clock,state:()=>({providerQuota:quota}),wait:async ms=>{clock+=ms;}});
 await Promise.all([0,1,2].map(i=>queue(async()=>{starts.push(clock);if(i===0)quota={minuteLimit:300};})));
 assert.equal(starts.length,3);assert.ok(starts[1]-starts[0]>=1100);assert.ok(starts[2]-starts[1]>=250);
});
test('short cooldown waits and retries the failed call once without restarting its consumer',async()=>{
 let clock=1000,cooldown=null,calls=0;
 const queue=createProviderQueue({now:()=>clock,state:()=>({cooldownUntil:cooldown}),wait:async ms=>{clock+=ms;}});
 const result=await queue(async()=>{calls++;if(calls===1){cooldown=new Date(clock+60000).toISOString();throw Object.assign(Error('429'),{code:'FOOTBALL_COOLDOWN',retryAt:clock+60000});}return 'history';});
 assert.equal(result,'history');assert.equal(calls,2);assert.ok(clock>=61000);
});
test('long throttle and quota/auth errors do not trigger unbounded waits or retries, and queue recovers',async()=>{
 let clock=0,cooldown=new Date(300000).toISOString(),calls=0;
 const queue=createProviderQueue({now:()=>clock,state:()=>({cooldownUntil:cooldown}),wait:async ms=>{clock+=ms;}});
 await assert.rejects(queue(async()=>calls++),e=>e.code==='FOOTBALL_COOLDOWN'&&e.retryAt===300000);assert.equal(calls,0);assert.equal(clock,0);
 cooldown=null;
 await assert.rejects(queue(async()=>{calls++;throw Error('auth');}),/auth/);assert.equal(calls,1);
 await queue(async()=>calls++);assert.equal(calls,2);
});
test('a second rate limit is returned rather than looping forever',async()=>{
 let clock=0,calls=0,cooldown=null;
 const queue=createProviderQueue({now:()=>clock,state:()=>({cooldownUntil:cooldown}),wait:async ms=>{clock+=ms;}});
 await assert.rejects(queue(async()=>{calls++;cooldown=new Date(clock+60000).toISOString();throw Object.assign(Error('429'),{code:'FOOTBALL_COOLDOWN',retryAt:clock+60000});}),/429/);
 assert.equal(calls,2);
});
