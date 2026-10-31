const {test}=require('node:test'),assert=require('node:assert/strict');
const {consensus}=require('../pick-consensus');
const {eventIdentity}=require('../consensus-identity');
const {eventTimestamp}=require('../consensus-identity');
test('Covers kickoff uses Eastern daylight/standard time and withholds ambiguous DST hours',()=>{
 const source={source:'covers',checkedAt:'2026-10-29T12:00:00Z'};
 const pick={eventLabel:'CAR vs GB, Thu, Oct 29 • 8:15 PM ET'};
 assert.equal(eventTimestamp(pick,source),Date.parse('2026-10-30T00:15:00Z'));
 assert.equal(eventTimestamp({eventLabel:'CAR vs GB, Mon, Nov 2 • 8:15 PM ET'},source),Date.parse('2026-11-03T01:15:00Z'));
 assert.equal(eventTimestamp({eventLabel:'CAR vs GB, Sun, Nov 1 • 1:30 AM ET'},source),null);
 assert.equal(eventTimestamp({eventLabel:'Time unknown'},source),null);
});
test('War Room removes started Covers picks even while the source response is cached',async()=>{
 let now=Date.parse('2026-10-30T00:14:00Z'),calls=0;
 const html='<div id="pick-test" data-pick data-tab="active-tabs"><div class="w-100 fw-bold small">GB -3.5 (-110)</div><a href="https://www.covers.com/writers/test">Test Author</a><button data-tracking=\'{"text":"CAR vs GB, Thu, Oct 29 • 8:15 PM ET"}\'></button></div>';
 const feed=require('../outside-picks').createFeed({now:()=>now,fetcher:async url=>{calls++;return new Response(url.includes('covers.com')?html:'<h1>No picks</h1>');}});
 assert.equal((await feed('nfl')).sources[0].picks.length,1);
 const initialCalls=calls;
 now+=60000;
 assert.equal((await feed('nfl')).sources[0].picks.length,0);
 assert.equal(calls,initialCalls);
});
const p={league:'nba',eventDate:'2026-10-24',matchup:'Heat vs Hornets',pick:'Under 231.5 -110',author:'A',url:'https://example.com'};
const source=(id,picks)=>({source:id,name:id,picks});
test('consensus counts named authors, deduplicates repeats and preserves line differences',()=>{
 const result=consensus([source('one',[p,p,{...p,author:'B'}]),source('two',[{...p,pick:'Under 231.5 (-105)'},{...p,pick:'Under 232.5 -110'}])]);
 assert.equal(result.length,1);assert.equal(result[0].count,3);assert.equal(result[0].sources.length,3);
});
test('consensus excludes unknown dates and keeps other games/dates separate',()=>{
 assert.deepEqual(consensus([source('one',[p]),source('two',[{...p,eventDate:null},{...p,eventDate:'2026-10-25'},{...p,matchup:'Bulls vs Hornets'}])]),[]);
});
const checkedAt='2026-10-28T19:05:09Z';
const coversPick={league:'mlb',author:'Josh Inglis',pick:'Jacob Misiorowski u15.5 Outs Recorded (57%)',matchup:'MIL vs TB',eventLabel:'MIL vs TB, Wed, Oct 28 • 8:00 PM ET',url:'https://www.covers.com/picks/mlb#example'};
const wagerPick={league:'mlb',author:'Ross Benjamin',pick:'Jacob Misiorowski Outs Under 15.5 (-133) Away Listed Pitcher Must Start',matchup:'(959) Milwaukee Brewers at (960) Tampa Bay Rays: Jacob Misiorowski Outs',eventAt:'2026-10-29T00:00:00Z',url:'https://www.wagertalk.com/free-sports-picks/mlb'};
const example=(c=coversPick,w=wagerPick)=>consensus([{...source('covers',[c]),checkedAt},source('wagertalk',[w])]);
test('screenshot example groups the same timed pitcher-outs prop and preserves both original selections',()=>{
 const result=example();assert.equal(result.length,1);assert.equal(result[0].count,2);
 assert.equal(result[0].pick,'jacob misiorowski under 15.5 outs recorded');assert.equal(result[0].date,'2026-10-28');
 assert.deepEqual(result[0].sources.map(s=>s.author),['Josh Inglis','Ross Benjamin']);
 assert.deepEqual(result[0].sources.map(s=>s.pick),[coversPick.pick,wagerPick.pick]);
 assert.deepEqual(result[0].sources.map(s=>s.url),[coversPick.url,wagerPick.url]);
});
test('prop matching rejects other lines, sides, players, games, times and unsupported conditions',()=>{
 for(const change of [
  {pick:wagerPick.pick.replace('15.5','16.5')},{pick:wagerPick.pick.replace('Under','Over')},
  {pick:wagerPick.pick.replaceAll('Jacob Misiorowski','Other Pitcher')},
  {pick:wagerPick.pick+' First 5 Innings'},
  {matchup:wagerPick.matchup.replace('Tampa Bay Rays','Boston Red Sox')},
  {matchup:wagerPick.matchup.replace(': Jacob Misiorowski Outs',': Other Pitcher Outs')},
  {eventAt:'2026-10-28T18:00:00Z'},{eventAt:'2026-10-30T00:00:00Z'},
  {eventAt:null,eventDate:'2026-10-28'}, {league:'nba'}, {author:''}
 ])assert.deepEqual(example(coversPick,{...wagerPick,...change}),[],JSON.stringify(change));
 assert.deepEqual(example({...coversPick,eventLabel:'MIL vs TB'},wagerPick),[]);
});
test('Covers year inference requires a nearby valid date, weekday, time and source check',()=>{
 const s={source:'covers',checkedAt};
 assert.deepEqual(eventIdentity(coversPick,s),{date:'2026-10-28',time:'20:00'});
 for(const eventLabel of ['MIL vs TB, Thu, Oct 28 • 8:00 PM ET','MIL vs TB, Wed, Sep 30 • 8:00 PM ET','MIL vs TB, Wed, Oct 28 • 13:00 PM ET','MIL vs TB, Wed, Oct 28 • 8:70 PM ET'])assert.equal(eventIdentity({...coversPick,eventLabel},s),null);
 assert.equal(eventIdentity(coversPick,{...s,checkedAt:'unknown'}),null);
 assert.equal(eventIdentity({...coversPick,eventDate:'2026-10-29'},s),null);
 assert.deepEqual(eventIdentity({...coversPick,eventLabel:'MIL vs TB, Fri, Jan 1 • 12:00 AM ET'},{...s,checkedAt:'2026-12-31T18:00:00Z'}),{date:'2027-01-01',time:'00:00'});
});
test('anonymous rows do not create named consensus',()=>{
 assert.deepEqual(consensus([source('one',[{...p,author:''}]),source('two',[{...p,author:null}])]),[]);
});
test('public-feed pipeline combines the two source formats from the reported example',async()=>{
 const covers=`<div id="pick-example" data-pick data-tab="active-tabs"><div class="w-100 fw-bold small">${coversPick.pick}</div><a href="https://www.covers.com/writers/josh-inglis">Josh Inglis</a><button data-tracking='{"text":"${coversPick.eventLabel}"}'></button></div>`;
 const wager=`<section class="free-sports-main what-pros-say-section"><h2><a>Ross Benjamin</a></h2><div class="content-event">${wagerPick.matchup}</div><div class="content-date">October 28, 2026 8:00 PM EDT</div><div class="content-play">${wagerPick.pick}</div></section>`;
 const feed=require('../outside-picks').createFeed({now:()=>Date.parse(checkedAt),fetcher:async url=>new Response(url.includes('covers.com')?covers:url.includes('wagertalk.com')?wager:'<h1>No picks</h1>')});
 const result=await feed('mlb');assert.equal(result.consensus.length,1);assert.equal(result.consensus[0].count,2);
 assert.deepEqual(result.consensus[0].sources.map(s=>s.source),['Covers','WagerTalk']);
});

 test('all verified consensus groups survive beyond the first three',()=>{
 const picks=Array.from({length:5},(_,i)=>({...p,pick:`Under ${220.5+i} -110`}));
 const result=consensus([source('one',picks),source('two',picks)]);
 assert.equal(result.length,5);
 assert.ok(result.every(group=>group.count===2));
 });

