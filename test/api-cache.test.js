'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createCachedAPI}=require('../api-cache');
test('concurrent visitors share completed boxes; TTL expiry refetches',async()=>{
  let calls=0,now=0;
  const get=createCachedAPI(async()=>{calls++;return {response:[{id:calls}]};},()=>now);
  const [a,b]=await Promise.all([get('/games/statistics/players?id=1'),get('/games/statistics/players?id=1')]);
  assert.deepEqual(a,b);assert.equal(calls,1);
  now=300001;await get('/games/statistics/players?id=1');assert.equal(calls,2);
});
test('provider failures, empty data and incomplete pagination are never cached',async()=>{
  for(const response of [{response:[]},{response:[1],errors:{quota:'limit'}},{response:[1],paging:{total:2}}]) {
    let calls=0;const get=createCachedAPI(async()=>{calls++;return response;});
    await get('/games?team=1');await get('/games?team=1');assert.equal(calls,2);
  }
  let calls=0;const get=createCachedAPI(async()=>{if(++calls===1)throw Error('network');return {response:[1]};});
  await assert.rejects(get('/games?team=1'));await get('/games?team=1');assert.equal(calls,2);
});

test('slow requests stay shared past TTL and cache lifetime starts on completion',async()=>{
 let now=0,calls=0,finish;
 const get=createCachedAPI(()=>{calls++;return new Promise(resolve=>{finish=resolve;});},()=>now);
 const a=get('/games?team=1&season=2026');await Promise.resolve();
 now=120000;
 const b=get('/games?season=2026&team=1');await Promise.resolve();
 assert.equal(calls,1);
 finish({response:[1]});await Promise.all([a,b]);
 now+=59999;await get('/games?team=1&season=2026');assert.equal(calls,1);
 now+=2;const c=get('/games?team=1&season=2026');await Promise.resolve();
 assert.equal(calls,2);finish({response:[2]});await c;
});

test('cache pressure does not evict active paid requests',async()=>{
 let calls=0;const finish=[];
 const get=createCachedAPI(()=>{calls++;return new Promise(resolve=>finish.push(resolve));});
 const pending=Array.from({length:2001},(_,i)=>get('/games?id='+i));
 await Promise.resolve();const same=get('/games?id=0');await Promise.resolve();
 assert.equal(calls,2001);
 finish.forEach(resolve=>resolve({response:[1]}));await Promise.all([...pending,same]);
});

test('a recent dated slate survives cooldown, remains labeled stale, and recovers with fresh data',async()=>{
 let time=1000,calls=0,blocked=false;
 const api=createCachedAPI(async()=>{calls++;if(blocked)throw Object.assign(Error('busy'),{code:'FOOTBALL_COOLDOWN',retryAt:time+60000});return {response:[{id:calls}]};},()=>time);
 const endpoint='/games?date=2026-11-01&league=1';const first=await api(endpoint);
 time+=60001;blocked=true;
 const stale=await api(endpoint);assert.deepEqual(stale.response,first.response);assert.equal(stale.cache.stale,true);assert.equal(stale.cache.storedAt,1000);
 assert.equal((await api(endpoint)).cache.storedAt,1000,'failures must not reset freshness');
 time+=600001;await assert.rejects(api(endpoint),/busy/);
 blocked=false;const recovered=await api(endpoint);assert.equal(recovered.cache,undefined);assert.notDeepEqual(recovered.response,first.response);
});
test('cooldown cache fallback never substitutes player stats, another date, or authentication failures',async()=>{
 for(const endpoint of ['/games/statistics/players?id=1','/games?team=1&season=2026']){
  let time=0,fail=false;const api=createCachedAPI(async()=>{if(fail)throw Object.assign(Error('busy'),{code:'FOOTBALL_COOLDOWN'});return {response:[1]};},()=>time);
  await api(endpoint);time=300001;fail=true;await assert.rejects(api(endpoint),/busy/);
 }
 let time=0,fail=false;const api=createCachedAPI(async()=>{if(fail)throw Error('auth');return {response:[1]};},()=>time);
 await api('/games?date=2026-11-01&league=1');fail=true;time=60001;
 await assert.rejects(api('/games?date=2026-11-02&league=1'),/auth/);
 await assert.rejects(api('/games?date=2026-11-01&league=1'),/auth/);
});
test('uncached roster and injury consumers share only concurrent calls, never old results or failures',async()=>{
 let calls=0,finish;
 const api=createCachedAPI(()=>{calls++;return new Promise((resolve,reject)=>finish={resolve,reject});});
 const a=api('/players?team=1&season=2026'),b=api('/players?season=2026&team=1');await Promise.resolve();assert.equal(calls,1);
 finish.resolve({response:[1]});await Promise.all([a,b]);
 const c=api('/players?team=1&season=2026');await Promise.resolve();assert.equal(calls,2);finish.reject(Error('offline'));await assert.rejects(c,/offline/);
 const d=api('/players?team=1&season=2026');await Promise.resolve();assert.equal(calls,3);finish.resolve({response:[2]});assert.deepEqual(await d,{response:[2]});
});
