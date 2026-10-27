'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');
const {createComparison}=require('../football-comparison');
test('football comparison matches game, checks freshness, caches and stops at kickoff',async()=>{
 let now=Date.parse('2026-10-27T12:00:00Z'),calls=0;
 const q={league:'1',away:'Chicago Bears',home:'Green Bay Packers',kickoff:now+3600000};
 const event={away_team:q.away,home_team:q.home,commence_time:new Date(q.kickoff).toISOString(),bookmakers:[{key:'fanduel',markets:[{key:'h2h',last_update:new Date(now).toISOString(),outcomes:[{name:q.away,price:120},{name:q.home,price:-140}]},{key:'totals',last_update:new Date(now-2000000).toISOString(),outcomes:[{name:'Over',point:43.5,price:-110},{name:'Under',point:43.5,price:-110}]}]}]};
 const get=createComparison({now:()=>now,key:()=> 'test',fetcher:async()=>{calls++;return {ok:true,headers:new Headers(),json:async()=>[event]};}});
 const result=await get(q);assert.equal(result.books[0].moneyline.away,120);assert.equal(result.books[0].total,null);assert.equal(result.books[1].moneyline,null);
 await get(q);assert.equal(calls,1);const miss=await get({...q,home:'Other'});assert.equal(miss.available,false);
 now=q.kickoff;assert.equal((await get(q)).available,false);assert.equal(calls,1);
});
