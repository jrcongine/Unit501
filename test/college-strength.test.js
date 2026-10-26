'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const membership=require('../fbs-2026.json');
const {buildCollegeStrength,fit}=require('../college-strength');
const {createLeaguePulse,buildPowerBoard}=require('../league-pulse');
const at=Date.parse('2026-10-25T20:00:00Z');
function fixture(extra=[],inflate=0){
 const names=membership.teams.map(t=>t.name),stats=names.map(()=>({wins:0,losses:0,for:0,against:0}));
 const matches=names.map((_,i)=>[i,(i+1)%names.length,21+inflate,14]).concat(extra);
 const games=matches.map(([a,b,sa,sb],i)=>{
  for(const [own,scored,allowed] of [[a,sa,sb],[b,sb,sa]])if(own!==null){stats[own].wins+=scored>allowed?1:0;stats[own].losses+=scored<allowed?1:0;stats[own].for+=scored;stats[own].against+=allowed;}
  return {league:{id:2,season:2026},game:{id:i+1,date:{timestamp:Math.floor(at/1000)-86400-i*3600},status:{short:'FT'}},
   teams:{away:{id:a===null?999:a+1,name:a===null?'Example FCS':names[a]},home:{id:b===null?999:b+1,name:b===null?'Example FCS':names[b]}},scores:{away:{total:sa},home:{total:sb}}};
 });
 const raw={season:{year:2026},children:[{standings:{entries:names.map((name,i)=>({team:{id:String(i+1),displayName:name},stats:[
  {name:'wins',value:stats[i].wins},{name:'losses',value:stats[i].losses},
  {name:'pointsFor',value:stats[i].for},{name:'pointsAgainst',value:stats[i].against},
  {name:'pointDifferential',value:stats[i].for-stats[i].against}
 ]}))}}]};
 return {board:buildPowerBoard(raw,'ncaaf',2026,at),payload:{response:games},raw};
}
test('equal records against stronger opponents produce higher strength without school or conference priors',()=>{
 const games=[{a:0,b:2,y:1},{a:0,b:3,y:0},{a:1,b:4,y:1},{a:1,b:5,y:0}];
 for(const a of [2,3])for(const b of [4,5])for(let n=0;n<3;n++)games.push({a,b,y:1});
 const rating=fit(games,6);
 assert.ok(rating.every(Number.isFinite));assert.ok(rating[0]>rating[1]);
 assert.ok(Math.abs(rating.reduce((s,r)=>s+r,0))<1e-8);
 const reversed=fit(games.map(g=>({a:g.b,b:g.a,y:1-g.y})).reverse(),6);
 rating.forEach((r,i)=>assert.ok(Math.abs(r-reversed[i])<1e-8));
});
test('all FBS teams retain rank and overall record, while FCS wins and blowout size do not boost the strength graph',()=>{
 const normal=fixture(),inflated=fixture([],60),fcs=fixture([[0,null,60,0]]);
 const a=buildCollegeStrength(normal.board,normal.payload,at),b=buildCollegeStrength(inflated.board,inflated.payload,at),c=buildCollegeStrength(fcs.board,fcs.payload,at);
 assert.equal(a.available,true);assert.equal(a.board.count,138);
 assert.equal(a.board.teams.length,138);assert.deepEqual(a.board.teams.map(t=>t.rank),Array.from({length:138},(_,i)=>i+1));
 assert.deepEqual(a.board.teams.map(t=>t.score),b.board.teams.map(t=>t.score));
 assert.deepEqual(a.board.teams.map(t=>t.score),c.board.teams.map(t=>t.score));
 const first=c.board.teams.find(t=>t.name===membership.teams[0].name);
 assert.equal(first.record,'2-1');assert.equal(first.fbsRecord,'1-1');assert.equal(first.excludedFCS,1);
 assert.equal(first.scheduleRank,1);assert.equal(first.score,50);
 assert.equal(a.board.scheduleAdjustment.applied,true);assert.equal(a.board.scheduleAdjustment.games,138);
 assert.match(a.board.explanation,/not a win probability/);
 assert.match(a.board.explanation,/no scoring-margin bonus/);
});
test('future results, duplicate identical rows and ordering cannot rewrite an earlier board',()=>{
 const f=fixture([[0,1,24,17]]),before=JSON.stringify(f);
 const a=buildCollegeStrength(f.board,f.payload,at);
 const future=structuredClone(f.payload.response[0]);future.game.id=9000;future.game.date.timestamp=at/1000+1;future.scores.away.total=150;
 const b=buildCollegeStrength(f.board,{response:[future,...f.payload.response,f.payload.response[0]].reverse()},at);
 assert.deepEqual(a,b);assert.equal(JSON.stringify(f),before);
});
test('partial or conflicting results cannot be passed off as schedule-adjusted national ranks',()=>{
 const f=fixture();
 const badScore=structuredClone(f.payload);badScore.response[0].scores.away.total=null;
 const badTotals=structuredClone(f.payload);badTotals.response[0].scores.away.total+=7;badTotals.response[0].scores.home.total+=7;
 const conflict=structuredClone(f.payload.response[0]);conflict.scores.away.total=100;
 const wrong=structuredClone(f.payload);wrong.response[0].league.season=2025;
 const missing=structuredClone(f.payload);missing.response[0].teams.away.name='Unverified school';
 for(const p of [{response:f.payload.response.slice(1)},{response:[...f.payload.response,conflict]},badScore,badTotals,wrong,missing,
  {response:f.payload.response,paging:{total:2}},{response:f.payload.response,errors:{plan:'no access'}},{response:null}]){
  assert.equal(buildCollegeStrength(f.board,p,at).available,false);
 }
 assert.equal(buildCollegeStrength({...f.board,season:2027},f.payload,at).available,false);
 assert.equal(buildCollegeStrength({...f.board,league:'nfl'},f.payload,at).available,false);
});
test('two games per team do not establish national comparisons across disconnected schedule groups',()=>{
 const f=fixture();
 // Two independent cycles; totals still match the standings exactly.
 f.payload.response[68].teams.home={id:1,name:membership.teams[0].name};
 f.payload.response[137].teams.home={id:70,name:membership.teams[69].name};
 const out=buildCollegeStrength(f.board,f.payload,at);
 assert.equal(out.available,false);assert.match(out.reason,/not yet connected/);
});
test('college pulse shares one metered schedule load, marks unadjusted fallback, and leaves pro leagues alone',async()=>{
 const f=fixture();let calls=0,tick=at,fail=false;
 const pulse=createLeaguePulse({now:()=>tick,ttl:60000,request:async url=>url.includes('/standings?')?f.raw:{articles:[]},collegeSchedule:async season=>{
  assert.equal(season,2026);calls++;if(fail)throw Error('Provider budget or access unavailable');return f.payload;
 }});
 const [a,b]=await Promise.all([pulse('ncaaf'),pulse('ncaaf')]);assert.equal(calls,1);
 assert.equal(a.power.scheduleAdjustment.applied,true);assert.deepEqual(a,b);
 tick+=61000;fail=true;const c=await pulse('ncaaf');
 assert.equal(c.power.available,true);assert.equal(c.power.scheduleAdjustment.applied,false);
 assert.match(c.power.basis,/Unadjusted/);assert.equal(c.headlines.available,false);
 await pulse('nba');assert.equal(calls,2);
});

test('schedule outages respect the full paid-request cache interval, including concurrent viewers',async()=>{
 const f=fixture();let calls=0,tick=at;
 const pulse=createLeaguePulse({now:()=>tick,request:async url=>url.includes('/standings?')?f.raw:{articles:[]},collegeSchedule:async()=>{calls++;throw Error('Budget unavailable');}});
 await Promise.all([pulse('ncaaf'),pulse('ncaaf')]);assert.equal(calls,1);
 tick+=61000;await pulse('ncaaf');assert.equal(calls,1);
 tick+=15*60000;await pulse('ncaaf');assert.equal(calls,2);
});
