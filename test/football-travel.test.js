'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {miles,create}=require('../public/football-travel');
test('straight-line distance is approximate and rejects invalid coordinates',()=>{
 assert.equal(miles({latitude:0,longitude:0},{latitude:0,longitude:0}),0);
 assert.ok(Math.abs(miles({latitude:0,longitude:0},{latitude:0,longitude:1})-69)<1);
 assert.equal(miles({latitude:91,longitude:0},{latitude:0,longitude:1}),null);
});
test('ESPN scoreboard queries use the game date in Eastern time, including late games',()=>{
 const {espnDate}=require('../game-venue');
 assert.equal(espnDate(Date.parse('2026-10-28T00:00:00Z')),'20261027');
 assert.equal(espnDate(Date.parse('2026-11-02T02:00:00Z')),'20261101');
});
test('matches venue queries to the correct prior sides and shares the current venue lookup',async()=>{
 const urls=[];const travel=create(async url=>{urls.push(url);const q=new URL(url,'https://example.test').searchParams;return {ok:true,json:async()=>({available:true,name:q.get('home')+' field',latitude:q.get('home')==='Host'?1:0,longitude:0,locationPrecision:'stadium'})};});
 const game={league:'2',season:'2026',kickoff:200000, a:'Visitors',h:'Host'};
 const priorAway={kickoff:100000,side:'away',opponent:'Earlier Host'},priorHome={kickoff:110000,side:'home',opponent:'Earlier Away'};
 const [a,b]=await Promise.all([travel.estimate(game,'Visitors',priorAway),travel.estimate(game,'Host',priorHome)]);
 assert.equal(a.miles,69);assert.equal(b.miles,0);assert.equal(urls.length,3);
 const previous=new URL(urls[0],'https://example.test').searchParams;assert.equal(previous.get('away'),'Visitors');assert.equal(previous.get('home'),'Earlier Host');
 assert.equal(await travel.estimate(game,'Host',{...priorHome,kickoff:game.kickoff}),null);
});
test('missing venue is withheld and a later attempt can retry',async()=>{
 let calls=0;const travel=create(async()=>{calls++;return {ok:false};});
 const game={league:'1',season:'2026',kickoff:200000,a:'A',h:'B'};
 const last={kickoff:100000,side:'home',opponent:'C'};
 assert.equal(await travel.estimate(game,'A',last),null);
 assert.equal(await travel.estimate(game,'A',last),null);assert.equal(calls,4);
});

test('football rest distinguishes a short week from the normal weekly schedule',()=>{
 const {schedule}=require('../public/football-travel'),kickoff=Date.parse('2026-11-08T18:00:00Z');
 const prior=at=>({kickoff:Date.parse(at)});
 const weekly=schedule([prior('2026-11-01T18:00:00Z')],kickoff);
 assert.equal(weekly.fullDaysOff,6);assert.equal(weekly.shortWeek,false);assert.equal(weekly.gapHours,168);
 const short=schedule([prior('2026-11-05T18:00:00Z'),prior('2026-11-01T18:00:00Z')],kickoff);
 assert.equal(short.fullDaysOff,2);assert.equal(short.shortWeek,true);assert.equal(short.gamesLast14Days,2);
 assert.equal(schedule([],kickoff).available,false);
 assert.equal(schedule([{kickoff:null},prior('2026-11-09T18:00:00Z')],kickoff).available,false);
});
test('football rest uses Central calendar days across midnight and daylight saving',()=>{
 const {schedule}=require('../public/football-travel');
 const rest=schedule([{kickoff:Date.parse('2026-10-25T17:00:00Z')}],Date.parse('2026-11-01T18:00:00Z'));
 assert.equal(rest.fullDaysOff,6);assert.equal(rest.gapHours,169);assert.equal(rest.shortWeek,false);
 const sameDay=schedule([{kickoff:Date.parse('2026-10-27T17:00:00Z')}],Date.parse('2026-10-28T01:00:00Z'));
 assert.equal(sameDay.daysBetween,0);assert.equal(sameDay.fullDaysOff,0);
});
