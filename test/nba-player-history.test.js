'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {stat,minutes,extractBox,createPlayerHistory}=require('../nba-player-history');
const now=Date.parse('2026-10-26T20:00:00Z'),tipoff='2026-10-26T23:30:00Z';
const selected={id:999,statusCode:1,away:'Chicago Bulls',home:'Boston Celtics',stage:2,tipoff};
const prior=(id,team,other)=>({id,opponentId:other,tipoff:`2026-10-${20+id}T00:00:00Z`,venue:'away',for:110,against:105});
const teamGames=[[prior(1,4,27),prior(2,4,28)],[prior(3,2,3),prior(4,2,5)]];
function payload(p,team){
 const keys=['minutes','points','rebounds','assists','threePointFieldGoalsMade-threePointFieldGoalsAttempted'];
 return {header:{id:String(p.id),season:{year:2027,type:2},competitions:[{date:p.tipoff,status:{type:{completed:true,state:'post'}},competitors:[{id:String(team),homeAway:'away',score:'110'},{id:String(p.opponentId),homeAway:'home',score:'105'}]}]},
  boxscore:{players:[{team:{id:String(team)},statistics:[{keys,athletes:[
   {athlete:{id:String(team*100),displayName:team===4?'Player A':'Player B'},didNotPlay:false,stats:['30','18','0','5','2-7']},
   {athlete:{id:'987',displayName:'Bench DNP'},didNotPlay:true,stats:['0','0','0','0','0-0']}
  ]}]}]}};
}
function feeds(){
 const game={...selected,id:222,provider:'espn',awayId:4,homeId:2};let calls=0;
 const publicFeed={games:async()=>({season:2026,games:[game]}),context:async()=>({away:{id:4,name:game.away,available:true,coverage:{conflictingGames:0},recentGames:teamGames[0]},home:{id:2,name:game.home,available:true,coverage:{conflictingGames:0},recentGames:teamGames[1]}})};
 const fetcher=async url=>{calls++;const id=Number(new URL(url).searchParams.get('event'));const isAway=id<=2,p=(isAway?teamGames[0]:teamGames[1]).find(x=>x.id===id);return {ok:true,headers:new Headers(),json:async()=>payload(p,isAway?4:2)};};
 return {publicFeed,fetcher,getCalls:()=>calls};
}
test('NBA box score extraction preserves zeros and made threes while excluding DNPs',()=>{
 const rows=extractBox(payload(teamGames[0][0],4),teamGames[0][0],4,2026,2);
 assert.equal(rows.length,1);assert.equal(rows[0].name,'Player A');assert.equal(rows[0].values.player_rebounds,0);assert.equal(rows[0].values.player_threes,2);
 assert.equal(stat('2-7',true),2);assert.equal(stat('8-7',true),null);assert.equal(stat('',false),null);assert.equal(minutes('21:30'),21.5);
});
test('NBA histories reject wrong game, opponent, season, unfinished games and duplicate player IDs',()=>{
 for(const change of [x=>x.header.id='99',x=>x.header.season.year=2026,x=>x.header.competitions[0].status.type.completed=false,x=>x.header.competitions[0].competitors[1].id='88',x=>x.header.competitions[0].competitors[0].score='1',x=>delete x.boxscore.players[0].statistics[0].athletes[0].didNotPlay,x=>x.boxscore.players[0].statistics[0].athletes.push(structuredClone(x.boxscore.players[0].statistics[0].athletes[0]))]){
  const x=payload(teamGames[0][0],4);change(x);assert.throws(()=>extractBox(x,teamGames[0][0],4,2026,2));
 }
});
test('public NBA history matches the selected matchup and shares completed box scores',async()=>{
 const f=feeds(),get=createPlayerHistory({...f,now:()=>now});
 const [a,b]=await Promise.all([get(selected,'2026-10-26',2026),get(selected,'2026-10-26',2026)]);
 assert.deepEqual(a,b);assert.equal(f.getCalls(),4);assert.ok(a.teams.every(t=>t.available));
 assert.equal(a.teams[0].players[0].results.length,2);assert.equal(a.teams[0].players[0].results[0].player_threes,2);
 assert.equal(a.teams[0].players.find(p=>p.name==='Bench DNP').inactive.length,2);
 assert.equal(a.teams[0].players.find(p=>p.name==='Bench DNP').results.length,0);
 await get(selected,'2026-10-26',2026);assert.equal(f.getCalls(),4);
 await assert.rejects(get({...selected,away:'New York Knicks'},'2026-10-26',2026),/matchup/);
});
test('missing box score withholds only its affected team',async()=>{
 const f=feeds(),orig=f.fetcher;f.fetcher=async url=>String(url).endsWith('event=1')?{ok:false,headers:new Headers()}:orig(url);
 const data=await createPlayerHistory({...f,now:()=>now})(selected,'2026-10-26',2026);
 assert.equal(data.teams[0].available,false);assert.equal(data.teams[1].available,true);
});


test('one malformed minutes row withholds only that player, not the whole team',async()=>{
 const f=feeds(),base=f.fetcher;
 f.fetcher=async url=>{
  const r=await base(url),d=await r.json();
  if(String(url).endsWith('event=1'))d.boxscore.players[0].statistics[0].athletes.push({athlete:{id:'888',displayName:'Unknown minutes'},didNotPlay:false,stats:['--','0','0','0','0-0']});
  return {ok:true,headers:new Headers(),json:async()=>d};
 };
 const result=await createPlayerHistory({...f,now:()=>now})(selected,'2026-10-26',2026);
 assert.equal(result.teams[0].available,true);
 assert.equal(result.teams[0].players.find(p=>p.name==='Player A').available,true);
 assert.equal(result.teams[0].players.find(p=>p.name==='Unknown minutes').available,false);
});

test('contradictory or duplicate DNP identities cannot become absence evidence',()=>{
 for(const makeRow of [rows=>({...rows[0],didNotPlay:true}),rows=>({...rows[1]}),()=>({athlete:{id:'',displayName:'Unknown'},didNotPlay:true})]){
  const x=payload(teamGames[0][0],4),rows=x.boxscore.players[0].statistics[0].athletes;
  rows.push(makeRow(rows));assert.throws(()=>extractBox(x,teamGames[0][0],4,2026,2));
 }
});

test('a missing row is recorded separately from explicit DNP',async()=>{
 const f=feeds(),base=f.fetcher;f.fetcher=async url=>{
 const r=await base(url),d=await r.json();if(String(url).endsWith('event=1'))d.boxscore.players[0].statistics[0].athletes.shift();
 // Keep an unrelated verified appearance so this tests player coverage.
 d.boxscore.players[0].statistics[0].athletes.push({athlete:{id:'555',displayName:'Other'},didNotPlay:false,stats:['5','0','0','0','0-0']});
 return {ok:true,headers:new Headers(),json:async()=>d};};
 const result=await createPlayerHistory({...f,now:()=>now})(selected,'2026-10-26',2026);
 const p=result.teams[0].players.find(p=>p.name==='Player A');assert.equal(p.coverage.missing,1);assert.equal(p.coverage.dnp,0);
});
