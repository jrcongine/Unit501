'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createPublicNBA,createNBASources,convert}=require('../nba-public');
const {normalizeGame}=require('../nba-feed'),{matches}=require('../nba-odds');
const now=Date.parse('2026-10-24T20:00:00Z');
function event(id=401909855,date='2026-10-24T23:30Z',done=false){return {id:String(id),season:{year:2027,type:2},date,competitions:[{date,venue:{fullName:'Arena'},status:{period:done?4:0,type:{name:done?'STATUS_FINAL':'STATUS_SCHEDULED',state:done?'post':'pre',completed:done}},competitors:[{homeAway:'away',team:{id:'15',displayName:'Milwaukee Bucks'},score:done?{value:110}:0},{homeAway:'home',team:{id:'20',displayName:'Philadelphia 76ers'},score:done?{value:114}:0}]}]};}
const payload=events=>({leagues:[{slug:'nba'}],events});
test('public NBA conversion handles end-year seasons and scheduled zero scores stay unknown',()=>{
 const g=normalizeGame(convert(event(),2026));assert.equal(g.id,401909855);assert.equal(g.awayId,15);assert.equal(g.homeId,20);assert.equal(g.awayScore,null);assert.equal(g.stage,2);
 const final=normalizeGame(convert(event(100,'2026-10-22T23:00Z',true),2026));assert.equal(final.homeScore,114);
 assert.equal(convert({...event(),season:{year:2026,type:2}},2026),null);
 assert.equal(convert({...event(),competitions:[...event().competitions,...event().competitions]},2026),null);
});
test('public NBA fallback supplies real-shaped slates and remains compatible with NBA bookmaker matching',async()=>{
 let calls=0;const feed=createPublicNBA({now:()=>now,fetcher:async url=>{calls++;assert.match(url,/basketball\/nba\/scoreboard\?dates=2026102[45]/);return {ok:true,json:async()=>payload([event()])};}});
 const [a,b]=await Promise.all([feed.games('2026-10-24'),feed.games('2026-10-24')]);assert.deepEqual(a,b);assert.equal(calls,2);assert.equal(a.provider,'espn');
 assert.equal(a.games[0].provider,'espn');assert.equal(a.games[0].home,'Philadelphia 76ers');
 assert.equal(matches({sport_key:'basketball_nba',away_team:'Milwaukee Bucks',home_team:'Philadelphia 76ers',commence_time:'2026-10-24T23:30:00Z'},a.games[0]),true);
});
test('public team history keeps ESPN identifiers isolated and excludes future/preseason results',async()=>{
 const urls=[];const feed=createPublicNBA({now:()=>now,fetcher:async url=>{urls.push(url);const id=Number(/teams\/(\d+)/.exec(url)[1]);
  return {ok:true,json:async()=>({team:{id:String(id)},season:{year:2027,type:2},events:[event(),event(100,'2026-10-22T23:00Z',true),{...event(101,'2026-10-20T23:00Z',true),season:{year:2027,type:1}}]})};}});
 const game={...normalizeGame(convert(event(),2026)),provider:'espn'};
 const context=await feed.context(game,2026);
 assert.equal(context.away.sample,1);assert.equal(context.away.season.pointsFor,110);assert.equal(context.home.season.pointsFor,114);
 assert.ok(urls.some(u=>u.includes('/teams/15/schedule?season=2027&seasontype=2')));
 assert.equal(context.gameId,game.id);assert.equal(context.provider,'espn');
 await assert.rejects(feed.context({...game,provider:'api-nba'},2026),/identity/);
});
test('public NBA malformed, wrong-league, wrong-season and conflicting histories fail explicitly',async()=>{
 for(const data of [{events:[]},{leagues:[{slug:'nhl'}],events:[event()]},payload([{...event(),season:{year:2026,type:2}}]),payload([event(),{...event(),date:'2026-10-24T21:00Z',competitions:[{...event().competitions[0],date:'2026-10-24T21:00Z'}]}])]){
  const feed=createPublicNBA({now:()=>now,fetcher:async()=>({ok:true,json:async()=>data})});await assert.rejects(feed.games('2026-10-24'));
 }
 const feed=createPublicNBA({now:()=>now,fetcher:async()=>({ok:true,json:async()=>({team:{id:'999'},season:{year:2027,type:2},events:[event()]})})});
 await assert.rejects(feed.context({...normalizeGame(convert(event(),2026)),provider:'espn'},2026),/season/);
});
test('source router falls back on NBA plan denial, throttles primary retries and routes matching history only',async()=>{
 let primary=0,publicCalls=0,history=0,clock=now;
 const router=createNBASources({now:()=>clock,primaryGames:async()=>{primary++;throw Object.assign(Error('plan denied'),{code:'NBA_PLAN_ACCESS'});},primaryContext:()=>{throw Error('must not mix public IDs into API-NBA');},publicFeed:{games:async()=>{publicCalls++;return {games:[{id:401909855,provider:'espn'}],provider:'espn',source:'ESPN'};},context:async()=>{history++;return {provider:'espn'};}}});
 const slate=await router.games('2026-10-24');await router.games('2026-10-25');assert.equal(primary,1);assert.equal(publicCalls,2);assert.equal(slate.fallback,true);
 await router.context(slate.games[0],2026);assert.equal(history,1);
 clock+=3600001;await router.games('2026-10-24');assert.equal(primary,2);
 assert.throws(()=>router.context({id:1},2026),/provider/);
});
test('successful configured slates, including genuine empty dates, do not invoke fallback',async()=>{
 const router=createNBASources({primaryGames:async()=>({games:[]}),primaryContext:async()=>({}),publicFeed:{games:()=>{throw Error('must not fetch');}}});
 assert.deepEqual((await router.games('2026-10-24')).games,[]);
 const broken=createNBASources({primaryGames:async()=>{throw Error();},primaryContext:async()=>{},publicFeed:{games:async()=>{throw Error();}}});
 await assert.rejects(broken.games('2026-10-24'),/Both configured and public/);
});

test('NBA public and primary feeds preserve unknown scores instead of coercing them to zero',()=>{
 for(const value of [null,undefined,'','   ',false,true,[],{},'unavailable',110.5]){
  const e=event(100,'2026-10-22T23:00Z',true);e.competitions[0].competitors[0].score={value};
  const raw=convert(e,2026);assert.equal(normalizeGame(raw).awayScore,null);
  raw.scores.visitors.points=value;assert.equal(normalizeGame(raw).awayScore,null);
 }
 for(const value of [0,'0',110,' 110 ']){
  const e=event(100,'2026-10-22T23:00Z',true);e.competitions[0].competitors[0].score={value};
  assert.equal(normalizeGame(convert(e,2026)).awayScore,Number(value));
 }
});

test('public NBA context rejects mixed valid and malformed events instead of silently shrinking history',async()=>{
 const feed=createPublicNBA({now:()=>now,fetcher:async url=>({ok:true,json:async()=>({team:{id:/teams\/(\d+)/.exec(url)[1]},season:{year:2027,type:2},events:[event(100,'2026-10-22T23:00Z',true),{id:'101'}]})})});
 await assert.rejects(feed.context({...normalizeGame(convert(event(),2026)),provider:'espn'},2026),/incomplete/);
});
