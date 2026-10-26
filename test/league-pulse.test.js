'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {LEAGUES,seasonYear,buildPowerBoard,parseHeadlines,createLeaguePulse}=require('../league-pulse');
const membership=require('../fbs-2026.json');
function fixture(names,year,league){
 const entries=names.map((name,i)=>{
  const wins=i%7+1,losses=7-wins,ot=league==='nhl'?1:0,played=wins+losses+ot;
  const scored=played*24+i,allowed=played*21+i*2;
  return {team:{id:String(i+1),displayName:name,name},stats:[
   {name:'wins',value:wins},{name:'losses',value:losses},
   {name:'gamesPlayed',value:played},
   {name:'otLosses',value:ot},
   {name:'streak',value:i%2===0?3:-3,displayValue:i%2===0?'W3':'L3'},
   {name:'pointsFor',value:scored},
   {name:'pointsAgainst',value:allowed},
   {name:'pointDifferential',value:scored-allowed}
  ]};
 });
 return {season:{year},children:[{standings:{entries:entries.slice(0,Math.ceil(entries.length/2))}},
  {standings:{entries:entries.slice(Math.ceil(entries.length/2))}}]};
}
const nfl=Array.from({length:32},(_,i)=>'NFL Team '+(i+1));
const nba=Array.from({length:30},(_,i)=>'NBA Team '+(i+1));
test('five league categories and correct calendar-to-season mapping are supported',()=>{
 assert.deepEqual(Object.keys(LEAGUES),['nfl','ncaaf','nba','mlb','nhl']);
 assert.equal(seasonYear('nfl',Date.parse('2027-01-07T00:00:00Z')),2026);
 assert.equal(seasonYear('ncaaf',Date.parse('2026-10-25T00:00:00Z')),2026);
 assert.equal(seasonYear('nba',Date.parse('2026-10-25T00:00:00Z')),2027);
 assert.equal(seasonYear('nhl',Date.parse('2027-01-07T00:00:00Z')),2027);
 assert.equal(seasonYear('mlb',Date.parse('2026-10-25T00:00:00Z')),2026);
});
test('verified 32-team power board has Top 10 / middle / bottom 10 and genuine streak form arrows',()=>{
 const board=buildPowerBoard(fixture(nfl,2026,'nfl'),'nfl',2026,Date.parse('2026-10-25'));
 assert.equal(board.teams.length,32);
 assert.equal(board.top.length,10);
 assert.equal(board.middle.length,12);
 assert.equal(board.bottom.length,10);
 assert.deepEqual(board.teams.map(t=>t.rank),Array.from({length:32},(_,i)=>i+1));
 assert.equal(new Set(board.teams.map(t=>t.id)).size,32);
 assert.ok(board.top.every(t=>Number.isFinite(t.score)));
 assert.equal(board.teams.find(t=>t.id==='1').trend,'up');
 assert.equal(board.teams.find(t=>t.id==='2').trend,'down');
 assert.equal(board.teams.find(t=>t.id==='1').streakLabel,'W3');
 assert.match(board.trendNote,/not changes in ranking position/);
 assert.match(board.basis,/standings/);
 assert.equal(board.source,'ESPN');
});
test('rankings are withheld for missing, partial, conflicting and wrong-season sources',()=>{
 const good=fixture(nfl,2026,'nfl'),entries=good.children[0].standings.entries;
 assert.equal(buildPowerBoard(fixture(nfl.slice(1),2026,'nfl'),'nfl',2026,0),null);
 assert.equal(buildPowerBoard(fixture(nfl,2025,'nfl'),'nfl',2026,0),null);
 entries[0].stats.find(s=>s.name==='pointsFor').value=5;
 assert.equal(buildPowerBoard(good,'nfl',2026,0),null);
 const duplicate=fixture(nfl,2026,'nfl');
 duplicate.children[1].standings.entries[0].team.id='1';
 assert.equal(buildPowerBoard(duplicate,'nfl',2026,0),null);
});
test('NHL accounts for overtime points and college only allows verified FBS schools',()=>{
 const clubs=Array.from({length:32},(_,i)=>'NHL Team '+(i+1));
 const nhl=buildPowerBoard(fixture(clubs,2027,'nhl'),'nhl',2027,0);
 assert.equal(nhl.count,32);
 assert.match(nhl.teams[0].record,/\d+-\d+-1/);
 const schools=membership.teams.map(t=>t.name);
 const raw=fixture(schools,2026,'ncaaf');
 for(const entry of raw.children.flatMap(c=>c.standings.entries)){
  const wins=entry.stats.find(x=>x.name==='wins').value;
  const losses=entry.stats.find(x=>x.name==='losses').value;
  entry.stats=entry.stats.filter(x=>x.name!=='losses');
  entry.stats.push({name:'overall',displayValue:wins+'-'+losses});
 }
 const college=buildPowerBoard(raw,'ncaaf',2026,0);
 assert.ok(college);
 assert.equal(college.count,membership.teams.length);
 assert.equal(college.top.length,10);
 assert.equal(college.bottom.length,10);
});
test('headline links show verified publisher, time and topic, rejecting unsafe links and dates',()=>{
 const now=Date.parse('2026-10-25T14:00:00Z');
 const articles=[
  {headline:'DK Metcalf questionable with ankle injury',published:new Date(now-300000).toISOString(),
   links:{web:{href:'https://www.espn.com/nfl/story/_/id/123'}}},
  {headline:'Coach faces questions after loss',published:new Date(now-400000).toISOString(),
   links:{web:{href:'http://www.espn.com/nfl/story/_/id/124'}}},
  {headline:'Malicious link',published:new Date(now-1000).toISOString(),links:{web:{href:'https://example.test/article'}}},
  {headline:'Future headline',published:new Date(now+86400000).toISOString(),links:{web:{href:'https://www.espn.com/future'}}},
  {headline:'Old headline',published:new Date(now-15*86400000).toISOString(),links:{web:{href:'https://www.espn.com/old'}}}
 ];
 const out=parseHeadlines({articles},'nfl',now);
 assert.equal(out.length,2);
 assert.equal(out[0].category,'Injury report');
 assert.equal(out[1].category,'Coaching');
 assert.match(out[1].url,/^https:/);
 assert.equal(out[0].publishedAt,new Date(now-300000).toISOString());
 assert.deepEqual(parseHeadlines({articles},'unknown',now),[]);
});
test('league pulse caches standings and headlines independently and preserves news on rankings outage',async()=>{
 const at=Date.parse('2026-10-25T14:00:00Z'),calls=[];
 let tick=at,failStandings=false;
 const request=async url=>{
  calls.push(url);
  if(url.includes('/standings?')){
   if(failStandings)throw Error('temporary provider outage');
   return fixture(nfl,2026,'nfl');
  }
  return {articles:[{headline:'NFL coaching update',published:new Date(tick-1000).toISOString(),
    links:{web:{href:'https://www.espn.com/nfl/news'}}}]};
 };
 const load=createLeaguePulse({request,now:()=>tick,ttl:60000});
 const first=await load('nfl');
 assert.equal(first.power.count,32);
 assert.equal(first.headlines.items.length,1);
 assert.equal(calls.length,2);
 await load('nfl');assert.equal(calls.length,2);
 tick+=61000;failStandings=true;
 const second=await load('nfl');
 assert.equal(second.power.available,false);
 assert.equal(second.headlines.items.length,1);
 assert.equal(calls.length,4);
 assert.equal(await load('unsupported'),null);
});

