'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {match,refresh}=require('../public/forecast-results');
const archive=require('../public/forecast-archive');
const {compare}=require('../injury-backtest');
function fixture(){
 const game={id:'9',league:'1',season:'2026',awayId:'1',homeId:'2',kickoff:100000};
 const rec={gameId:'9',league:'1',season:'2026',teamId:'1',kickoff:100000,forecastAt:90000,inputAsOf:80000,kind:'score',market:'points',baseline:25,adjusted:20,actual:null,resultKnownAt:null,modelVersion:'v1',evidenceUrl:'https://example.org/archive'};
 const snapshot={schema:1,forecastAt:90000,game,records:[rec]};
 const games={response:[{league:{id:1,season:2026},game:{id:9,date:{timestamp:100},status:{short:'FT'}},teams:{away:{id:1},home:{id:2}},scores:{away:{total:19},home:{total:22}}}]};
 return {snapshot,games};
}
test('only exact confirmed final games settle scores and become eligible comparison pairs',()=>{
 const {snapshot,games}=fixture(),s=match(snapshot,games,null,200000);
 assert.equal(s.matched,1);assert.equal(s.snapshot.records[0].actual,19);assert.equal(snapshot.records[0].actual,null);
 assert.equal(compare(s.snapshot.records).accepted,1);
 for(const edit of [g=>g.game.status.short='Q4',g=>g.game.date.timestamp=101,g=>g.teams.away.id=3,g=>g.league.season=2025]){
  const bad=structuredClone(games);edit(bad.response[0]);assert.equal(match(snapshot,bad,null,200000).matched,0);
 }
 assert.equal(match(snapshot,{response:[...games.response,...games.response]},null,200000).matched,0);
 assert.equal(match(snapshot,{...games,errors:{quota:'exceeded'}},null,200000).matched,0);
 assert.equal(match(snapshot,games,null,100000).matched,0);
});
test('props match exact team/player/market; missing or duplicate stats never become zeros',()=>{
 const {snapshot,games}=fixture();snapshot.kind='prop';Object.assign(snapshot.records[0],{kind:'prop',playerId:'7',market:'rushYds'});
 const boxes={response:[{team:{id:1},groups:[{name:'Rushing',players:[{player:{id:7},statistics:[{name:'Yards',value:'-3'}]}]}]}]};
 assert.equal(match(snapshot,games,boxes,200000).snapshot.records[0].actual,-3);
 const zero=structuredClone(boxes);zero.response[0].groups[0].players[0].statistics[0].value=0;
 assert.equal(match(snapshot,games,zero,200000).snapshot.records[0].actual,0);
 for(const edit of [b=>b.response[0].team.id=2,b=>b.response[0].groups[0].players[0].player.id=8,b=>b.response[0].groups[0].players=[],b=>b.response.push(b.response[0]),b=>b.response[0].groups[0].players.push(b.response[0].groups[0].players[0]),b=>b.response[0].groups[0].players[0].statistics.push({name:'Yards',value:4})]){
  const bad=structuredClone(boxes);edit(bad);assert.equal(match(snapshot,games,bad,200000).snapshot.records[0].actual,null);
 }
});
test('result refresh preserves forecasts added while network requests are pending',async()=>{
 const {snapshot,games}=fixture();const data=new Map([[archive.key,JSON.stringify({schema:1,snapshots:[snapshot]})]]);
 const storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};
 let release;const task=refresh(storage,()=>new Promise(resolve=>{release=resolve;}),()=>200000);
 const newer={...snapshot,game:{...snapshot.game,id:'10'},forecastAt:91000};
 const saved=archive.read(storage);saved.snapshots.push(newer);storage.setItem(archive.key,JSON.stringify(saved));
 release(games);const result=await task;
 assert.equal(result.matched,1);assert.equal(archive.read(storage).snapshots.length,2);assert.equal(archive.read(storage).snapshots[1].game.id,'10');
});
test('different forecast models can be compared in separate markets, never mixed within a market',()=>{
 const {snapshot}=fixture(),score=snapshot.records[0];Object.assign(score,{actual:19,resultKnownAt:200000});
 const prop={...score,kind:'prop',market:'rec',playerId:'7',modelVersion:'prop-v1',actual:3,baseline:5,adjusted:4};
 const out=compare([score,prop]);assert.equal(out.accepted,2);assert.equal(out.props['1'].rec.pairs,1);
 const mixed=compare([score,prop,{...prop,gameId:'10',modelVersion:'prop-v2'}]);assert.equal(mixed.accepted,1);assert.equal(mixed.skips.version,2);
});

