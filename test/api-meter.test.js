'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createMeter,category}=require('../api-meter');
const {createRosterMaintenance}=require('../roster-maintenance');
test('football meter counts actual outbound attempts by endpoint family, including failures',async()=>{
 let clock=Date.parse('2026-10-19T12:00:00Z');
 const meter=createMeter({now:()=>clock,budget:3});
 await meter.track('/games?league=1',async()=>({response:[1]}));
 await meter.track('/games/statistics/teams?id=100',async()=>({response:[2]}));
 await assert.rejects(meter.track('/players?team=1',async()=>{throw Error('provider 429')}),/429/);
 assert.equal(meter.snapshot().outboundAttempts,3);
 assert.equal(meter.snapshot().failedResponses,1);
 assert.equal(meter.snapshot().byCategory.schedules,1);
 assert.equal(meter.snapshot().byCategory.teamBoxScores,1);
 assert.equal(meter.snapshot().byCategory.rosters,1);
 await assert.rejects(meter.track('/games?league=2',async()=>{throw Error('must not execute')}),/safety budget reached/);
 assert.equal(meter.snapshot().outboundAttempts,3);
 assert.equal(meter.snapshot().blockedByGuard,1);
 clock+=24*3600000;
 assert.equal(meter.snapshot().outboundAttempts,0);
 await meter.track('/odds?game=8',async()=>true);
 assert.equal(meter.snapshot().byCategory.odds,1);
 assert.equal(meter.snapshot().outboundAttempts,1);
});
test('meter cannot be configured with a budget larger than paid plan ceiling',()=>{
 for(const cap of [0,-1,7.5,7501,NaN])assert.throws(()=>createMeter({budget:cap}),/Invalid/);
 assert.equal(category('/games/statistics/players?id=3'),'playerBoxScores');
});
test('sweep scheduling never runs on startup and paused sweeps use zero provider calls',()=>{
 let timerCalls=0,requests=0;
 const set=global.setInterval;
 const worker=createRosterMaintenance(async()=>{requests++;return {response:[]}},async()=>{},Date.now);
 try{
  global.setInterval=(fn,ms)=>{timerCalls++;assert.equal(ms,24*3600000);return {unref(){}};};
  worker.pause();
  assert.match(worker.status().message,/paused/);
  assert.equal(requests,0);
  worker.start();
  assert.equal(timerCalls,1);
  assert.equal(requests,0);
  assert.match(worker.status().message,/daily/);
 }finally{global.setInterval=set;}
});

test('provider headers show account-wide quota and block calls once exhausted',async()=>{
 let clock=Date.parse('2026-10-19T22:00:00Z'),calls=0;
 const meter=createMeter({now:()=>clock,budget:1500});
 const headers=n=>new Headers({
   'x-ratelimit-requests-limit':'7500',
   'x-ratelimit-requests-remaining':String(n),
   'x-ratelimit-limit':'300',
   'x-ratelimit-remaining':'280'
 });
 meter.observeHeaders(headers(20));
 let quota=meter.snapshot().providerQuota;
 assert.equal(quota.dailyLimit,7500);
 assert.equal(quota.dailyRemaining,20);
 assert.equal(quota.minuteLimit,300);
 // Concurrent calls can finish out of order: older replies cannot inflate remaining.
 meter.observeHeaders(headers(0));
 meter.observeHeaders(headers(5));
 quota=meter.snapshot().providerQuota;
 assert.equal(quota.dailyRemaining,0);
 await assert.rejects(meter.track('/games?league=1',async()=>{calls++;}),/provider daily quota exhausted/);
 assert.equal(calls,0);
 assert.equal(meter.snapshot().blockedByProviderQuota,1);
 assert.equal(meter.snapshot().outboundAttempts,0);
 clock+=24*3600000;
 assert.equal(meter.snapshot().providerQuota,null);
 await meter.track('/games?league=1',async()=>{calls++;return {};});
 assert.equal(calls,1);
});
test('bad or missing quota headers do not invent a provider limit',()=>{
 const meter=createMeter({budget:3});
 meter.observeHeaders(null);
 meter.observeHeaders(new Headers({'x-ratelimit-requests-limit':'unknown'}));
 assert.equal(meter.snapshot().providerQuota,null);
});

