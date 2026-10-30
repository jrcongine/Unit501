'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createNBAFeed,inferSeason}=require('../nba-feed');
const {createPublicNBA}=require('../nba-public');
function primary(id,date){return {id,league:'standard',season:inferSeason(date.slice(0,10)),stage:2,date:{start:date},status:{short:1},teams:{visitors:{id:1,name:'Away'},home:{id:2,name:'Home'}}};}
function publicEvent(id,date,season){return {id:String(id),season:{year:season+1,type:2},date,competitions:[{date,status:{type:{state:'pre',name:'STATUS_SCHEDULED'}},competitors:[{homeAway:'away',team:{id:'1',displayName:'Away'}},{homeAway:'home',team:{id:'2',displayName:'Home'}}]}]};}
for(const source of ['primary','public']){
 function adapter(date,fetcher){return source==='primary'?createNBAFeed({key:()=> 'test',fetcher}):createPublicNBA({fetcher}).games;}
 function response(date,rows){return {ok:true,json:async()=>source==='primary'?{response:rows.map(([id,at])=>primary(id,at)),errors:[]}:{leagues:[{slug:'nba'}],events:rows.map(([id,at])=>publicEvent(id,at,inferSeason(date)))}};}
 test(source+' NBA slate includes the whole Central day across UTC midnight and DST',async()=>{
  for(const [date,next,start,end] of [['2026-10-30','2026-10-31','05','05'],['2026-11-01','2026-11-02','05','06'],['2027-03-14','2027-03-15','06','05'],['2026-12-31','2027-01-01','06','06']]){
   const calls=[],early=new Date(Date.parse(date+'T'+start+':00Z')-1).toISOString(),late=new Date(Date.parse(next+'T'+end+':00Z')-1).toISOString();
   const get=adapter(date,async url=>{calls.push(url);return response(date,url.includes(next.replaceAll('-',''))||url.includes('date='+next)?[[3,late],[4,next+'T'+end+':00Z'],[2,date+'T23:00Z']]:[[1,early],[2,date+'T23:00Z']]);});
   const result=await get(date);assert.deepEqual(result.games.map(g=>Number(g.id)),[2,3]);assert.equal(calls.length,2);
   await get(date);assert.equal(calls.length,2);
  }
 });
 test(source+' NBA rejects partial day failures and conflicting duplicate IDs',async()=>{
  const date='2026-10-30';let calls=0;
  const get=adapter(date,async()=>{if(++calls===2)return {ok:false,status:503};return response(date,[[1,date+'T23:00Z']]);});
  await assert.rejects(get(date));
  calls=0;const conflict=adapter(date,async()=>response(date,[[1,++calls===1?date+'T23:00Z':'2026-10-31T01:00Z']]));
  await assert.rejects(conflict(date),/conflicting/);
 });
 test(source+' NBA does not silently drop malformed games from a nonempty slate',async()=>{
  const date='2026-10-30';const get=adapter(date,async()=>{const r=response(date,[[1,date+'T23:00Z']]),data=await r.json();(data.response||data.events).push({id:999});return {ok:true,json:async()=>data};});
  await assert.rejects(get(date),/incomplete/);
 });
}