test('matching preserves general and selected snapshots sharing the same forecast timestamp',async()=>{
 const {snapshot,games}=fixture();
 const pick=structuredClone(snapshot);pick.selection={market:'spread',direction:'away',line:3.5,price:-110,selectedAt:95000};
 const data=new Map([[archive.key,JSON.stringify({schema:1,snapshots:[snapshot,pick]})]]);
 const storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};
 await refresh(storage,async()=>games,()=>200000);
 const saved=archive.read(storage).snapshots;
 assert.equal(saved[0].selection,undefined);assert.equal(saved[1].selection.price,-110);
 assert.equal(saved[0].records[0].actual,19);assert.equal(saved[1].records[0].actual,19);
});

test('automatic result checks wait for kickoff, throttle retries, and skip fully graded archives',()=>{
 const {autoRefreshDue}=require('../public/forecast-results');
 const {snapshot}=fixture(),data={snapshots:[snapshot]},now=1000000;
 assert.equal(autoRefreshDue(data,0,now),true);
 assert.equal(autoRefreshDue(data,now-299999,now),false);
 assert.equal(autoRefreshDue(data,now-300000,now),true);
 snapshot.game.kickoff=now;assert.equal(autoRefreshDue(data,0,now),false);
 snapshot.game.kickoff=100000;snapshot.records[0].actual=0;
 assert.equal(autoRefreshDue(data,0,now),false);
 snapshot.records[0].actual=null;assert.equal(autoRefreshDue(data,0,now),true);
 assert.equal(autoRefreshDue({snapshots:[]},0,now),false);
});

function savedStorage(snapshots){
 const data=new Map([[archive.key,JSON.stringify({schema:1,snapshots})]]);
 return {getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};
}
test('automatic grading skips settled games and persists hourly retries for missing results',async()=>{
 const {snapshot}=fixture(),settled=structuredClone(snapshot);
 settled.game={...settled.game,id:'10',kickoff:1};settled.records[0].actual=0;
 const storage=savedStorage([settled,snapshot]);let calls=0,clock=1000000;
 const request=async()=>{calls++;return {response:[]}};
 await refresh(storage,request,()=>clock,{automatic:true});assert.equal(calls,1);
 assert.deepEqual(archive.read(storage).snapshots[0],settled);
 // A new refresh invocation uses persisted state, including after page reload.
 clock+=300000;await refresh(storage,request,()=>clock,{automatic:true});assert.equal(calls,1);
 assert.equal(require('../public/forecast-results').autoRefreshDue(archive.read(storage),0,clock),false);
 clock+=3300000;await refresh(storage,request,()=>clock,{automatic:true});assert.equal(calls,2);
});
test('failed automatic requests back off but manual result refresh remains available',async()=>{
 const {snapshot,games}=fixture(),storage=savedStorage([snapshot]);let calls=0;
 const request=async()=>{calls++;throw Error('unavailable')};
 await refresh(storage,request,()=>1000000,{automatic:true});
 await refresh(storage,request,()=>1300000,{automatic:true});assert.equal(calls,1);
 await refresh(storage,async()=>{calls++;return games},()=>1300001);
 assert.equal(calls,2);assert.equal(archive.read(storage).snapshots[0].records[0].actual,19);
});
test('automatic partial grading retains settled prop evidence without requesting its box score',async()=>{
 const {snapshot,games}=fixture();
 snapshot.records.push({...snapshot.records[0],kind:'prop',market:'rec',playerId:'7',actual:3,resultKnownAt:150000,resultStat:{value:3}});
 const known=structuredClone(snapshot.records[1]),storage=savedStorage([snapshot]),urls=[];
 await refresh(storage,async url=>{urls.push(url);return games},()=>1000000,{automatic:true});
 assert.equal(urls.length,1);assert.match(urls[0],/^\/api\/games\?/);
 assert.deepEqual(archive.read(storage).snapshots[0].records[1],known);
 assert.equal(archive.read(storage).snapshots[0].records[0].actual,19);
});
