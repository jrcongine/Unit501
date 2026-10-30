'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {convert,summarize,createNCAAB}=require('../ncaab-feed');
function event(id,at,{status='Final',timeKnown=true,away=1,home=2,scoreA=70,scoreH=65,stage=2}={}){return {id:String(id),date:at,timeValid:timeKnown,season:{year:2027,type:stage},seasonType:{type:stage},competitions:[{date:at,timeValid:timeKnown,neutralSite:false,status:{type:{state:status==='Final'?'post':'pre',completed:status==='Final',name:status==='Final'?'STATUS_FINAL':'STATUS_SCHEDULED'}},competitors:[{homeAway:'away',team:{id:String(away),displayName:'Away'},score:{value:scoreA}},{homeAway:'home',team:{id:String(home),displayName:'Home'},score:{value:scoreH}}]}]};}
const selected=convert(event(10,'2026-11-04T01:00:00Z',{status:'Scheduled'}));
test('college conversion does not treat scheduled zero scores or TBD tipoffs as confirmed',()=>{
 const g=convert(event(1,'2026-11-04T01:00:00Z',{status:'Scheduled',timeKnown:false,scoreA:0,scoreH:0}));
 assert.equal(g.timeKnown,false);assert.equal(g.awayScore,null);assert.equal(g.homeScore,null);
 const unknown=event(4,'2026-11-04T01:00:00Z',{status:'Scheduled'});delete unknown.timeValid;delete unknown.competitions[0].timeValid;assert.equal(convert(unknown).timeKnown,false);
 assert.equal(convert({...event(1,'2026-11-04T01:00:00Z'),competitions:[]}),null);
});
test('college form excludes future, same-game, unverified scores and conflicting duplicates',()=>{
 const a=event(1,'2026-10-28T01:00:00Z'),b=event(2,'2026-10-29T01:00:00Z'),future=event(3,'2026-11-05T01:00:00Z');
 const x=summarize([a,b,a,future], '1', selected,Date.parse('2026-11-03T20:00:00Z'));assert.equal(x.games,2);assert.equal(x.season.scored,70);
 const conflict=event(1,'2026-10-28T01:00:00Z',{scoreA:90});const y=summarize([a,conflict,b],'1',selected,Date.parse('2026-11-03T20:00:00Z'));assert.equal(y.games,1);assert.equal(y.conflicts,1);
});
test('college slate uses Central game dates, keeps TBD on requested date, and caches source',async()=>{
 let calls=0;const slateA=event(1,'2026-11-04T01:00:00Z',{status:'Scheduled'}),tbd=event(2,'2026-11-03T05:00:00Z',{status:'Scheduled',timeKnown:false}),slateNext=event(3,'2026-11-04T05:30:00Z',{status:'Scheduled'});
 const feed=createNCAAB({now:()=>1000,fetcher:async url=>{calls++;return {ok:true,json:async()=>({leagues:[{slug:'mens-college-basketball'}],events:String(url).includes('20261103')?[slateA,tbd]:[slateA,slateNext]})};}});
 const out=await feed.games('2026-11-03');assert.deepEqual(out.games.map(g=>g.id),['1','3','2']);assert.equal(out.games[2].timeKnown,false);
 await feed.games('2026-11-03');assert.equal(calls,2);
});
test('college history verifies team identity and never supplies TBD predictions',async()=>{
 const feed=createNCAAB({now:()=>Date.parse('2026-11-03T20:00:00Z'),fetcher:async url=>({ok:true,json:async()=>({team:{id:new URL(url).pathname.split('/').at(-2)},events:[event(1,'2026-10-28T01:00:00Z')]})})});
 const data=await feed.context(selected);assert.equal(data.away.games,1);assert.equal(data.home.games,1);
 await assert.rejects(feed.context({...selected,timeKnown:false}),/tipoff/);
});

test('missing or malformed college scores remain unknown and do not enter team form',()=>{
 for(const value of [null,undefined,'','   ',false,true,[],{},'unavailable',70.5]){
  const row=event(20,'2026-10-28T01:00:00Z',{scoreA:null});row.competitions[0].competitors[0].score={value};
  assert.equal(convert(row).awayScore,null);
  assert.equal(summarize([row],'1',selected,Date.parse('2026-11-03T20:00:00Z')).games,0);
 }
 for(const value of [0,'0',70,' 70 '])assert.equal(convert(event(21,'2026-10-28T01:00:00Z',{scoreA:value})).awayScore,Number(value));
});

test('unverified completed college games remain visible as history gaps',()=>{
 const bad=event(2,'2026-10-29T01:00:00Z',{scoreA:null}),good=event(1,'2026-10-28T01:00:00Z');
 const r=summarize([good,bad],'1',selected,Date.parse('2026-11-03T20:00:00Z'));
 assert.equal(r.games,1);assert.equal(r.unverifiedGames,1);
});

test('college slate records use only an unambiguous overall record and retain cache timestamps',async()=>{
 const e=event(1,'2026-11-04T01:00:00Z',{status:'Scheduled'}),rows=e.competitions[0].competitors;
 rows[0].records=[{name:'overall',type:'total',summary:'4-1'},{name:'Home',type:'home',summary:'2-0'}];rows[1].records=[{name:'overall',type:'total',summary:'3-2'}];
 assert.equal(convert(e).awayRecord,'4-1');assert.equal(convert(e).homeRecord,'3-2');
 for(const records of [[{name:'Home',type:'home',summary:'2-0'}],[{name:'overall',type:'total',summary:'4-1'},{name:'overall',type:'total',summary:'3-1'}],[{name:'overall',type:'home',summary:'2-0'}],[{name:'overall',type:'total',summary:'unknown'}]]){
  const bad=structuredClone(e);bad.competitions[0].competitors[0].records=records;assert.equal(convert(bad).awayRecord,null);
 }
 let clock=1000;const feed=createNCAAB({now:()=>clock,fetcher:async()=>({ok:true,json:async()=>({leagues:[{slug:'mens-college-basketball'}],events:[e]})})});
 assert.equal((await feed.games('2026-11-03')).checkedAt,1000);clock=2000;assert.equal((await feed.games('2026-11-03')).checkedAt,1000);
});

test('a mixed valid and malformed college slate fails instead of silently omitting a game',async()=>{
 const good=event(1,'2026-11-04T01:00:00Z',{status:'Scheduled'}),bad={...good,id:'2',competitions:[]};
 const feed=createNCAAB({fetcher:async()=>({ok:true,json:async()=>({leagues:[{slug:'mens-college-basketball'}],events:[good,bad]})})});
 await assert.rejects(feed.games('2026-11-03'),/complete slate unavailable/);
});
