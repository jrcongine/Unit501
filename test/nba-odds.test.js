'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createNBAOdds,matches,gameLines,playerLines}=require('../nba-odds');
const now=Date.parse('2026-10-24T20:00:00Z');
const game={id:899,away:'LA Clippers',home:'Chicago Bulls',tipoff:'2026-10-24T23:00:00Z',status:'Scheduled'};
const event={id:'nba-event',sport_key:'basketball_nba',away_team:'Los Angeles Clippers',home_team:'Chicago Bulls',commence_time:game.tipoff};
const pair=(name,point)=>[{name:'Over',description:name,point,price:-110},{name:'Under',description:name,point,price:100}];
const market=(key,outcomes,at=now)=>({key,last_update:new Date(at).toISOString(),outcomes});
const quotes=(markets)=>({...event,bookmakers:[{key:'fanduel',markets}]});
const spread=market('spreads',[{name:event.away_team,point:3.5,price:-110},{name:event.home_team,point:-3.5,price:-110}]);
const total=market('totals',pair(null,225.5));
test('NBA identity requires the right sport, both ordered teams and tipoff; reviewed LA naming is supported',()=>{
 assert.equal(matches(event,game),true);
 for(const e of [{...event,sport_key:'americanfootball_nfl'},{...event,home_team:'Boston Celtics'},{...event,away_team:event.home_team,home_team:event.away_team},{...event,commence_time:'2026-10-25T23:00:00Z'}])assert.equal(matches(e,game),false);
});
test('NBA spreads and totals require paired consistent lines, valid prices and fresh source timestamps',()=>{
 const result=gameLines(quotes([spread,total]),now);assert.equal(result.spread.away,3.5);assert.equal(result.spread.home,-3.5);assert.equal(result.total.line,225.5);
 for(const bad of [market('spreads',spread.outcomes,now-1800001),market('spreads',spread.outcomes,now+60001),market('spreads',[spread.outcomes[0]]),market('spreads',[spread.outcomes[0],{...spread.outcomes[1],point:-4.5}]),market('spreads',spread.outcomes.map(o=>({...o,price:0})))])assert.equal(gameLines(quotes([bad]),now).spread,null);
 assert.equal(gameLines(quotes([spread,spread]),now).spread,null);
 assert.equal(gameLines({...quotes([spread]),bookmakers:[{key:'draftkings',markets:[spread]}]},now).spread,null);
});
test('NBA player props support only main points/rebounds/assists/threes with unique paired quotes',()=>{
 const markets=['player_points','player_rebounds','player_assists','player_threes'].map((k,i)=>market(k,pair('Player A',20.5-i)));
 assert.equal(playerLines(quotes(markets),now).length,4);
 for(const m of [market('player_points_alternate',pair('Player A',20.5)),market('player_points',pair('Player A',20.5),now-1800001),market('player_points',pair('Player A',20.5).slice(0,1)),market('player_points',pair('Player A',20.5).map(o=>({...o,price:50})))])assert.deepEqual(playerLines(quotes([m]),now),[]);
 assert.deepEqual(playerLines(quotes([markets[0],markets[0]]),now),[]);
 const duplicated=market('player_points',[...pair('Player A',20.5),...pair('Player A.',21.5)]);
 assert.deepEqual(playerLines(quotes([duplicated]),now),[]);
});
test('NBA game quote requests share a five-minute league cache without touching football providers',async()=>{
 let calls=0;const feed=createNBAOdds({now:()=>now,key:()=> 'test-key',fetcher:async url=>{calls++;assert.match(url,/sports\/basketball_nba\/odds\?/);assert.match(url,/bookmakers=fanduel/);return {ok:true,json:async()=>[quotes([spread,total])]};}});
 const [a,b]=await Promise.all([feed(game),feed(game)]);assert.deepEqual(a,b);assert.equal(calls,1);assert.equal(a.available,true);assert.equal(a.gameId,899);
});
test('NBA per-event props verify event identity and share event and quote requests',async()=>{
 const urls=[];const feed=createNBAOdds({now:()=>now,key:()=> 'test-key',fetcher:async url=>{urls.push(url);return {ok:true,json:async()=>url.includes('/nba-event/odds?')?quotes([market('player_points',pair('Player A',20.5))]):[event]};}});
 const [a,b]=await Promise.all([feed(game,'props'),feed(game,'props')]);assert.deepEqual(a,b);assert.equal(urls.length,2);assert.equal(a.props.length,1);
 assert.equal(a.coverage.length,4);assert.equal(a.coverage.find(m=>m.market==='player_rebounds').lines,0);assert.match(urls[1],/player_threes/);
 const wrong=createNBAOdds({now:()=>now,key:()=> 'test',fetcher:async url=>({ok:true,json:async()=>url.includes('/odds?')?{...quotes([]),id:'wrong'}:[event]})});
 await assert.rejects(wrong(game,'props'),/identity/);
});
test('missing keys, started games and ambiguous event matches do not invent NBA markets',async()=>{
 const missing=createNBAOdds({now:()=>now,key:()=>null,fetcher:async()=>{throw Error('must not fetch');}});
 assert.equal((await missing(game)).available,false);assert.equal((await missing({...game,tipoff:new Date(now-1).toISOString()})).available,false);
 const duplicate=createNBAOdds({now:()=>now,key:()=> 'test',fetcher:async()=>({ok:true,json:async()=>[quotes([spread]),quotes([spread])]})});
 assert.equal((await duplicate(game)).available,false);
});
test('NBA authentication errors are safe and retryable after the connection is corrected',async()=>{
 let calls=0;const feed=createNBAOdds({now:()=>now,key:()=> 'secret-key',fetcher:async()=>{calls++;return {ok:false,status:401,json:async()=>({error_code:'INVALID_KEY',message:'apiKey=secret-key'})};}});
 for(let i=0;i<2;i++)await assert.rejects(feed(game),e=>e.message.includes('INVALID_KEY')&&!e.message.includes('secret-key'));
 assert.equal(calls,2);
});
