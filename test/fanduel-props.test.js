'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {parseProps,matches,getProps}=require('../fanduel-props');
const now=Date.now();
const outcomes=[{name:'Over',description:'Mason Heintschel',point:250.5,price:-110},{name:'Under',description:'Mason Heintschel',point:250.5,price:-110}];
const event=(rows=outcomes,stamp=now,key='player_pass_yds',book='fanduel')=>({bookmakers:[{key:book,markets:[{key,last_update:new Date(stamp).toISOString(),outcomes:rows}]}]});
test('matches exact matchup, college mascot suffix and kickoff, rejects different opponent',()=>{
 const e={away_team:'Pittsburgh Panthers',home_team:'Virginia Tech Hokies',commence_time:new Date(now+86400000).toISOString()};
 const q={away:'Pittsburgh',home:'Virginia Tech',league:'2',kickoff:now+86400000};
 assert.equal(Boolean(matches(e,q)),true);
 assert.equal(Boolean(matches(e,{...q,home:'Virginia'})),false);
 assert.equal(Boolean(matches(e,{...q,home:'Ohio'})),false);
 assert.equal(Boolean(matches(e,{...q,kickoff:now})),false);
});
test('only paired fresh main FanDuel props are returned',()=>{
 assert.equal(parseProps(event(),now)[0].line,250.5);
 assert.equal(parseProps(event(outcomes,now-1800001),now).length,0);
 assert.equal(parseProps(event(outcomes,now+120000),now).length,0);
 assert.equal(parseProps(event(outcomes,now,'player_pass_yds_alternate'),now).length,0);
 assert.equal(parseProps(event(outcomes,now,'player_pass_yds','draftkings'),now).length,0);
});
test('rejects one-sided, conflicting and duplicate quotes',()=>{
 assert.equal(parseProps(event(outcomes.slice(0,1)),now).length,0);
 assert.equal(parseProps(event([outcomes[0],{...outcomes[1],point:251.5}]),now).length,0);
 assert.equal(parseProps(event([...outcomes,outcomes[0]]),now).length,0);
});
test('rushing attempts, RB receiving yards and receptions parse paired main lines',()=>{
 for(const [key,stat]of [['player_rush_attempts','carries'],['player_reception_yds','recYds'],['player_receptions','rec']]) {
   const rows=outcomes.map(o=>({...o,description:'Running Back',point:15.5}));
   assert.equal(parseProps(event(rows,now,key),now)[0].stat,stat);
 }
});
test('event lookup and per-game odds use server key and share cached calls',async()=>{
 const originalFetch=global.fetch, originalKey=process.env.ODDS_API_KEY;
 process.env.ODDS_API_KEY='test-key';
 const q={away:'Test Away',home:'Test Home',league:'1',kickoff:now+86400000};
 const e={id:'fixture',away_team:q.away,home_team:q.home,commence_time:new Date(q.kickoff).toISOString()};
 const urls=[];
 global.fetch=async url=>{urls.push(url);return {ok:true,json:async()=>url.includes('/fixture/odds')?{...e,...event() }:[e]};};
 try {
  const [a,b]=await Promise.all([getProps(q),getProps(q)]);
  assert.equal(a.props.length,1);assert.deepEqual(a,b);assert.equal(urls.length,2);
  assert.ok(urls[1].includes('bookmakers=fanduel'));
  assert.ok(urls[1].includes('player_receptions'));
 } finally {global.fetch=originalFetch;if(originalKey===undefined)delete process.env.ODDS_API_KEY;else process.env.ODDS_API_KEY=originalKey;}
});
