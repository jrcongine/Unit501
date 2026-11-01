'use strict';
const test=require('node:test'),a=require('node:assert/strict');
const {compareHook,createHook}=require('../hook-quotes'),{describe}=require('../public/buy-the-hook');
const now=Date.parse('2026-11-01T18:00:00Z'),ts=new Date(now).toISOString(),tipoff=new Date(now+3600000).toISOString();
const row=(name,point,price)=>({name,point,price});
const event=()=>({id:'evt',sport_key:'basketball_nba',away_team:'A',home_team:'B',commence_time:tipoff,bookmakers:[{key:'fanduel',markets:[
 {key:'spreads',last_update:ts,outcomes:[row('A',2.5,-110),row('B',-2.5,-110)]},
 {key:'alternate_spreads',last_update:ts,outcomes:[row('A',3,-130),row('B',-3,110),row('B',-2,105),row('A',2,-125)]}
]}]});
test('half point comparison uses actual paired prices and grades integer margins',()=>{
 const rows=compareHook(event(),now);a.equal(rows.length,2);a.match(describe(rows[0],'nba')[1],/9.09 → \$7.69/);
 a.match(describe(rows[0],'nba')[2],/loses by 3: loss → push/);
 a.match(describe({...rows[0],line:-3,better:-2.5},'1')[2],/wins by 3: push → win/);
 a.match(describe({...rows[0],line:0,better:.5},'nba')[2],/settle the same/);
});
test('missing opposite, duplicate sides, stale or out-of-sync markets cannot produce a pair',()=>{
 const e=event(),m=e.bookmakers[0].markets[1];m.outcomes.splice(1,1);a.equal(compareHook(e,now).length,1);m.outcomes.push(m.outcomes[1]);a.equal(compareHook(e,now).length,0);
 const stale=event();stale.bookmakers[0].markets[1].last_update=new Date(now-301000).toISOString();a.deepEqual(compareHook(stale,now),[]);
});
test('lookup checks the event again, handles neutral college orientation and shares cached requests',async()=>{
 const e=event();e.sport_key='basketball_ncaab';let calls=0;const q={league:'ncaab',home:'A',away:'B',neutral:true,tipoff};
 const hook=createHook({key:()=>'fixture',now:()=>now,fetcher:async url=>{calls++;return {ok:true,json:async()=>url.includes('/odds?')?e:[e]};}});
 const results=await Promise.all([hook(q),hook(q)]);a.equal(calls,2);a.equal(results[0][0].team,'B');a.equal(results[0][0].line,-2.5);
 a.deepEqual(await hook({...q,neutral:false}),[]);
});
test('numeric live football quote timestamps reach the slate spread history',()=>{
 const {createHistory,footballTarget}=require('../line-history');const h=createHistory({now:()=>now});
 h.capture(footballTarget({league:'1',away:'A',home:'B',kickoff:now+3600000},'game'),{awaySpread:3,spreadUpdated:now});
 a.equal(h.slateSpreads('1')[0].line,3);
});
