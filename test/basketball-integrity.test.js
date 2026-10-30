'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const nba=require('../nba-player-history'),college=require('../ncaab-players'),{project}=require('../public/nba-player-model');
const nbaRaw=require('./fixtures/nba-20261029.json'),cbbRaw=require('./fixtures/cbb-20260406.json');
function identity(d){const c=d.header.competitions[0],a=c.competitors.find(t=>t.homeAway==='away'),h=c.competitors.find(t=>t.homeAway==='home');return {id:d.header.id,tipoff:c.date,season:d.header.season.year,stage:d.header.season.type,awayId:a.id,homeId:h.id,opponentId:h.id,venue:'away',for:Number(a.score),against:Number(h.score)};}
test('real NBA and college boxes preserve zero markets and explicit DNP independently',()=>{
 for(const [d,extract]of [[nbaRaw,(d,g)=>nba.extractBox(d,g,g.awayId,g.season-1,g.stage)],[cbbRaw,(d,g)=>college.extract(d,g,g.awayId)]]){
  const g=identity(d),active=extract(d,g),inactive=nba.extractInactive(d,g.awayId,active);
  const source=d.boxscore.players.find(t=>t.team.id===g.awayId).statistics[0];
  assert.equal(active.length,source.athletes.filter(p=>!p.didNotPlay).length);assert.equal(inactive.length,source.athletes.filter(p=>p.didNotPlay).length);
  assert(active.some(p=>(p.values||p).player_threes===0));assert(active.every(p=>!inactive.some(x=>x.id===p.id)));
 }
});
test('college box score cannot use a different season or stage',()=>{const g=identity(cbbRaw);for(const change of [{season:g.season+1},{stage:2}])assert.throws(()=>college.extract(cbbRaw,{...g,...change},g.awayId),/identity/);});
test('any made or attempted shot contradicts DNP, including field goals and free throws',()=>{
 for(const field of ['fieldGoalsMade-fieldGoalsAttempted','freeThrowsMade-freeThrowsAttempted'])assert.equal(nba.conflictingDNP({didNotPlay:true,stats:['0-1']},[field]),true);
});
test('college conflicting schedules withhold player history even when remaining boxes are complete',async()=>{
 const g=identity(cbbRaw),get=college.createPlayers({feed:{context:async()=>({away:{id:g.awayId,name:'Away',conflicts:1,recentGames:[]},home:{id:g.homeId,name:'Home',conflicts:0,recentGames:[]}})},fetcher:async()=>{throw Error('No game requested');}});
 const r=await get.history(g);assert.equal(r.teams[0].available,false);assert.deepEqual(r.teams[0].players,[]);
});
test('both basketball leagues share zero-inclusive median, counts and unknown-history gate',()=>{
 const now=Date.parse('2026-11-01T12:00:00Z'),game={id:'99',tipoff:'2026-11-02T00:00:00Z'},quote={name:'Test Player',market:'player_points',line:10};
 const p={id:'1',name:quote.name,available:true,results:[0,10,20,0].map((n,i)=>({gameId:String(i+1),tipoff:'2026-10-'+(20+i)+'T00:00:00Z',minutes:10,player_points:n})),inactive:[{gameId:'5'}],coverage:{total:5,played:4,dnp:1,missing:0}};
 const history={gameId:game.id,tipoff:game.tipoff,checkedAt:now,teams:[{available:true,players:[p]},{available:true,players:[]}]};
 let out=project(history,quote,game,null,now);assert.equal(out.average,7.5);assert.equal(out.median,5);assert.equal(out.games,4);assert.equal(out.above,1);assert.equal(out.below,2);assert.equal(out.equal,1);assert.equal(out.coverage.dnp,1);
 p.coverage.missing=1;assert.equal(project(history,quote,game,null,now).available,false);
});
