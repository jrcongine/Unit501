'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {verify}=require('../runtime-verification');
const password='test-private-password-only';
test('runtime verification authenticates only loopback assets and saved health without logging secrets',async()=>{
 const calls=[];const r=await verify({port:8080,password,commit:'a'.repeat(40),readFile:async()=>'<safe asset>',fetcher:async(url,opts)=>{
  calls.push(url);assert.equal(opts.headers.Authorization,'Basic '+Buffer.from('jr:'+password).toString('base64'));assert.equal(opts.redirect,'error');
  return {ok:true,text:async()=>'<safe asset>',json:async()=>({marketGradesVersion:1,configured:true,groups:[],footballUsage:{recentDays:[]},feeds:[{id:'nba:props',status:'partial',secret:password},{id:'nfl:injuries',status:'stale'},{id:password,status:'working'},{id:'nba:context',status:password}]})};
 }});
 assert.equal(r.status,'verified');assert.equal(r.footballUsageHistory,'read');assert.equal(r.footballLearning,'configured');assert.equal(r.basketballLearning,'configured');assert.equal(r.basketballMarketGrades,0);assert.equal(calls.length,26);assert.ok(calls.includes('http://127.0.0.1:8080/player-stats.js'));assert.ok(calls.every(u=>u.startsWith('http://127.0.0.1:8080/')));
 assert.deepEqual(r.feeds,[{id:'nba:props',status:'partial'},{id:'nfl:injuries',status:'stale'}]);assert(!JSON.stringify(r).includes(password));
});
test('runtime verification fails closed on missing auth, mismatched assets and failed health',async()=>{
 let calls=0;const fetcher=async()=>{calls++;throw Error(password);};
 assert.equal((await verify({port:8080,password:'short',fetcher})).status,'skipped');assert.equal(calls,0);
 const failed=await verify({port:8080,password,fetcher});assert.equal(failed.status,'partial');assert(!JSON.stringify(failed).includes(password));
 const changed=await verify({port:8080,password,readFile:async()=>'expected',fetcher:async()=>({ok:true,text:async()=>'wrong',json:async()=>({feeds:[]})})});assert.ok(changed.assets.every(a=>a.status==='mismatch'));
});
