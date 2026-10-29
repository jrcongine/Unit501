'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {matches,createMarkets}=require('../ncaab-markets');
const {injuries,extract}=require('../ncaab-players');
const now=Date.parse('2026-11-01T18:00:00Z'),game={id:'123',awayId:'1',homeId:'2',away:'Duke Blue Devils',home:'Clemson Tigers',tipoff:'2026-11-02T18:00:00Z',status:'Scheduled',timeKnown:true};
const event={id:'e1',sport_key:'basketball_ncaab',away_team:game.away,home_team:game.home,commence_time:game.tipoff,bookmakers:[{key:'fanduel',last_update:new Date(now).toISOString(),markets:[{key:'spreads',outcomes:[{name:game.away,point:-3.5,price:-110},{name:game.home,point:3.5,price:-110}]},{key:'totals',outcomes:[{name:'Over',point:150.5,price:-110},{name:'Under',point:150.5,price:-110}]}]}]};
test('unique exact matchup and fresh paired sportsbook lines',async()=>{assert(matches(event,game));assert(!matches({...event,home_team:'Duke Blue Devils'},game));assert(!matches({...event,commence_time:'2026-11-03T18:00:00Z'},game));let calls=0;const get=createMarkets({now:()=>now,key:()=> 'secret',fetcher:async()=>({ok:true,headers:{get:()=>null},json:async()=>{calls++;return [event];}})});let out=await get(game,'game');assert.equal(out.spread.away,-3.5);assert.equal(out.total.line,150.5);await get(game,'game');assert.equal(calls,1);});
test('duplicate game cannot produce a line',async()=>{const fetcher=async()=>({ok:true,headers:{get:()=>null},json:async()=>[event,event]});const get=createMarkets({now:()=>now,key:()=> 'secret',fetcher});assert.equal((await get(game,'game')).available,false);});
const summary={header:{id:'123',competitions:[{date:game.tipoff,status:{type:{completed:true,state:'post'}},competitors:[{id:'1',homeAway:'away',score:'70'},{id:'2',homeAway:'home',score:'65'}]}]},injuries:[{team:{id:'1'},injuries:[{athlete:{displayName:'Test Player'},status:'Out'}]}],boxscore:{players:[{team:{id:'1'},statistics:[{keys:['minutes','points','rebounds','assists','threePointFieldGoalsMade-threePointFieldGoalsAttempted'],athletes:[{athlete:{id:'10',displayName:'Test Player'},didNotPlay:false,stats:['30','15','6','4','2-5']}]}]}]}};
test('injuries and box scores require verified event and team identities',()=>{assert.equal(injuries(summary,game)[0].players[0].status,'Out');assert.equal(injuries(summary,game)[1].players.length,0);assert.equal(extract(summary,game,'1')[0].player_threes,2);assert.throws(()=>injuries(summary,{...game,homeId:'3'}));assert.throws(()=>extract({...summary,header:{...summary.header,id:'9'}},game,'1'));});

test('college basketball distinguishes actual zeros, DNP and unverified participation',()=>{
 const copy=()=>structuredClone(summary);
 const zero=copy();zero.boxscore.players[0].statistics[0].athletes[0].stats=['3','0','0','0','0-0'];
 assert.equal(extract(zero,game,'1')[0].player_points,0);
 const dnp=copy();dnp.boxscore.players[0].statistics[0].athletes[0].didNotPlay=true;assert.equal(extract(dnp,game,'1').length,0);
 const unknown=copy();delete unknown.boxscore.players[0].statistics[0].athletes[0].didNotPlay;assert.throws(()=>extract(unknown,game,'1'),/participation/);
 const rounded=copy();rounded.boxscore.players[0].statistics[0].athletes[0].stats[0]='0';assert.equal(extract(rounded,game,'1')[0].available,false);
 const duplicate=copy();duplicate.boxscore.players[0].statistics[0].athletes.push(structuredClone(duplicate.boxscore.players[0].statistics[0].athletes[0]));assert.throws(()=>extract(duplicate,game,'1'),/identity/);
});
