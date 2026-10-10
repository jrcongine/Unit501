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
