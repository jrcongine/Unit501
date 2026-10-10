'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const {summarize, createRankings, fbsName} = require('../rankings');
const membership = require('../fbs-2026.json');
const query = {league:'2',season:'2026',before:2000000,away:'1',home:'2'};
const teams = membership.teams.map((t,i) => ({id:i+1,name:t.name}));
const opponent = {id:1000,name:'Idaho'};
function fixture() {
  const games = teams.map((team,i) => ({league:{id:2,season:2026},
    game:{id:i+1,date:{timestamp:1000},status:{short:'FT'}},
    teams:{away:team,home:opponent}, scores:{away:{total:i},home:{total:138-i}}}));
  const boxes = new Map(games.map((g,i) => [String(g.game.id),[
    {team:g.teams.away,statistics:{rushings:{total:i},passing:{total:i*2}}},
    {team:opponent,statistics:{rushings:{total:138-i},passing:{total:(138-i)*2}}}
  ]]));
  return {games,boxes};
}
test('verified list is unique and aliases do not confuse FBS/FCS or Miami schools', () => {
  assert.equal(teams.length,138);
  const aliases = membership.teams.flatMap(t => t.aliases.map(name => [name,t.name]));
  for (const [name,expected] of aliases) assert.equal(fbsName({name},'2026'),expected);
  assert.equal(fbsName({name:'Miami (OH)'},'2026'),'Miami (OH)');
  assert.equal(fbsName({name:'Miami (FL)'},'2026'),'Miami');
  assert.equal(fbsName({name:'Idaho'},'2026'),null);
  assert.equal(fbsName({name:'North Dakota State'},'2026'),'North Dakota State');
  assert.equal(fbsName({name:'Sacramento State'},'2026'),'Sacramento State');
  assert.equal(fbsName({name:'Arkansas'},'2027'),null);
});
test('complete FBS pool ranks offense descending, defense ascending; FCS excluded', () => {
  const {games,boxes}=fixture();
  const result=summarize(games,boxes,query,[...teams,opponent]);
  const best=result.teams.find(t=>t.id==='138');
  for (const [key] of result.metrics) {
    assert.equal(best.metrics[key].rank,1);
    assert.equal(best.metrics[key].pool,138);
    assert.equal(result.teams.find(t=>t.id==='1000').metrics[key].rank,null);
  }
});
test('missing yardage suppresses only affected categories, never zero-fills; ties share rank', () => {
  const {games,boxes}=fixture();
  boxes.get('138')[0].statistics.rushings.total=null;
  games[136].scores.away.total=137;
  const result=summarize(games,boxes,query,teams);
  assert.equal(result.coverage.rushFor.complete,137);
  assert.equal(result.teams[137].metrics.rushFor.average,null);
  assert.ok(result.teams.every(t=>t.metrics.rushFor.rank===null));
  assert.equal(result.teams[136].metrics.pointsFor.rank,1);
  assert.equal(result.teams[137].metrics.pointsFor.rank,1);
  assert.equal(result.teams[135].metrics.pointsFor.rank,3);
  assert.equal(result.teams[137].metrics.passFor.rank,1);
});
test('unmatched membership, future season and cutoff cannot produce national ranks', () => {
  const {games,boxes}=fixture();
  const missing=summarize(games,boxes,query,teams.slice(1));
  assert.equal(missing.missingTeams.length,1);
  assert.ok(missing.teams.every(t=>t.metrics.pointsFor.rank===null));
  const before=summarize(games,boxes,{...query,before:1000000},teams);
  assert.ok(before.teams.every(t=>t.games===0));
  const future=summarize(games,boxes,{...query,season:'2027'},teams);
  assert.ok(future.teams.every(t=>t.metrics.pointsFor.rank===null));
});
test('NFL complete pool still ranks and excludes preseason', () => {
  const {games,boxes}=fixture();
  const nfl=games.slice(0,32).map(g=>({...g,league:{id:1,season:2026},game:{...g.game,stage:'Regular Season'}}));
  const result=summarize(nfl,boxes,{...query,league:'1'},teams.slice(0,32));
  assert.equal(result.teams[31].metrics.pointsFor.rank,1);
  assert.equal(result.teams[31].metrics.pointsFor.pool,32);
  nfl[0].game.stage='Pre Season';
  assert.equal(summarize(nfl,boxes,{...query,league:'1'},teams.slice(0,32)).teams[0].games,0);
});
test('build fetches whole league, prioritizes selected games, shares cached boxes across matchups', async () => {
  const {games,boxes}=fixture();
  const cacheDir=await fs.mkdtemp(path.join(os.tmpdir(),'unit501-test-'));
  const requested=[];
  const api=async endpoint=>{
    requested.push(endpoint);
    if(endpoint.startsWith('/games?')) return {response:[...games,games[0]]};
    return {response:boxes.get(endpoint.split('=')[1])};
  };
  try {
    const get=createRankings(api,{delayMs:0,cacheDir});
    const job=get(query);
    const deadline=Date.now()+10000;
    while(job.state==='loading' && Date.now()<deadline) await new Promise(r=>setTimeout(r,5));
    assert.equal(job.state,'ready');
    assert.equal(requested[0],'/games?league=2&season=2026');
    assert.deepEqual(requested.filter(p=>p.includes('statistics')).slice(0,2),['/games/statistics/teams?id=1','/games/statistics/teams?id=2']);
    assert.ok(requested.includes('/games?team=1000&season=2026'));
    assert.equal(job.data.teams.find(t=>t.id==='1000').opponentScheduleVerified,true);
    assert.equal(job.completed,138);
    assert.equal(job.data.teams[137].metrics.pointsFor.rank,1);
    const next=get({...query,away:'3',home:'4'});
    while(next.state==='loading' && Date.now()<deadline) await new Promise(r=>setTimeout(r,5));
    assert.equal(next.state,'ready');
    assert.equal(requested.filter(p=>p.includes('statistics')).length,138);
  } finally {await fs.rm(cacheDir,{recursive:true,force:true});}
});

