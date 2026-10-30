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
test('later results cannot change earlier player estimates',async()=>{
 const original=fixture(),changed=fixture();
 for(const id of [19,20])changed.responses.get(id).boxscore.players[0].statistics[0].athletes[0].stats[1]='90';
 const run=({games,responses})=>replay(games,2025,{limit:2,fetcher:async url=>({ok:true,json:async()=>responses.get(Number(url.split('=').at(-1)))})});
 assert.deepEqual(await run(original),await run(changed));
});
test('replay withholds a player missing from a prior box rather than shrinking denominator',async()=>{
 const {games,responses}=fixture();
 // Keep another valid appearance so this is a missing player, not a failed team box.
 const group=responses.get(10).boxscore.players[0].statistics[0];
 group.athletes[0].athlete={id:'99',displayName:'Other Player'};
 const result=await replay(games,2025,{limit:2,fetcher:async url=>({ok:true,json:async()=>responses.get(Number(url.split('=').at(-1)))})});
 for(const metric of Object.values(result.metrics))assert.equal(metric.samples,2);
});
test('replay excludes explicit DNP while retaining genuine zero-stat appearances',async()=>{
 for(const dnp of [true,false]){
  const {games,responses}=fixture(),group=responses.get(10).boxscore.players[0].statistics[0];
  group.athletes.push({didNotPlay:false,athlete:{id:'99',displayName:'Other Player'},stats:['10','1','1','1','0-1']});
  group.athletes[0].didNotPlay=dnp;group.athletes[0].stats=dnp?[]:['10','0','0','0','0-0'];
  const result=await replay(games,2025,{limit:2,fetcher:async url=>({ok:true,json:async()=>responses.get(Number(url.split('=').at(-1)))})});
  assert.equal(result.metrics.player_points.samples,4);
  if(dnp)assert.ok(result.metrics.player_points.mae<1e-10);
  else assert.ok(result.metrics.player_points.mae>0);
 }
});
test('official replay restores an omitted appearance and rejects conflicting actuals',async()=>{
 for(const conflict of [false,true]){
  const {games,responses}=fixture();
  responses.get(10).boxscore.players[0].statistics[0].athletes[0].athlete={id:'99',displayName:'Other Player'};
  const official=async data=>({available:true,gameId:data.header.id,tipoff:data.header.competitions[0].date,source:'https://www.nba.com/game/test/box-score',teams:[1,2].map(id=>({id:String(id),players:[{name:'Player '+id,participation:conflict&&id===1&&Number(data.header.id)>=16?'dnp':'played',minutes:30,values:{player_points:20,player_rebounds:5,player_assists:4,player_threes:2}}]}))});
  const result=await replay(games,2025,{limit:2,official,fetcher:async url=>({ok:true,json:async()=>responses.get(Number(url.split('=').at(-1)))})});
  assert.ok(result.officialGames>0);
  assert.equal(result.metrics.player_points.samples,conflict?2:4);
  assert.equal(result.metrics.player_points.mae,0);
 }
});
test('optional official source failure preserves validated replay and missing-record gates',async()=>{
 const {games,responses}=fixture();responses.get(10).boxscore.players[0].statistics[0].athletes[0].athlete={id:'99',displayName:'Other Player'};
 const options={limit:2,fetcher:async url=>({ok:true,json:async()=>responses.get(Number(url.split('=').at(-1)))})};
 const baseline=await replay(games,2025,options),failed=await replay(games,2025,{...options,official:async()=>{throw Error('Official source timeout');}});
 assert.deepEqual(failed,baseline);assert.equal(failed.metrics.player_points.samples,2);assert.equal(failed.officialGames,0);
});
