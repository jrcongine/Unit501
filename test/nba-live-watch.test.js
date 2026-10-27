'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createLiveWatch}=require('../nba-live-watch');
test('live watch includes previous Central date after midnight without accessing a paid feed',async()=>{
 const now=Date.parse('2026-10-27T06:30:00Z'),calls=[];
 const watch=createLiveWatch({now:()=>now,publicFeed:{games:async date=>{calls.push(date);return {checkedAt:new Date(now).toISOString(),games:[{id:date}]};}}});
 const result=await watch();assert.deepEqual(calls,['2026-10-27','2026-10-26']);assert.equal(result.games.length,2);
});
test('daytime watch reads only today and rejects stale or incomplete scoreboards',async()=>{
 const now=Date.parse('2026-10-27T20:00:00Z');let calls=0,checkedAt=new Date(now).toISOString();
 const watch=createLiveWatch({now:()=>now,publicFeed:{games:async()=>{calls++;return {checkedAt,games:[]};}}});
 assert.equal((await watch()).games.length,0);assert.equal(calls,1);
 for(const stamp of [null,'bad',new Date(now-180001).toISOString(),new Date(now+60001).toISOString()]){
  checkedAt=stamp;await assert.rejects(watch(),/Stale/);
 }
});
