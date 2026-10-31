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
 const dnp=copy();dnp.boxscore.players[0].statistics[0].athletes[0].didNotPlay=true;dnp.boxscore.players[0].statistics[0].athletes[0].stats=[];assert.equal(extract(dnp,game,'1').length,0);
 const unknown=copy();delete unknown.boxscore.players[0].statistics[0].athletes[0].didNotPlay;assert.throws(()=>extract(unknown,game,'1'),/participation/);
 const rounded=copy();rounded.boxscore.players[0].statistics[0].athletes[0].stats[0]='0';assert.equal(extract(rounded,game,'1')[0].available,false);
 const duplicate=copy();duplicate.boxscore.players[0].statistics[0].athletes.push(structuredClone(duplicate.boxscore.players[0].statistics[0].athletes[0]));assert.throws(()=>extract(duplicate,game,'1'),/identity/);
});

test('college player history skips box-score requests for known incomplete team histories',async()=>{
 const {createPlayers}=require('../ncaab-players');
 for(const field of ['conflicts','unverifiedGames']){
  let calls=0;
  const bad={id:'1',name:'Away',recentGames:[{id:'bad-box'}],[field]:1};
  const feed={context:async()=>({away:bad,home:{id:'2',name:'Home',recentGames:[],conflicts:0,unverifiedGames:0}})};
  const get=createPlayers({feed,fetcher:async()=>{calls++;throw Error('Must not fetch unverifiable history');}});
  const report=await get.history(game);assert.equal(calls,0);assert.equal(report.teams[0].available,false);assert.deepEqual(report.teams[0].players,[]);
 }
});

test('college injury duplicate sections preserve reported absences and flag ambiguity',()=>{
 const d=structuredClone(summary);d.injuries.push(structuredClone(d.injuries[0]));d.injuries[1].injuries[0].status='Available';
 const reports=injuries(d,game);
 assert.equal(reports[0].available,false);assert.match(reports[0].message,/Conflicting/);
 assert.deepEqual(reports[0].players.map(p=>p.status),['Out','Available']);
 assert.equal(reports[1].available,false);assert.match(reports[1].message,/missing/);
 const {injuryStatus}=require('../public/nba-player-model');
 assert.equal(injuryStatus({gameId:game.id,tipoff:game.tipoff,checkedAt:now,teams:reports},{name:'Test Player'},game,now,false),'Unverified');
 const malformed=structuredClone(summary);malformed.injuries[0].injuries.push(null);
 assert.equal(injuries(malformed,game)[0].available,false);
 assert.equal(injuries(malformed,game)[0].players[0].status,'Out');
});
