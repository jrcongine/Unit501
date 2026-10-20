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
