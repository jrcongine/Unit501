'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const {parseCovers,parseWagerTalk,createFeed}=require('../outside-picks');
const boyds=require('../boyds-picks');
const covers=`<div id="pick-1" data-pick data-pick-teams="Test" data-tab="active-tabs">
<div class="w-100 fw-bold small"><a><span> </span></a>Player o21.5 Receiving Yards (&#x2B;110)</div>
<a href="https://www.covers.com/writers/test">Test Analyst</a>
<button data-tracking='{"text":"AAA vs BBB, Thu, Oct 15 • 8:15 PM ET"}'></button>
<span class="badge-style-time-only">Pick made: 2 hours ago</span></div>`;
const wt=`<section class="free-sports-main what-pros-say-section"><h2><a>Test Analyst</a></h2>
<div class="content-event">AAA at BBB: Total</div><div class="content-date">October 18, 2026 4:25 PM EDT</div>
<div class="content-play">Total Under 42.5 (-112)</div><p class="r-date">Released/revised 5 hour(s) ago</p>
<div>Other Picks/Packages: PREMIUM SUPER PLAY</div></section>`;
const boydsSport=`<h3><a href="/jimmy-boyd/">Jimmy Boyd</a></h3>
<div>Game Details</div><p>Oct 19 '26, 8:15 PM in 8h</p>
<div>NFL | Commanders vs 49ers</div><div>Play on: Commanders +8 -115 at betus</div>
<h4>Game Analysis</h4><p>Free analysis, not a second pick. Upgrade to a premium package!</p>
<p>Pick Released on Oct 18 at 09:03 am</p>
<h3><a href="/black-widow/">Black Widow</a></h3>
<div>Game Details</div><p>Oct 19 '26, 8:15 PM in 8h</p>
<div>NFL | Commanders vs 49ers</div><div>Play on: Commanders +7½ -110 at Buckeye</div>
<h4>Game Analysis</h4><p>Free wiseguy pick</p>
<p>Pick Released on Oct 19 at 06:33 am</p>`;
const boydsSummary=`<h1>Free Sports Picks Today</h1><p>Last updated: October 19, 2026 12:28 pm</p>
<table><thead><tr><th>Service</th><th>Sport</th><th>Pick</th><th>Analysis</th></tr></thead>
<tbody><tr><td><a>Brandon Lee</a></td><td>MLB</td><td>Rays -140</td><td>Show: Free MLB</td></tr>
<tr><td>Hunter Price</td><td>NFL</td><td>49ers under 52 -104</td><td>Show</td></tr>
<tr><td>Paid Offers</td><td>MLB</td><td>Members only</td><td>BUY NOW</td></tr></tbody></table>`;
test('extracts only explicit public selections and preserves source attribution and prices',()=>{
  const c=parseCovers(covers,'nfl');assert.equal(c.length,1);assert.equal(c[0].pick,'Player o21.5 Receiving Yards (+110)');
  assert.equal(c[0].matchup,'AAA vs BBB');assert.equal(c[0].author,'Test Analyst');assert.equal(c[0].publishedLabel,'2 hours ago');
  const w=parseWagerTalk(wt,'ncaaf');assert.equal(w.length,1);assert.equal(w[0].pick,'Total Under 42.5 (-112)');assert.equal(w[0].eventAt,'2026-10-18T20:25:00.000Z');
  assert.deepEqual(parseCovers(covers.replace('active-tabs','past-tabs'),'nfl'),[]);
  assert.deepEqual(parseCovers(covers.replace('https://www.covers.com/writers/','https://example.com/'),'nfl'),[]);
  assert.deepEqual(parseWagerTalk(wt.replace('October 18, 2026 4:25 PM EDT','unknown'),'nfl'),[]);
  assert.deepEqual(parseCovers('<h1>Free picks today</h1>','nfl'),[]);
});

test('Boyds sport pages require author, matchup, exact pick, release and a future game date',()=>{
 const time=Date.parse('2026-10-19T15:00:00Z');
 const picks=boyds.parseSport(boydsSport,'nfl',time);
 assert.equal(picks.length,2);
 assert.equal(picks[0].author,'Jimmy Boyd');
 assert.equal(picks[0].pick,'Commanders +8 -115 at betus');
 assert.equal(picks[0].matchup,'Commanders vs 49ers');
 assert.equal(picks[0].eventDate,'2026-10-19');
 assert.match(picks[0].publishedLabel,/Oct 18 at 09:03 am/);
 assert.equal(boyds.parseSport(boydsSport,'mlb',time).length,0);
 assert.equal(boyds.parseSport(boydsSport,'nfl',Date.parse('2026-10-20T15:00:00Z')).length,0);
 assert.deepEqual(boyds.parseSport(boydsSport.replaceAll('Pick Released on','Released: '),'nfl',time),[]);
 assert.deepEqual(boyds.parseSport('<h3>Premium</h3><p>BUY NOW Commanders +8 -115</p>','nfl',time),[]);
});
test('Boyds daily summary provides dated source-only entries and never infers an event time',()=>{
 const time=Date.parse('2026-10-19T15:00:00Z');
 const picks=boyds.parseSummary(boydsSummary,'mlb',time);
 assert.equal(picks.length,1);
 assert.equal(picks[0].author,'Brandon Lee');
 assert.equal(picks[0].pick,'Rays -140');
 assert.match(picks[0].eventLabel,/verify matchup/);
 assert.equal(picks[0].eventAt,undefined);
 assert.equal(boyds.parseSummary(boydsSummary,'ncaaf',time).length,0);
 assert.deepEqual(boyds.parseSummary(boydsSummary,'mlb',Date.parse('2026-10-20T15:00:00Z')),[]);
 assert.deepEqual(boyds.parseSummary(boydsSummary.replaceAll('Last updated:', 'Archive:'),'mlb',time),[]);
});
test('Boyds integration yields three distinct source feeds and falls back for MLB when dedicated page is empty',async()=>{
 const time=Date.parse('2026-10-19T15:00:00Z'),urls=[];
 const feed=createFeed({now:()=>time,fetcher:async url=>{
   urls.push(url);
   return new Response(url.includes('boydsbets.com/free-nfl-picks/')?boydsSport:
     url.includes('boydsbets.com/free-sports-picks/')?boydsSummary:
     url.includes('boydsbets.com/free-baseball-picks/')?'<h1>No free MLB picks are currently available.</h1>':
     url.includes('covers.com')?covers:wt);
 }});
 const nfl=await feed('nfl');
 assert.deepEqual(nfl.sources.map(s=>s.source),['covers','wagertalk','boyds']);
 assert.equal(nfl.sources[2].picks.length,2);
 assert.ok(!urls.includes(boyds.SUMMARY),'no unnecessary summary request when sport page has selections');
 const mlb=await feed('mlb');
 assert.equal(mlb.sources[2].status,'available');
 assert.equal(mlb.sources[2].picks[0].author,'Brandon Lee');
 assert.match(mlb.sources[2].message,/matchup, kickoff and release time not verified/);
 assert.ok(urls.includes(boyds.SUMMARY));
});

