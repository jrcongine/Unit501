'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {positiveId}=require('../provider-id');
const {normalizeGame,createNBAFeed}=require('../nba-feed');
const {convert:publicNBA}=require('../nba-public');
const {convert:college}=require('../ncaab-feed');
const {reconcileGames}=require('../football-schedule-integrity');
const bad=[true,false,[1],{value:1},null,undefined,'',' ','1e2','0x10','1.5',1.5,-1,0,Infinity,NaN,Number.MAX_SAFE_INTEGER+1];
const game=()=>({id:100,league:'standard',season:2026,stage:2,date:{start:'2026-10-30T23:00Z'},status:{short:1},teams:{visitors:{id:1,name:'Away'},home:{id:2,name:'Home'}}});
const event=()=>({id:'100',date:'2026-10-30T23:00Z',timeValid:true,season:{year:2027,type:2},competitions:[{timeValid:true,status:{type:{state:'pre',name:'STATUS_SCHEDULED'}},competitors:[{homeAway:'away',team:{id:'1',displayName:'Away'}},{homeAway:'home',team:{id:'2',displayName:'Home'}}]}]});
test('provider IDs accept integer numbers and decimal digit strings only',()=>{
 for(const value of bad)assert.equal(positiveId(value),null,String(value));
 for(const value of [1,'1',100,'100',Number.MAX_SAFE_INTEGER])assert.equal(positiveId(value),Number(value));
});
test('NBA normalized identities and status cannot be fabricated through coercion',()=>{
 for(const value of bad){
  assert.equal(normalizeGame({...game(),id:value}),null);
  assert.equal(normalizeGame({...game(),status:{short:value}}),null);
  if(value!=null){const g=game();g.teams.visitors.id=value;assert.equal(normalizeGame(g),null);assert.equal(normalizeGame({...game(),stage:value}),null);}
 }
 const same=game();same.teams.home.id=1;assert.equal(normalizeGame(same),null);
 const g=game();g.id='100';g.teams.visitors.id='1';g.stage='2';g.status.short='1';assert.equal(normalizeGame(g).id,100);
});
test('public NBA and college feeds reject malformed event and team IDs before normalization',()=>{
 for(const convert of [e=>publicNBA(e,2026),college]){
  assert.ok(convert(event()));
  for(const value of bad){
   const e=event();e.id=value;assert.equal(convert(e),null);
   const t=event();t.competitions[0].competitors[0].team.id=value;assert.equal(convert(t),null);
   const s=event();s.season.type=value;assert.equal(convert(s),null);
  }
 }
});
test('NBA slates fail closed on explicitly wrong league or season without caching partial results',async()=>{
 for(const patch of [{league:'africa'},{league:''},{season:2025},{season:true},{season:[2026]}]){
  const get=createNBAFeed({key:()=> 'fixture',fetcher:async()=>({ok:true,json:async()=>({response:[game(),{...game(),id:101,...patch}],errors:[]})})});
  await assert.rejects(get('2026-10-30'),/league or season mismatch/);
 }
});
test('football schedule reconciliation rejects coerced IDs while keeping normal strings',()=>{
 for(const id of bad)assert.throws(()=>reconcileGames([{game:{id}}]),/identity/);
 assert.equal(reconcileGames([{game:{id:'123'}}]).length,1);
});
