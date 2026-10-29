'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');
const {withRecovery}=require('../provider-retry');const {createMeter}=require('../api-meter');
const temporary=()=>Object.assign(Error('temporary'),{retryable:true});
test('transient recovery is bounded to one retry and meters both attempts',async()=>{
 const meter=createMeter();let calls=0,waits=0;
 const value=await withRecovery(()=>meter.track('/games',async()=>{if(++calls===1)throw temporary();return 12;}),{wait:async()=>{waits++;}});
 assert.equal(value,12);assert.equal(calls,2);assert.equal(waits,1);assert.equal(meter.snapshot().outboundAttempts,2);
 calls=0;await assert.rejects(withRecovery(async()=>{calls++;throw temporary();},{wait:async()=>{}}));assert.equal(calls,2);
});
test('recovery cannot bypass daily budget or provider cooldown',async()=>{
 const meter=createMeter({budget:1});let calls=0;
 await assert.rejects(withRecovery(()=>meter.track('/games',async()=>{calls++;throw temporary();}),{wait:async()=>{}}),/budget/);assert.equal(calls,1);
 const limited=createMeter();calls=0;
 await assert.rejects(withRecovery(()=>limited.track('/games',async(headers,response)=>{calls++;response(429,new Headers());throw temporary();}),{wait:async()=>{}}),/cooldown/);assert.equal(calls,1);
});
test('auth, application and unclassified errors are never retried',async()=>{
 let calls=0;await assert.rejects(withRecovery(async()=>{calls++;throw Error('API error');},{wait:async()=>assert.fail('must not retry')}));assert.equal(calls,1);
});
