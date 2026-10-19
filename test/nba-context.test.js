'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {createNBAContext,summarize}=require('../nba-context');
const tipoff='2026-10-24T23:00:00.000Z';
const selected={id:899,away:'Chicago Bulls',awayId:5,home:'Milwaukee Bucks',homeId:6,
 tipoff,stage:2,status:'Scheduled'};
function game(id,when,awayId,homeId,awayPts,homePts,{stage=2,status=3}={}){
 return {id,stage,league:'standard',date:{start:when},status:{short:status},
   teams:{visitors:{id:awayId,name:'Visitor'},home:{id:homeId,name:'Home'}},
   scores:{visitors:{points:awayPts},home:{points:homePts}}};
}
const old1=game(111,'2026-10-21T23:00:00.000Z',5,7,105,100);
const old2=game(112,'2026-10-23T22:00:00.000Z',8,5,90,101);
const future=game(113,'2026-10-25T22:00:00.000Z',5,7,130,90);
const current=game(899,tipoff,5,6,140,99);
const preseason=game(114,'2026-10-18T23:00:00.000Z',5,6,120,80,{stage:1});
const live=game(115,'2026-10-23T22:00:00.000Z',5,7,80,82,{status:2});
const missing=game(116,'2026-10-20T22:00:00.000Z',5,7,null,110);
const lateFinish={...game(117,'2026-10-24T19:00:00.000Z',5,7,125,120),date:{start:'2026-10-24T19:00:00.000Z',end:'2026-10-24T23:50:00.000Z'}};
const safelyFinished={...game(118,'2026-10-23T17:00:00.000Z',5,7,115,110),date:{start:'2026-10-23T17:00:00.000Z',end:'2026-10-23T20:00:00.000Z'}};
test('NBA history strictly excludes future, current, live, preseason, unknown-score and duplicate games',()=>{
 const s=summarize([old2,old1,old1,future,current,preseason,live,missing,lateFinish],5,selected);
 assert.equal(s.available,true);
 assert.equal(s.sample,2);
 assert.equal(s.season.pointsFor,103);
 assert.equal(s.season.pointsAgainst,95);
 assert.equal(s.season.net,8);
 assert.equal(s.season.wins,2);
 assert.equal(s.recent5.games,2);
 assert.equal(s.lastPlayedAt,'2026-10-23T22:00:00.000Z');
 assert.equal(s.sampleLabel,'Thin sample — early season');
});
test('NBA history excludes games that finished after the matchup tipped off',()=>{
 const context=summarize([lateFinish,safelyFinished,old1],5,selected);
 assert.equal(context.sample,2);
 assert.equal(context.season.pointsFor,110);
});
test('NBA history fails closed with no earlier qualified games or no stage',()=>{
 const empty=summarize([future,current,preseason,live],5,selected);
 assert.equal(empty.available,false);
 assert.equal(empty.season,null);
 assert.equal(empty.sample,0);
 const unknown=summarize([old1],5,{...selected,stage:null});
 assert.equal(unknown.available,false);
 assert.match(unknown.reason,/stage/);
});
test('NBA context fetches separate team history once and does not infer basketball odds or predictions',async()=>{
 const urls=[];let clock=1000;
 const get=createNBAContext({now:()=>clock,key:()=> 'dummy-nba-key',
   fetcher:async(url,options)=>{
     urls.push(url);
     assert.equal(options.headers['x-apisports-key'],'dummy-nba-key');
     return {ok:true,json:async()=>({response:url.includes('team=5')?[old1,old2,future,current,preseason]:[
       game(210,'2026-10-20T23:00:00Z',6,9,99,104),game(211,'2026-10-22T23:00:00Z',10,6,110,112)
     ],errors:[]})};
   }});
 const [a,b]=await Promise.all([get(selected,2026),get(selected,2026)]);
 assert.equal(urls.length,2);
 assert.ok(urls.some(url=>url==='https://v2.nba.api-sports.io/games?league=standard&season=2026&team=5'));
 assert.ok(urls.some(url=>url==='https://v2.nba.api-sports.io/games?league=standard&season=2026&team=6'));
 assert.deepEqual(a,b);
 assert.equal(a.available,true);
 assert.equal(a.away.sample,2);assert.equal(a.home.sample,2);
 assert.equal(a.home.season.pointsFor,105.5);
 assert.equal(a.away.season.pointsAgainst,95);
 assert.equal(Object.hasOwn(a,'projectedSpread'),false);
 assert.equal(Object.hasOwn(a,'winProbability'),false);
 clock+=1000;await get(selected,2026);assert.equal(urls.length,2);
 clock+=3601000;await get(selected,2026);assert.equal(urls.length,4);
});
test('NBA context refuses wrong or missing team identifiers, unavailable stage and incomplete provider history',async()=>{
 const inactive=createNBAContext({key:()=> 'dummy',fetcher:async()=>{throw Error('should not fetch')}});
 await assert.rejects(inactive({...selected,awayId:null},2026),/identifiers/);
 const unknown=await inactive({...selected,stage:null},2026);
 assert.equal(unknown.available,false);
 assert.match(unknown.reason,/stage/);
 const broken=createNBAContext({key:()=> 'dummy',fetcher:async()=>({ok:true,json:async()=>({response:[old1],paging:{total:2},errors:[]})})});
 await assert.rejects(broken(selected,2026),/incomplete/);
 const absent=createNBAContext({key:()=> null,fetcher:async()=>{throw Error('should not fetch')}});
 await assert.rejects(absent(selected,2026),/credential/);
});
test('NBA comparison renders its own context without changing football scoring code',()=>{
 const client=fs.readFileSync(path.join(__dirname,'../public/nba.js'),'utf8');
 const html=fs.readFileSync(path.join(__dirname,'../public/nba.html'),'utf8');
 const server=fs.readFileSync(path.join(__dirname,'../server.js'),'utf8');
 assert.match(client,/\/api\/nba\/context\?/);
 assert.match(html,/id="nba-team-comparison"/);
 assert.match(html,/id="nba-team-context-status"/);
 assert.match(server,/\/api\/nba\/context/);
 assert.match(html,/not predictions/i);
 assert.doesNotMatch(client,/Unit501TeamModel|forecastArchive|Monte Carlo/i);
});