test('NBA totals group verified 76ers-Hornets picks across full names, nicknames and abbreviations',()=>{
 const wager={league:'nba',author:'Jeff Michaels',pick:'Total Under 216.5 (-115)',
   matchup:'(523) Philadelphia 76ers at (524) Charlotte Hornets: Total',
   eventAt:'2026-10-31T22:10:00Z',url:'https://www.wagertalk.com/free-sports-picks/nba'};
 const boyd={league:'nba',author:'Calvin King',pick:'UNDER 216.5 -105',
   matchup:'76ers vs Hornets',eventDate:'2026-10-31',
   url:'https://www.boydsbets.com/free-nba-picks/'};
 const covers={league:'nba',author:'Another Analyst',pick:'Under 216.5 (-110)',
   matchup:'PHI vs CHA',eventDate:'2026-10-31',
   url:'https://www.covers.com/picks/nba'};
 const compare=(w,b,c)=>consensus([source('wagertalk',[w]),source('boyds',[b]),source('covers',c?[c]:[])]);
 const result=compare(wager,boyd,covers);
 assert.equal(result.length,1);
 assert.equal(result[0].count,3);
 assert.equal(result[0].pick,'under 216.5');
 assert.deepEqual(result[0].sources.map(s=>s.author),['Jeff Michaels','Calvin King','Another Analyst']);
 for(const other of [
  {...boyd,pick:'OVER 216.5 -105'},
  {...boyd,pick:'UNDER 217.5 -105'},
  {...boyd,matchup:'76ers vs Bulls'},
  {...boyd,eventDate:'2026-11-01'},
  {...boyd,league:'ncaab'}
 ])assert.deepEqual(compare(wager,other),[],JSON.stringify(other));
});
test('Unverified Pickswise author labels cannot create false multi-source consensus',()=>{
 const placeholder={...p,author:'Pickswise (analyst unverified)',authorVerified:false};
 assert.deepEqual(consensus([source('pickswise',[placeholder]),source('covers',[{...p,author:'Verified Analyst'}])]),[]);
});
