'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {parse,URLS}=require('../pickswise-picks');
const clock=Date.parse('2026-10-19T16:00:00Z');
const table=rows=>'<table><thead><tr><th>Match</th><th>Our Pick</th><th>Rating</th><th>Best Odds</th><th>Where to Bet</th><th>Action</th></tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map(cell=>'<td>'+cell+'</td>').join('')+'</tr>').join('')+'</tbody></table>';
const cards=`<h1>College Football Picks Today</h1>
<a>Chad Hartsock</a>
<a>Middle TennesseeFlorida International College FootballTue, Oct 20 7:00 PM</a>
<div>Point Spread Pick Read more These are fairly even. Take the road underdogs.</div>
<a>Spread - Middle Tennessee +10+108</a>
<a>Aaron Taylor</a>
<a>Missouri StateDelaware College FootballTue, Oct 20 7:00 PM</a>
<div>Point Spread Pick Read more Delaware needs a win.</div>
<a>Spread - Delaware -3+109</a>
<a>Aaron Taylor</a>
<a>East CarolinaMemphis College FootballThu, Oct 22 7:30 PM</a>
<div>Game Totals Pick Value Pick Read more We expect a low-scoring contest.</div>
<a>Under 54.5+100</a>`;
const summary=table([
 ['Missouri State vs Delaware','Spread - Delaware -3','3⭐','+109','Polymarket','Bet Now'],
 ['Middle Tennessee vs Florida International','Spread - Middle Tennessee +10','3⭐','+108','Novig','Bet Now'],
 ['East Carolina vs Memphis','Under 54.5','4⭐','+100','Hard Rock Bet','Bet Now']
]);
test('parses named picks by selection, not misleading summary-table order',()=>{
 const picks=parse(cards+summary,'ncaaf',clock);
 assert.equal(picks.length,3);
 assert.deepEqual(picks.map(p=>p.author),['Aaron Taylor','Chad Hartsock','Aaron Taylor']);
 assert.deepEqual(picks.map(p=>p.pick),['Spread - Delaware -3 (+109 best available on source)','Spread - Middle Tennessee +10 (+108 best available on source)','Under 54.5 (+100 best available on source)']);
 assert.equal(picks[1].eventDate,'2026-10-20');
 assert.equal(picks[2].sourceRating,4);
 assert.equal(picks[0].url,URLS.ncaaf);
});
test('MLB moneyline and NFL prop require explicit table entries, not analysis guesses',()=>{
 const mlb='<a>Jason Fragomeni</a><a>Cleveland GuardiansTampa Bay Rays MLBMon, Oct 19 8:05 PM</a><div>Money Line Pick Read more Home team advantage.</div><a>Moneyline - Tampa Bay Rays-141</a>';
 const mlbRows=table([['Cleveland Guardians vs Tampa Bay Rays','Moneyline - Tampa Bay Rays','5⭐','-141','Novig','Bet Now']]);
 assert.equal(parse(mlb+mlbRows,'mlb',clock)[0].author,'Jason Fragomeni');
 const nfl='<a>Justin Martin (JutPicks)</a><a>Washington CommandersSan Francisco 49ers NFLMon, Oct 19 8:15 PM</a><div>Player Prop Pick Read more Route share.</div><a>Jacob Cowing - Anytime Touchdown Scorer - Yes+413</a>';
 const nflRows=table([['Washington Commanders vs San Francisco 49ers','Jacob Cowing - Anytime Touchdown Scorer - Yes','2⭐','+413','Novig','Bet Now']]);
 const props=parse(nfl+nflRows,'nfl',clock);
 assert.equal(props.length,1);assert.equal(props[0].author,'Justin Martin (JutPicks)');
});
test('fails closed on page changes, missing moneyline prices, broken odds and past events',()=>{
 assert.deepEqual(parse('<h1>Login</h1>','nfl',clock),[]);
 assert.deepEqual(parse(cards+summary.replaceAll('Best Odds','Price'),'ncaaf',clock),[]);
 assert.deepEqual(parse(cards+summary.replaceAll('+109','market'),'ncaaf',clock).map(x=>x.pick).filter(s=>s.includes('Delaware')),[]);
 assert.deepEqual(parse(cards+summary,'nfl',clock+7*86400000),[]);
 assert.deepEqual(parse(cards+summary,'basketball',clock),[]);
});
test('without clear analyst only identifies source; never fabricates personal attribution',()=>{
 const row=table([['A vs B','Spread - A +3','3⭐','-110','Book','Bet Now']]);
 const picks=parse('<h1>Free picks</h1>'+row,'nfl',clock);
 assert.equal(picks.length,1);assert.equal(picks[0].author,'Pickswise (analyst unverified)');
 assert.equal(picks[0].authorVerified,false);
 assert.match(picks[0].eventLabel,/unverified/);
});
