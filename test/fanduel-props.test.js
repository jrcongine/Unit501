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
test('retains numeric one-sided lines without inventing the missing side and rejects conflicts',()=>{
 const one=parseProps(event(outcomes.slice(0,1)),now);assert.equal(one.length,1);assert.equal(one[0].over,-110);assert.equal(one[0].under,null);assert.equal(one[0].line,250.5);
 assert.equal(parseProps(event([outcomes[0],{...outcomes[1],point:251.5}]),now).length,0);
 assert.equal(parseProps(event([...outcomes,outcomes[0]]),now).length,1);
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

test('all modeled markets have explicit coverage and duplicate market snapshots are withheld',()=>{
 const {marketCoverage}=require('../fanduel-props');
 const first=event();
 first.bookmakers[0].markets.push({...first.bookmakers[0].markets[0],outcomes:outcomes.map(o=>({...o,description:'Mason Heintschel.',point:251.5}))});
 assert.deepEqual(parseProps(first,now),[]);
 const stats=require('../public/player-stats').definitions.map(d=>d.key).sort();
 const coverage=marketCoverage(parseProps(event(),now));
 assert.deepEqual(coverage.map(m=>m.stat).sort(),stats);
 assert.equal(coverage.find(m=>m.stat==='passYds').lines,1);
 assert.ok(coverage.filter(m=>m.stat!=='passYds').every(m=>m.lines===0));
});

test('401 reports safe provider code and does not cache failed authentication for five minutes',async()=>{
 const oldFetch=global.fetch,oldKey=process.env.ODDS_API_KEY;
 process.env.ODDS_API_KEY='fake-testing-key';
 const q={away:'Auth Test Away',home:'Auth Test Home',league:'2',kickoff:Date.now()+3*86400000};
 let calls=0;
 global.fetch=async()=>{
   calls++;
   return {ok:false,status:401,json:async()=>({error_code:'INVALID_KEY',message:'https://example.invalid/?apiKey=SECRET_SHOULD_NOT_LEAK'})};
 };
 try {
   await assert.rejects(getProps(q),e=>e.message.includes('401 (INVALID_KEY)')&&e.message.includes('ODDS_API_KEY')&&!e.message.includes('SECRET_SHOULD_NOT_LEAK'));
   await assert.rejects(getProps(q),/INVALID_KEY/);
   assert.equal(calls,2,'A failed response must not be cached for five minutes');
 }finally{
   global.fetch=oldFetch;
   if(oldKey===undefined)delete process.env.ODDS_API_KEY;else process.env.ODDS_API_KEY=oldKey;
 }
});
test('exhausted monthly credits receive a distinct actionable message',async()=>{
 const oldFetch=global.fetch,oldKey=process.env.ODDS_API_KEY;
 process.env.ODDS_API_KEY='fake-testing-key';
 const q={away:'Quota Test Away',home:'Quota Test Home',league:'2',kickoff:Date.now()+3*86400000};
 global.fetch=async()=>({ok:false,status:401,json:async()=>({error_code:'OUT_OF_USAGE_CREDITS'})});
 try {
   await assert.rejects(getProps(q),/monthly usage credits exhausted/);
 }finally{
   global.fetch=oldFetch;
   if(oldKey===undefined)delete process.env.ODDS_API_KEY;else process.env.ODDS_API_KEY=oldKey;
 }
});
