'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {pickAlert,createWatch}=require('../nba-comeback-watch');
const sample=()=>({id:432,league:'standard',status:{short:2,halftime:false,clock:'03:14'},periods:{current:2,endOfPeriod:false},teams:{visitors:{name:'Philadelphia 76ers'},home:{name:'Cleveland Cavaliers'}},scores:{visitors:{points:40},home:{points:69}}});
test('fires for a 20+ point deficit in Q1 or Q2, with the losing team correctly named',()=>{
  const a=pickAlert(sample());
  assert.equal(a.trailing,'Philadelphia 76ers');
  assert.equal(a.deficit,29);assert.equal(a.leading,'Cleveland Cavaliers');assert.equal(a.period,2);
  const q1=sample();q1.periods.current=1;q1.scores.home.points=60;assert.equal(pickAlert(q1).deficit,20);
  q1.periods.endOfPeriod=true;assert.equal(pickAlert(q1).deficit,20,'end of first quarter is still before halftime');
  const homeBehind=sample();homeBehind.scores.home.points=15;assert.equal(pickAlert(homeBehind).trailing,'Cleveland Cavaliers');
});
test('no alert if lead is smaller, at halftime, in second half, or game not live',()=>{
  const x=sample();x.scores.home.points=59;assert.equal(pickAlert(x),null);
  x.scores.home.points=69;x.status.halftime=true;assert.equal(pickAlert(x),null);
  x.status.halftime=false;x.periods.current=3;assert.equal(pickAlert(x),null);
  x.periods.current=2;x.periods.endOfPeriod=true;assert.equal(pickAlert(x),null);
  x.periods.endOfPeriod=false;x.status.clock='00:00';assert.equal(pickAlert(x),null);
  x.status.clock='01:02';x.status.short=3;assert.equal(pickAlert(x),null);
});
test('unknown scores, identities, quarter or league never trigger an alert',()=>{
  for(const modify of [
    x=>{x.scores.visitors.points=null;},x=>{x.scores.home.points='';},
    x=>{x.teams.home.name='';},x=>{x.id=null;},x=>{x.periods.current=null;},
    x=>{x.league='other';}
  ]){const x=sample();modify(x);assert.equal(pickAlert(x),null);}
});
test('watch shares 85-second cache, limits requests and never fabricates missing results',async()=>{
  let t=1700000000000,calls=0;
  const fetcher=async url=>{assert.match(url,/\/games\?live=all$/);calls++;return {ok:true,json:async()=>({response:[sample()]})};};
  const watch=createWatch({fetcher,now:()=>t,key:()=> 'test-key',maxRequests:2,ttl:85000});
  assert.equal((await watch()).alerts[0].deficit,29);assert.equal((await watch()).cached,true);
  assert.equal(calls,1);
  t+=86000;await watch();assert.equal(calls,2);
  t+=86000;const exhausted=await watch();assert.equal(exhausted.available,false);assert.deepEqual(exhausted.alerts,[]);assert.equal(calls,2);
});
test('provider failures do not emit false positive alerts or expose credentials',async()=>{
  const watch=createWatch({fetcher:async()=>({ok:false,status:429}),key:()=> 'secret'});
  await assert.rejects(watch(),/429/);
  const noKey=createWatch({key:()=>null});
  const result=await noKey();assert.equal(result.available,false);assert.deepEqual(result.alerts,[]);
});
