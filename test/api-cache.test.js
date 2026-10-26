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
