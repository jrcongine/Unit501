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

test('NBA moneylines require exactly two ordered team outcomes with fresh valid prices',()=>{
 const moneyline=market('h2h',[{name:event.away_team,price:150},{name:event.home_team,price:-175}]);
 assert.deepEqual(gameLines(quotes([moneyline]),now).moneyline,{away:150,home:-175,updatedAt:now});
 for(const bad of [market('h2h',moneyline.outcomes,now-1800001),market('h2h',moneyline.outcomes,now+60001),
  market('h2h',moneyline.outcomes.slice(0,1)),market('h2h',[...moneyline.outcomes,{name:'Draw',price:500}]),
  market('h2h',[moneyline.outcomes[0],moneyline.outcomes[0]]),
  market('h2h',[moneyline.outcomes[0],{name:'Wrong team',price:-175}]),
  market('h2h',moneyline.outcomes.map(o=>({...o,price:75})))]){
  assert.equal(gameLines(quotes([bad]),now).moneyline,null);
 }
 assert.equal(gameLines(quotes([moneyline,moneyline]),now).moneyline,null);
});

test('three-book comparison is on demand, shares one league request, and keeps bookmaker and market identity separate',async()=>{
 const ml=market('h2h',[{name:event.away_team,price:150},{name:event.home_team,price:-175}]);
 const events={...event,bookmakers:[
  {key:'fanduel',markets:[spread,total,ml]},
  {key:'draftkings',markets:[{...spread,outcomes:spread.outcomes.map(o=>({...o,point:o.point>0?4.5:-4.5}))},
    {...ml,outcomes:ml.outcomes.map(o=>({...o,price:o.price>0?160:-180}))}]},
  {key:'betmgm',markets:[market('h2h',ml.outcomes,now-1800001),total]},
  {key:'unrequested',markets:[ml]}
 ]};
 const urls=[],feed=createNBAOdds({now:()=>now,key:()=> 'test-key',fetcher:async url=>{urls.push(url);return {ok:true,json:async()=>[events]};}});
 const ordinary=await feed(game);assert.equal(urls.length,1);
 assert.equal(new URL(urls[0]).searchParams.get('bookmakers'),'fanduel');
 assert.equal(new URL(urls[0]).searchParams.get('markets'),'spreads,totals');
 assert.equal(ordinary.bookmaker,'FanDuel');
 const [a,b]=await Promise.all([feed(game,'comparison'),feed(game,'comparison')]);
 assert.deepEqual(a,b);assert.equal(urls.length,2);
 const q=new URL(urls[1]).searchParams;
 assert.equal(q.get('bookmakers'),'fanduel,draftkings,betmgm');assert.equal(q.get('markets'),'h2h,spreads,totals');
 assert.equal(a.bookmaker,'Multiple');assert.equal(a.available,true);
 assert.equal(a.books.length,3);
 assert.equal(a.books[0].spread.away,3.5);assert.equal(a.books[1].spread.away,4.5);
 assert.equal(a.books[0].moneyline.away,150);assert.equal(a.books[1].moneyline.away,160);
 assert.equal(a.books[1].total,null);assert.equal(a.books[2].moneyline,null);
 assert.equal(a.books[2].total.line,225.5);
 const duplicate={...events,bookmakers:[...events.bookmakers,events.bookmakers[1]]};
 assert.equal(gameLines(duplicate,now,'draftkings').moneyline,null);
 assert.equal(gameLines(duplicate,now,'fanduel').moneyline.away,150);
});

test('started, unconfigured and ambiguous NBA comparisons withhold all sportsbook prices',async()=>{
 const feed=createNBAOdds({now:()=>now,key:()=>null,fetcher:async()=>{throw Error('must not fetch');}});
 assert.deepEqual((await feed(game,'comparison')).books,[]);
 const started=await feed({...game,tipoff:new Date(now-1).toISOString()},'comparison');
 assert.equal(started.available,false);assert.deepEqual(started.books,[]);
 const duplicate=createNBAOdds({now:()=>now,key:()=> 'test',fetcher:async()=>({ok:true,json:async()=>[quotes([spread]),quotes([spread])]})});
 assert.deepEqual((await duplicate(game,'comparison')).books,[]);
});
