'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {createNBAFeed,normalizeGame,validDate,inferSeason}=require('../nba-feed');
const valid={
 id:1001,league:'standard',season:2026,date:{start:'2026-10-20T23:00:00.000Z'},
 status:{short:1,long:'Not Started'},arena:{name:'Madison Square Garden'},
 teams:{visitors:{id:20,name:'Philadelphia 76ers'},home:{id:24,name:'New York Knicks'}},
 scores:{visitors:{points:null},home:{points:null}}
};
const final={...valid,id:1002,status:{short:3,long:'Finished'},scores:{visitors:{points:110},home:{points:113}}};
test('NBA seasons cross the calendar year; dates must be real',()=>{
 assert.equal(inferSeason('2026-10-20'),2026);
 assert.equal(inferSeason('2027-03-20'),2026);
 assert.equal(validDate('2026-02-29'),false);
 assert.equal(validDate('2026-10-20'),true);
 assert.equal(validDate('2026-10-20&season=2029'),false);
});
test('NBA normalization leaves unknown upcoming scores blank, keeps completed scores',()=>{
 const pending=normalizeGame(valid);
 assert.equal(pending.status,'Scheduled');
 assert.equal(pending.home,'New York Knicks');
 assert.equal(pending.awayScore,null);
 assert.equal(pending.arena,'Madison Square Garden');
 const ended=normalizeGame(final);
 assert.equal(ended.awayScore,110);
 assert.equal(ended.homeScore,113);
 assert.equal(normalizeGame({...valid,teams:{visitors:null,home:{name:'Knicks'}}}),null);
 assert.equal(normalizeGame({...valid,status:{short:99}}),null);
});
test('NBA API adapter uses separate NBA endpoint and shares cached requests without mutating football',async()=>{
 let calls=0,clock=100000;
 const get=createNBAFeed({now:()=>clock,key:()=> 'fake-test-key',fetcher:async(url,options)=>{
  calls++;
  assert.equal(url,'https://v2.nba.api-sports.io/games?league=standard&season=2026&date=2026-10-20');
  assert.equal(options.headers['x-apisports-key'],'fake-test-key');
  return {ok:true,json:async()=>({response:[final,valid],errors:[]})};
 }});
 const [a,b]=await Promise.all([get('2026-10-20'),get('2026-10-20')]);
 assert.equal(calls,1);
 assert.deepEqual(a,b);
 assert.equal(a.games.length,2);
 assert.equal(a.games.find(game=>game.id===1001).status,'Scheduled');
 assert.equal(a.games.find(game=>game.id===1002).status,'Final');
 clock+=60000;await get('2026-10-20');assert.equal(calls,1);
 clock+=900000;await get('2026-10-20');assert.equal(calls,2);
});
test('NBA provider errors, invalid shapes and missing keys fail closed rather than generating games',async()=>{
 await assert.rejects(createNBAFeed({key:()=>null,fetcher:async()=>{throw Error('should not fetch')}})('2026-10-20'),/credential/);
 for(const data of [{response:[],errors:{plan:'access denied'}},{response:'bad',errors:[]},{response:[{}],errors:[]}]){
  await assert.rejects(createNBAFeed({key:()=> 'test',fetcher:async()=>({ok:true,json:async()=>data})})('2026-10-20'));
 }
 const empty=await createNBAFeed({key:()=> 'test',fetcher:async()=>({ok:true,json:async()=>({response:[],errors:[]})})})('2026-10-20');
 assert.deepEqual(empty.games,[]);
 await assert.rejects(createNBAFeed({key:()=> 'test'})('not-a-date'),/Invalid NBA date/);
});
test('NBA beta is a distinct schedule-only view and football league selector remains untouched',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../public/nba.html'),'utf8');
 const base=fs.readFileSync(path.join(__dirname,'../public/index.html'),'utf8');
 const server=fs.readFileSync(path.join(__dirname,'../server.js'),'utf8');
 assert.match(html,/NBA research beta: real schedules/);
 assert.match(html,/nba-date/);
 assert.doesNotMatch(html,/Run simulation|Projected score:/i);
 assert.match(base,/href="nba.html"/);
 assert.match(base,/<option value="2">College Football<\/option>/);
 assert.match(base,/<option value="1">NFL<\/option>/);
 assert.match(server,/\/api\/nba\/games/);
 assert.match(server,/private-access/);
});
