'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {replay}=require('../nba-player-backtest');
function fixture(){
 const games=[],responses=new Map();
 for(let i=0;i<20;i++){
  const id=i+1,tipoff=new Date(Date.UTC(2025,9,1+i,23)).toISOString();
  games.push({id,stage:2,league:'standard',season:2025,date:{start:tipoff},status:{short:3},teams:{visitors:{id:1,name:'Away'},home:{id:2,name:'Home'}},scores:{visitors:{points:100},home:{points:110}}});
  const competitors=[{id:'1',homeAway:'away',score:'100'},{id:'2',homeAway:'home',score:'110'}];
  const players=[1,2].map(n=>({team:{id:String(n)},statistics:[{keys:['minutes','points','rebounds','assists','threePointFieldGoalsMade-threePointFieldGoalsAttempted'],athletes:[{didNotPlay:false,athlete:{id:String(n),displayName:'Player '+n},stats:['30','20','5','4','2-5']}]}]}));
  responses.set(id,{header:{id:String(id),season:{year:2026,type:2},competitions:[{date:tipoff,status:{type:{completed:true,state:'post'}},competitors}]},boxscore:{players}});
 }
 return {games,responses};
}
test('player replay grades verified earlier appearances and reuses shared box scores',async()=>{
 const {games,responses}=fixture();let calls=0;
 const result=await replay(games,2025,{limit:2,fetcher:async url=>{calls++;return {ok:true,json:async()=>responses.get(Number(url.split('=').at(-1)))}}});
 assert.equal(result.teamGames,4);assert.equal(result.skipped,0);
 assert.equal(result.metrics.player_points.samples,4);assert.equal(result.metrics.player_points.mae,0);
 assert.ok(result.metrics.player_threes.mae<1e-10);assert.equal(calls,result.boxRequests);
});
test('unverified box scores are skipped rather than producing fabricated results',async()=>{
 const {games}=fixture();const result=await replay(games,2025,{limit:2,fetcher:async()=>({ok:false})});
 assert.equal(result.teamGames,0);assert.equal(result.skipped,4);assert.equal(result.metrics.player_points.samples,0);
 await assert.rejects(replay([...games,games[0]],2025),/Duplicate/);
});
