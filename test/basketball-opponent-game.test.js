'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createLookup}=require('../basketball-opponent-game');
for(const [league,sport] of [['nba','nba'],['ncaab','mens-college-basketball']]){
 test(league+' opponent lookup uses selected athlete, confirms final box and shares all markets',async()=>{
  const now=()=>Date.parse('2026-11-01T22:00Z'),kickoff=now()+86400000,date='2026-10-04T23:00Z';
  const event={id:'10',gameDate:date,opponent:{id:'12'},team:{id:'9'}};
  const fields=['points','totalRebounds','assists','threePointFieldGoalsMade-threePointFieldGoalsAttempted'];
  const log={filters:[{name:'league',value:sport},{name:'season',value:'2027'}],events:{10:event},names:fields,seasonTypes:[{categories:[{events:[{eventId:'10',stats:['7','0','2','1-2']}]}]}]};
  const row={athlete:{id:'100',displayName:'Test Player'},didNotPlay:false,stats:['7','0','2','1-2','12']};
  const box={header:{id:'10',season:{year:2027,type:1},competitions:[{date,status:{type:{state:'post',completed:true}},competitors:[{team:{id:'9'}},{team:{id:'12'}}]}]},boxscore:{players:[{team:{id:'9'},statistics:[{keys:['points','rebounds','assists',fields[3],'minutes'],athletes:[row]}]}]}};
  let requests=0;
  const make=()=>createLookup({now,fetcher:async u=>{requests++;return {ok:true,json:async()=>u.includes('/gamelog?')?log:box};}});
  const run=make();const [a,b]=await Promise.all([run(league,'100','12',kickoff),run(league,'100','12',kickoff)]);
  assert.equal(requests,2);assert.deepEqual(a,b);assert.equal(a.values.player_rebounds,0);assert.equal(a.stage,'Preseason');
  row.stats[0]='8';assert.equal(await make()(league,'100','12',kickoff),null);
  row.stats[0]='7';row.didNotPlay=true;assert.equal(await make()(league,'100','12',kickoff),null);
  row.didNotPlay=false;row.athlete.id='101';assert.equal(await make()(league,'100','12',kickoff),null);
 });
}
