'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createSlateCache}=require('../nba-slate-cache');
test('injury refreshes reuse the displayed slate and share a single scheduled reload',async()=>{
 let now=0,calls=0,release;
 const get=createSlateCache(()=>{calls++;return new Promise(resolve=>release=resolve);},{now:()=>now});
 get.remember('2026-10-26',{games:[1]});
 assert.deepEqual(await get('2026-10-26'),{games:[1]});assert.equal(calls,0);
 now=900001;const first=get('2026-10-26');await Promise.resolve();
 now+=900001;const second=get('2026-10-26');assert.equal(calls,1);
 release({games:[2]});assert.deepEqual(await first,await second);
 await get('2026-10-26');assert.equal(calls,1);
});
test('failed slate reload is not cached as a valid matchup',async()=>{
 let calls=0;const get=createSlateCache(async()=>{if(++calls===1)throw Error('unavailable');return {games:[2]};});
 await assert.rejects(get('2026-10-26'),/unavailable/);assert.deepEqual(await get('2026-10-26'),{games:[2]});assert.equal(calls,2);
});

test('adding other dates cannot evict an in-flight provider request',async()=>{
 let calls=0,release;
 const get=createSlateCache(()=>{calls++;return new Promise(resolve=>release=resolve);},{maxEntries:1});
 const first=get('2026-10-26');await Promise.resolve();
 get.remember('2026-10-27',{games:[3]});
 const duplicate=get('2026-10-26');assert.equal(calls,1);
 release({games:[1]});assert.deepEqual(await first,await duplicate);
});
