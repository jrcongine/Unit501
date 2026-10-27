'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createNBATravel}=require('../nba-travel');
const now=Date.parse('2026-10-26T20:00:00Z');
const match={id:999,provider:'espn',statusCode:1,away:'Chicago Bulls',home:'Boston Celtics',awayId:4,homeId:2,stage:2,tipoff:'2026-10-26T23:30:00Z'};
const prevA={id:100,tipoff:'2026-10-24T23:30:00Z',opponentId:10,venue:'away'};
const prevH={id:101,tipoff:'2026-10-24T22:00:00Z',opponentId:11,venue:'home'};
function make(){
 const publicFeed={games:async()=>({season:2026,games:[match]}),context:async()=>({away:{id:4,rest:{available:true,previousTipoff:prevA.tipoff},recentGames:[prevA]},home:{id:2,rest:{available:true,previousTipoff:prevH.tipoff},recentGames:[prevH]}})};
 const records={999:{...match,city:'Boston',state:'MA'},100:{id:100,tipoff:prevA.tipoff,awayId:4,homeId:10,stage:2,city:'Chicago',state:'IL'},101:{id:101,tipoff:prevH.tipoff,awayId:11,homeId:2,stage:2,city:'Boston',state:'MA'}};
 let calls=0;
 const fetcher=async url=>{calls++;const u=new URL(url);let data;
  if(u.pathname.includes('/summary')){const g=records[u.searchParams.get('event')];data={header:{id:String(g.id),season:{year:2027,type:2},competitions:[{date:g.tipoff,competitors:[{id:String(g.awayId),homeAway:'away'},{id:String(g.homeId),homeAway:'home'}]}]},gameInfo:{venue:{fullName:g.city+' Arena',address:{city:g.city,state:g.state}}}};}
  else {const city=u.searchParams.get('name');data={results:[{name:city,admin1:city==='Boston'?'Massachusetts':'Illinois',country_code:'US',latitude:city==='Boston'?42:41,longitude:city==='Boston'?-71:-87}]};}
  return {ok:true,json:async()=>data};};
 return {publicFeed,fetcher,records,calls:()=>calls};
}
test('NBA travel compares verified previous game cities and caches shared requests',async()=>{
 const f=make(),get=createNBATravel({...f,now:()=>now});const result=await get(match,'2026-10-26',2026);
 assert.equal(result.away.available,true);assert.ok(result.away.miles>700);assert.equal(result.home.miles,0);
 assert.equal(result.away.previousCity,'Chicago');const calls=f.calls();await get(match,'2026-10-26',2026);assert.equal(f.calls(),calls);
});
test('unverified NBA games and unknown previous schedules do not invent travel',async()=>{
 const f=make();f.records[100].awayId=99;const get=createNBATravel({...f,now:()=>now});
 const result=await get(match,'2026-10-26',2026);assert.equal(result.away.available,false);assert.equal(result.home.available,true);
 await assert.rejects(get({...match,home:'New York Knicks'},'2026-10-26',2026),/matchup/);
 await assert.rejects(get({...match,statusCode:2},'2026-10-26',2026),/Pregame/);
});
test('Brooklyn may use verified New York city-center coordinates when borough lookup is absent',async()=>{
 const f=make();f.records[100].city='Brooklyn';f.records[100].state='NY';const base=f.fetcher;
 const get=createNBATravel({publicFeed:f.publicFeed,now:()=>now,fetcher:async url=>{
  const u=new URL(url);if(u.hostname==='geocoding-api.open-meteo.com'){
   const city=u.searchParams.get('name');if(city==='Brooklyn')return {ok:true,json:async()=>({results:[]})};
   if(city==='New York')return {ok:true,json:async()=>({results:[{name:'New York',admin1:'New York',country_code:'US',latitude:40.7,longitude:-74}]})};
  }return base(url);
 }});
 const result=await get(match,'2026-10-26',2026);assert.equal(result.away.available,true);assert.equal(result.away.previousCity,'Brooklyn');assert.ok(result.away.miles>100);
});
