'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {effect}=require('../public/weather-model');
const now=Date.now(),game={kickoff:now+86400000};
const forecast={roof:'outdoor',available:true,kickoff:game.kickoff,fetchedAt:now,forecastTime:game.kickoff,windMph:5,temperatureF:70,precipitationMm:0};
test('rain and extreme temperature affect props, normal conditions do not',()=>{
 assert.equal(effect(game,forecast,'passYds',true,now).factor,1);
 assert.ok(effect(game,{...forecast,precipitationMm:4},'passYds',true,now).factor<1);
 assert.ok(effect(game,{...forecast,temperatureF:10},'recYds',true,now).factor<1);
 assert.ok(effect(game,{...forecast,temperatureF:105},'rushYds',true,now).factor<1);
 assert.equal(effect(game,{...forecast,precipitationChance:100},'passYds',true,now).factor,1);
});
test('wind can increase carries slightly without increasing rushing yardage',()=>{
 const f={...forecast,windMph:30};assert.ok(effect(game,f,'carries',true,now).factor>1);assert.equal(effect(game,f,'rushYds',true,now).factor,1);
});
test('indoor, expired, wrong game, disabled and unsupported markets retain baseline',()=>{
 for(const f of [{...forecast,roof:'indoor'},{...forecast,roof:'unknown'},{...forecast,fetchedAt:now-900001},{...forecast,kickoff:game.kickoff+1}])assert.equal(effect(game,{...f,windMph:50},'passYds',true,now).factor,1);
 assert.equal(effect(game,{...forecast,windMph:50},'passYds',false,now).factor,1);
 assert.equal(effect(game,{...forecast,windMph:50},'passTD',true,now).factor,1);
});
const {matchEvent}=require('../game-venue');
test('venue matching requires both teams, season and kickoff, preserving neutral venue',()=>{
 const q={league:'2',season:'2026',kickoff:game.kickoff,home:'Texas',away:'Florida'};
 const e={season:{year:2026},competitions:[{date:new Date(game.kickoff).toISOString(),neutralSite:true,competitors:[{homeAway:'home',team:{location:'Texas'}},{homeAway:'away',team:{location:'Florida'}}]}]};
 assert.equal(matchEvent([e],q).length,1);assert.equal(matchEvent([e],{...q,home:'Texas State'}).length,0);assert.equal(matchEvent([e],{...q,season:'2025'}).length,0);assert.equal(matchEvent([e],{...q,kickoff:game.kickoff+3600000}).length,1);assert.equal(matchEvent([e],{...q,kickoff:game.kickoff+86400000}).length,0);
});

test('college venue resolves from event summary when scoreboard omits stadium',async()=>{
 const {resolveVenue}=require('../game-venue'),original=global.fetch;
 const kickoff=Date.parse('2026-10-24T19:30:00Z');let calls=0;
 global.fetch=async url=>{calls++;return {ok:true,json:async()=>String(url).includes('/scoreboard?')?{
  events:[{id:'college-venue-test',season:{year:2026},competitions:[{date:new Date(kickoff+3600000).toISOString(),neutralSite:false,
   competitors:[{homeAway:'home',team:{location:'Texas'}},{homeAway:'away',team:{location:'Ole Miss'}}]}]}]
 }:{gameInfo:{venue:{id:'stadium-texas',fullName:'Darrell K Royal-Texas Memorial Stadium at Campbell-Williams Field',address:{city:'Austin',state:'TX'},indoor:false}}}};};
 try{
  const result=await resolveVenue({league:'2',season:'2026',kickoff,home:'Texas Longhorns',away:'Mississippi'});
  assert.equal(result.available,true);assert.equal(result.roof,'outdoor');assert.equal(result.neutralSite,false);
  assert.equal(result.latitude,30.284);assert.equal(calls,2);
 }finally{global.fetch=original;}
});
test('provider stadium coordinates avoid a city geocoding dependency and preserve neutral status',async()=>{
 const {resolveVenue}=require('../game-venue'),original=global.fetch;
 const kickoff=Date.parse('2026-11-01T01:00:00Z');let calls=0;
 global.fetch=async()=>{calls++;return {ok:true,json:async()=>({events:[{id:'neutral-coordinates-test',season:{year:2026},competitions:[{
  date:new Date(kickoff).toISOString(),neutralSite:true,venue:{fullName:'Neutral Test Stadium',latitude:32.7,longitude:-97.1,indoor:true,address:{city:'Arlington',state:'TX'}},
  competitors:[{homeAway:'home',team:{location:'Texas'}},{homeAway:'away',team:{location:'Ole Miss'}}]
 }]}]})};};
 try{
  const result=await resolveVenue({league:'2',season:'2026',kickoff,home:'Texas',away:'Ole Miss'});
  assert.equal(result.available,true);assert.equal(result.neutralSite,true);assert.equal(result.locationPrecision,'stadium');
  assert.equal(result.latitude,32.7);assert.equal(result.roof,'indoor');assert.equal(calls,1);
 }finally{global.fetch=original;}
});

