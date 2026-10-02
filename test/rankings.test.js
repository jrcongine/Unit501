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
    assert.deepEqual(requested.slice(1,3),['/games/statistics/teams?id=1','/games/statistics/teams?id=2']);
    assert.equal(job.completed,138);
    assert.equal(job.data.teams[137].metrics.pointsFor.rank,1);
    const next=get({...query,away:'3',home:'4'});
    while(next.state==='loading' && Date.now()<deadline) await new Promise(r=>setTimeout(r,5));
    assert.equal(next.state,'ready');
    assert.equal(requested.filter(p=>p.includes('statistics')).length,138);
  } finally {await fs.rm(cacheDir,{recursive:true,force:true});}
});