test('late responses from yesterday do not poison the next UTC day',async()=>{
 let clock=Date.parse('2026-10-19T23:59:59Z'),finish;
 const meter=createMeter({now:()=>clock});
 const task=meter.track('/games',async observe=>{
  await new Promise(resolve=>{finish=resolve;});
  observe(new Headers({'x-ratelimit-requests-remaining':'0'}));
  throw Error('late error');
 });
 clock+=2000;finish();await assert.rejects(task,/late error/);
 assert.equal(meter.snapshot().providerQuota,null);
 assert.equal(meter.snapshot().failedResponses,0);
 await meter.track('/games',async()=>{});
 assert.equal(meter.snapshot().outboundAttempts,1);
});
test('remaining provider quota is reserved while requests are in flight',async()=>{
 const meter=createMeter();let finish;
 meter.observeHeaders(new Headers({'x-ratelimit-requests-remaining':'1'}));
 const task=meter.track('/games',()=>new Promise(resolve=>{finish=resolve;}));
 await assert.rejects(meter.track('/games',async()=>{}),/exhausted/);
 finish();await task;
 await assert.rejects(meter.track('/games',async()=>{}),/exhausted/);
 await assert.rejects(meter.track('/games',async()=>{}),/exhausted/);
});

test('missing headers and failed calls never refund observed provider allowance',async()=>{
 const meter=createMeter();
 meter.observeHeaders(new Headers({'x-ratelimit-requests-remaining':'2'}));
 await meter.track('/games',async()=>{});
 await assert.rejects(meter.track('/games',async()=>{throw Error('timeout');}),/timeout/);
 meter.observeHeaders(new Headers({'x-ratelimit-requests-remaining':'2'}));
 await assert.rejects(meter.track('/games',async()=>assert.fail('must not call provider')),/exhausted/);
 assert.equal(meter.snapshot().outboundAttempts,2);
 assert.equal(meter.snapshot().providerQuota.dailyRemaining,2);
 assert.equal(meter.snapshot().providerAllowance,0);
});
test('429 Retry-After blocks all endpoints without spending requests then recovers',async()=>{
 let clock=Date.parse('2026-10-20T14:00:00Z');
 const meter=createMeter({now:()=>clock});
 await assert.rejects(meter.track('/games',async (headers,response)=>{
  response(429,new Headers({'retry-after':'120'}));throw Error('429');
 }),/429/);
 clock+=60000;
 await assert.rejects(meter.track('/players',async()=>assert.fail()),/cooldown/);
 assert.equal(meter.snapshot().outboundAttempts,1);
 clock+=60001;await meter.track('/games',async()=>{});
 assert.equal(meter.snapshot().outboundAttempts,2);
});
test('HTTP 200 API errors and zero minute balance pause requests without claiming daily exhaustion',async()=>{
 for(const mode of ['body','headers']){
  let clock=Date.parse('2026-10-20T14:00:00Z');
  const meter=createMeter({now:()=>clock});
  await meter.track('/games',async(observe,response)=>{
   if(mode==='body')response(200,new Headers(),{errors:{requests:'rate limited'}});
   else observe(new Headers({'x-ratelimit-remaining':'0'}));
  });
  await assert.rejects(meter.track('/games',async()=>assert.fail()),/cooldown/);
  assert.notEqual(meter.snapshot().providerAllowance,0);
  clock+=60001;await meter.track('/games',async()=>{});
 }
});
test('late previous-day errors do not start a new-day cooldown',async()=>{
 let clock=Date.parse('2026-10-20T23:59:59Z'),finish;
 const meter=createMeter({now:()=>clock});
 const task=meter.track('/games',async(_,response)=>{
  await new Promise(resolve=>finish=resolve);response(429,new Headers());
 });
 clock+=2000;finish();await task;
 await meter.track('/games',async()=>{});
 assert.equal(meter.snapshot().cooldownUntil,null);
});