test('NFL Paris matchup resolves an outdoor venue without U.S. state geocoding',async()=>{
 const {resolveVenue}=require('../game-venue'),original=global.fetch;
 const kickoff=Date.parse('2026-10-25T13:30:00Z');
 const venue={id:'france-venue',fullName:'Stade de France',address:{city:'Saint-Denis',country:'France'},indoor:false};
 const urls=[];
 global.fetch=async url=>{
  urls.push(String(url));
  const data=String(url).includes('/summary?')
   ? {gameInfo:{venue}}
   : {events:[{id:'nfl-paris-2026',season:{year:2026},competitions:[{
      date:new Date(kickoff).toISOString(),neutralSite:true,venue,
      competitors:[{homeAway:'home',team:{displayName:'New Orleans Saints'}},
                   {homeAway:'away',team:{displayName:'Pittsburgh Steelers'}}]
     }]}]};
  return {ok:true,json:async()=>data};
 };
 try {
  const resolved=await resolveVenue({league:'1',season:'2026',kickoff,home:'New Orleans Saints',away:'Pittsburgh Steelers'});
  assert.equal(resolved.available,true);
  assert.equal(resolved.neutralSite,true);
  assert.equal(resolved.roof,'outdoor');
  assert.equal(resolved.latitude,48.9245);
  assert.equal(resolved.longitude,2.3601);
  assert.equal(urls.length,2);
  assert.ok(urls.every(url=>!url.includes('geocoding-api')));
 }finally{global.fetch=original;}
});

test('blank or boolean football venue coordinates require a real location lookup',async()=>{
 const {resolveVenue}=require('../game-venue'),original=global.fetch;
 try{for(const [i,value] of ['',false].entries()){
  const kickoff=Date.parse('2026-11-03T01:00:00Z')+i*86400000;let geocoded=false;
  global.fetch=async url=>{if(String(url).includes('geocoding-api')){geocoded=true;return {ok:true,json:async()=>({results:[{name:'Arlington',admin1:'Texas',country_code:'US',latitude:32.7,longitude:-97.1}]})};}
   return {ok:true,json:async()=>({events:[{id:'invalid-coordinates-'+i,season:{year:2026},competitions:[{date:new Date(kickoff).toISOString(),neutralSite:true,venue:{fullName:'Unverified Coordinates Field',latitude:value,longitude:value,address:{city:'Arlington',state:'TX'}},competitors:[{homeAway:'home',team:{location:'Texas'}},{homeAway:'away',team:{location:'Ole Miss'}}]}]}]})};};
  const r=await resolveVenue({league:'2',season:'2026',kickoff,home:'Texas',away:'Ole Miss'});
  assert.equal(r.available,true);assert.equal(r.locationPrecision,'city');assert.equal(r.latitude,32.7);assert.equal(geocoded,true);
 }}finally{global.fetch=original;}
});
