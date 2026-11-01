'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {verify}=require('../runtime-verification');
const password='test-private-password-only';
test('runtime verification authenticates only loopback assets and saved health without logging secrets',async()=>{
 const calls=[];const r=await verify({port:8080,password,commit:'a'.repeat(40),readFile:async()=>'<safe asset>',fetcher:async(url,opts)=>{
  calls.push(url);assert.equal(opts.headers.Authorization,'Basic '+Buffer.from('jr:'+password).toString('base64'));assert.equal(opts.redirect,'error');
  return {ok:true,text:async()=>'<safe asset>',json:async()=>({playerProps:{configured:true,groups:url.includes("/football/")?[{captured:5,pending:2,unverified:0,win:1,loss:0,push:0,noLean:1,dnp:1}]:[]},marketGradesVersion:1,configured:true,groups:[],footballUsage:{recentDays:[]},feeds:[{id:'nba:props',status:'partial',secret:password},{id:'nfl:injuries',status:'stale'},{id:password,status:'working'},{id:'nba:context',status:password}]})};
 }});
 assert.equal(r.footballPropReview.captured,5);assert.equal(r.footballPropReview.pending,2);assert.equal(r.footballPropGrades,1);assert.equal(r.basketballPropReview.captured,0);
 assert.equal(r.status,'partial');assert.equal(r.assetStatus,'verified');assert.equal(r.savedFeedCoverage,'incomplete');assert.equal(r.footballUsageHistory,'read');assert.equal(r.footballLearning,'configured');assert.equal(r.basketballLearning,'configured');assert.equal(r.basketballMarketGrades,0);assert.equal(calls.length,30);assert.ok(calls.includes('http://127.0.0.1:8080/player-stats.js'));assert.ok(calls.every(u=>u.startsWith('http://127.0.0.1:8080/')));
 assert.equal(r.feeds.length,24);assert.equal(r.feeds.find(f=>f.id==='nba:props').status,'partial');assert.equal(r.feeds.find(f=>f.id==='nfl:injuries').status,'stale');assert.equal(r.feeds.find(f=>f.id==='ncaab:odds').status,'unchecked');assert(!JSON.stringify(r).includes(password));
});
test('runtime verification fails closed on missing auth, mismatched assets and failed health',async()=>{
 let calls=0;const fetcher=async()=>{calls++;throw Error(password);};
 assert.equal((await verify({port:8080,password:'short',fetcher})).status,'skipped');assert.equal(calls,0);
 const failed=await verify({port:8080,password,fetcher});assert.equal(failed.status,'partial');assert(!JSON.stringify(failed).includes(password));
 const changed=await verify({port:8080,password,readFile:async()=>'expected',fetcher:async()=>({ok:true,text:async()=>'wrong',json:async()=>({feeds:[]})})});assert.ok(changed.assets.every(a=>a.status==='mismatch'));
});

test('saved feed coverage requires every league, including schedule and odds, with source timestamps',async()=>{
 const rows=['nfl','ncaaf','nba','ncaab'].flatMap(s=>['games','odds','props','injuries','context','player-history'].map(k=>({id:s+':'+k,status:'working',sourceAt:'2026-11-01T12:00:00Z'})));
 const run=()=>verify({port:8080,password,readFile:async()=>'asset',fetcher:async()=>({ok:true,text:async()=>'asset',json:async()=>({feeds:rows})})});
 assert.equal((await run()).savedFeedCoverage,'working');
 rows[0].sourceAt=null;
 assert.equal((await run()).savedFeedCoverage,'incomplete');
 rows[0].sourceAt=rows[1].sourceAt;
 rows.push({...rows[1]});
 assert.equal((await run()).feeds.find(f=>f.id===rows[1].id).status,'unchecked');
});