test('feed caches and shares requests, isolates failures and expires old selections',async()=>{
  let clock=Date.parse('2026-10-14T20:00Z'),calls=0,fail=false;
  const feed=createFeed({now:()=>clock,fetcher:async url=>{calls++;if(fail&&url.includes('covers'))throw Error('offline');return new Response(url.includes('boydsbets.com/free-nfl-picks/')?boydsSport:url.includes('covers')?covers:wt);}});
  const [a,b]=await Promise.all([feed('nfl'),feed('nfl')]);assert.equal(calls,3);assert.equal(a.sources[0].picks.length,1);assert.deepEqual(a,b);
  assert.equal(Object.hasOwn(a,'manual'),false);
  clock+=60000;await feed('nfl');assert.equal(calls,3);
  clock+=300000;fail=true;const partial=await feed('nfl');assert.equal(partial.sources[0].status,'unavailable');assert.deepEqual(partial.sources[0].picks,[]);assert.equal(partial.sources[1].picks.length,1);
  clock=Date.parse('2026-10-19T00:00Z');const past=await feed('nfl');assert.deepEqual(past.sources[1].picks,[]);
  await assert.rejects(feed('https://evil.test'));
});
test('oversized responses and changed source markup fail closed',async()=>{
  const big=createFeed({fetcher:async()=>new Response('x'.repeat(5000001))});assert.equal((await big('nfl')).sources[0].status,'unavailable');
  const empty=createFeed({fetcher:async()=>new Response('<h1>Login or changed layout</h1>')});assert.equal((await empty('nfl')).sources[0].status,'empty');
});
test('UI loads on opening, renders text safely, and rejects obsolete league responses',async()=>{
  const nodes=new Map();
  class Node{constructor(){this.children=[];this.listeners={};this.value='nfl';this.open=false;this._text='';}
    append(...n){this.children.push(...n);}replaceChildren(){this.children=[];this._text='';}
    set textContent(t){this._text=t;}get textContent(){return this._text+this.children.map(n=>n.textContent).join('');}
    addEventListener(e,fn){this.listeners[e]=fn;}}
  for(const id of ['war-room','war-feed','war-feed-league','war-feed-refresh','war-feed-status'])nodes.set(id,new Node());
  const pending=[];
  const context={document:{getElementById:id=>nodes.get(id),createElement:()=>new Node()},Date,AbortSignal,encodeURIComponent,
    fetch:()=>new Promise(resolve=>pending.push(resolve))};
  vm.runInNewContext(fs.readFileSync(require.resolve('../public/outside-picks.js'),'utf8'),context);
  assert.equal(pending.length,0);nodes.get('war-room').open=true;nodes.get('war-room').listeners.toggle();assert.equal(pending.length,1);
  nodes.get('war-feed-league').value='ncaaf';const second=nodes.get('war-feed-league').listeners.change();
  const payload=name=>({sources:[{name,message:'public',checkedAt:'2026-10-14T20:00Z',picks:[{pick:'<img onerror=bad>',matchup:'AAA at BBB',author:name,eventLabel:'Oct 15',url:'https://www.covers.com/picks/ncaaf'}]}],manual:[]});
  pending[1]({ok:true,json:async()=>payload('New league')});await second;
  pending[0]({ok:true,json:async()=>payload('Old league')});await new Promise(r=>setImmediate(r));
  assert.match(nodes.get('war-feed').textContent,/New league/);assert.doesNotMatch(nodes.get('war-feed').textContent,/Old league/);
  assert.match(nodes.get('war-feed').textContent,/<img onerror=bad>/);
  const third=nodes.get('war-feed-refresh').listeners.click();pending[2]({ok:false});await third;
  assert.match(nodes.get('war-feed-status').textContent,/Could not load/);assert.equal(nodes.get('war-feed').children.length,0);
});

test('readable public picks survive a three-megabyte source page',async()=>{
 const feed=createFeed({fetcher:async url=>new Response(url.includes('covers')?' '.repeat(3000000)+covers:wt)});
 const result=await feed('nfl');assert.equal(result.sources[0].status,'available');assert.equal(result.sources[0].picks[0].author,'Test Analyst');
 const mlb=await feed('mlb');assert.equal(mlb.sources.length,3);assert.equal(mlb.league,'mlb');
});
