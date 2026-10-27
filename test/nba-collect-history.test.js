'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {collect}=require('../nba-collect-history');
function event(){return {id:'123',season:{year:2026,type:2},date:'2025-10-23T23:00:00Z',competitions:[{date:'2025-10-23T23:00:00Z',status:{type:{name:'STATUS_FINAL',state:'post',completed:true}},competitors:[{homeAway:'away',team:{id:'1',displayName:'Team 1'},score:{value:100}},{homeAway:'home',team:{id:'2',displayName:'Team 2'},score:{value:110}}]}]};}
function source({missing=false,conflict=false,badTeam=false}={}){return async url=>{
 const match=/teams\/(\d+)\/schedule/.exec(url);
 let data;
 if(!match)data={sports:[{leagues:[{teams:Array.from({length:badTeam?29:30},(_,i)=>({team:{id:String(i+1)}}))}]}]};
 else {const id=Number(match[1]);let e=id<=2?[event()]:[];
  if(id===2&&missing)e=[];
  if(id===2&&conflict){e=[event()];e[0].competitions[0].competitors[1].score.value=111;}
  data={team:{id},season:{year:2026,type:2},events:e};}
 return {ok:true,json:async()=>data};
};}
test('public history collector verifies teams, deduplicates games and produces backtest-compatible data',async()=>{
 const data=await collect(2025,2,source());
 assert.equal(data.teams,30);assert.equal(data.response.length,1);
 assert.equal(data.response[0].scores.home.points,110);
 assert.equal(require('../nba-backtest').backtest(data.response).evaluated,0);
});
test('collector refuses incomplete, contradictory and wrong-team datasets',async()=>{
 await assert.rejects(collect(2025,2,source({missing:true})),/missing/);
 await assert.rejects(collect(2025,2,source({conflict:true})),/Conflicting/);
 await assert.rejects(collect(2025,2,source({badTeam:true})),/30 NBA teams/);
 await assert.rejects(collect(2025,4,source()),/season or stage/);
});