test('opponent history is deduplicated, team-scoped and excludes games at or after cutoff',()=>{
 const {games,boxes}=fixture();
 const original=games[0];
 const future={...original,game:{...original.game,id:999,date:{timestamp:2000}}};
 const result=summarize([...games,original,future],boxes,query,[...teams,opponent]);
 const team=result.teams.find(t=>t.id==='1');
 assert.equal(team.opponents.length,1);
 assert.deepEqual(team.opponents[0],{id:'1000',scored:0,allowed:138});
 const other=result.teams.find(t=>t.id==='1000');
 assert.deepEqual(other.opponents[0],{id:'1',scored:138,allowed:0});
});

test('home venue history counts only deduplicated pre-kickoff home appearances',()=>{
 const {games,boxes}=fixture();
 games[0].game.venue={name:'Test Stadium'};
 const future={...games[0],game:{...games[0].game,id:999,date:{timestamp:2000}}};
 const data=summarize([...games,games[0],future],boxes,query,[...teams,opponent]);
 assert.deepEqual(data.teams.find(t=>t.id==='1').homeVenues,{});
 assert.equal(data.teams.find(t=>t.id==='1000').homeVenues.teststadium,1);
});

test('supplemental failures preserve rankings and never mark an opponent schedule verified',async()=>{
 const {games,boxes}=fixture();
 const cacheDir=await fs.mkdtemp(path.join(os.tmpdir(),'unit501-extra-'));
 const api=async endpoint=>{
  if(endpoint.startsWith('/games?league='))return {response:games};
  if(endpoint.startsWith('/games?team='))return {response:[],paging:{total:2}};
  return {response:boxes.get(endpoint.split('=')[1])};
 };
 try {
  const job=createRankings(api,{delayMs:0,cacheDir})(query);
  const deadline=Date.now()+10000;
  while(job.state==='loading' && Date.now()<deadline)await new Promise(r=>setTimeout(r,5));
  assert.equal(job.state,'ready');
  assert.equal(job.data.coverage.pointsFor.ranked,true);
  const extra=job.data.teams.find(t=>t.id==='1000');
  assert.equal(extra.opponentScheduleVerified,false);
  assert.equal(extra.metrics.pointsFor.rank,null);
 }finally{await fs.rm(cacheDir,{recursive:true,force:true});}
});
test('complete scoring is published before the first yardage box finishes',async()=>{
 const roster=teams.slice(0,32);
 const games=[];
 for(let week=0;week<2;week++)for(let i=0;i<32;i+=2)games.push({league:{id:1,season:2026},
  game:{id:games.length+1,stage:'Regular Season',date:{timestamp:1000+week*100},status:{short:'FT'}},
  teams:{away:roster[i],home:roster[i+1]},scores:{away:{total:24},home:{total:24}}});
 let release,started;
 const gate=new Promise(r=>{release=r;});const waiting=new Promise(r=>{started=r;});
 let count=0;
 const api=async endpoint=>{
  if(endpoint.startsWith('/games?'))return {response:games};
  if(++count===1){started();await gate;}
  return {response:[]};
 };
 const cacheDir=await fs.mkdtemp(path.join(os.tmpdir(),'unit501-scoring-'));
 try {
  const q={...query,league:'1'};
  const job=createRankings(api,{delayMs:0,cacheDir})(q);
  await waiting;
  assert.equal(job.state,'loading');assert.equal(job.completed,0);
  assert.equal(job.data.coverage.pointsFor.ranked,true);
  assert.equal(require('../public/team-model').project(job.data,{league:'1',season:q.season,kickoff:q.before,awayId:q.away,homeId:q.home}).available,true);
  release();const deadline=Date.now()+10000;
  while(job.state==='loading'&&Date.now()<deadline)await new Promise(r=>setTimeout(r,5));
  assert.equal(job.state,'ready');
 }finally{release();await fs.rm(cacheDir,{recursive:true,force:true});}
});