test('duplicate standings cannot hide conflicting records or scoring totals in any league',()=>{
 for(const league of Object.keys(LEAGUES)){
  const names=league==='ncaaf'?membership.teams.map(t=>t.name):Array.from({length:LEAGUES[league].teams},(_,i)=>league+' Team '+i);
  for(const change of ['record','scoring']){
   const raw=fixture(names,2026,league);
   const duplicate=structuredClone(raw.children[0].standings.entries[0]);
   const stat=name=>duplicate.stats.find(s=>s.name===name);
   // Both changes preserve games played and point differential: the old
   // duplicate gate silently accepted them and depended on source row order.
   if(change==='record'){stat('wins').value++;stat('losses').value--;}
   else{stat('pointsFor').value+=7;stat('pointsAgainst').value+=7;}
   raw.children.push({standings:{entries:[duplicate]}});
   assert.equal(buildPowerBoard(raw,league,2026,0),null,league+' '+change);
   raw.children.reverse();
   assert.equal(buildPowerBoard(raw,league,2026,0),null,league+' reversed '+change);
  }
  const raw=fixture(names,2026,league);
  const expected=buildPowerBoard(raw,league,2026,0);
  raw.children.push({standings:{entries:[structuredClone(raw.children[0].standings.entries[0])]}});
  assert.deepEqual(buildPowerBoard(raw,league,2026,0),expected);
 }
});
