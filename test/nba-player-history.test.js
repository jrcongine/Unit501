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
 assert.deepEqual(a,b);assert.equal(a.teams[0].gameSource,'espn');assert.deepEqual(a.teams[0].gameLog.map(g=>g.id),['1','2']);assert.equal(a.teams[0].gameLog[0].for,110);assert.equal(a.teams[0].gameLog[0].tipoff,teamGames[0][0].tipoff);assert.equal(f.getCalls(),4);assert.ok(a.teams.every(t=>t.available));
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
test('official source failure preserves validated secondary histories and coverage',async()=>{
 const f=feeds(),baseline=await createPlayerHistory({...f,now:()=>now})(selected,'2026-10-26',2026);
 const failed=await createPlayerHistory({...f,now:()=>now,official:async()=>{throw Error('Official source timeout');}})(selected,'2026-10-26',2026);
 assert.deepEqual(failed.teams,baseline.teams);
 assert.ok(failed.teams.every(t=>t.verification.verified===0));
});
test('official reconciliation restores a known missing zero appearance before coverage',async()=>{
 const f=feeds(),base=f.fetcher;
 f.fetcher=async url=>{const r=await base(url),d=await r.json();if(String(url).endsWith('event=1'))d.boxscore.players[0].statistics[0].athletes[0]={athlete:{id:'555',displayName:'Other'},didNotPlay:false,stats:['5','0','0','0','0-0']};return {ok:true,headers:new Headers(),json:async()=>d};};
 const official=async data=>data.header.id==='1'?{available:true,gameId:'1',tipoff:teamGames[0][0].tipoff,teams:[{id:'4',players:[{name:'Player A',participation:'played',minutes:5,values:{player_points:0,player_rebounds:0,player_assists:0,player_threes:0}}]}]}:{available:false};
 const result=await createPlayerHistory({...f,now:()=>now,official})(selected,'2026-10-26',2026),p=result.teams[0].players.find(p=>p.name==='Player A');
 assert.deepEqual(p.coverage,{total:2,played:2,dnp:0,missing:0});assert.equal(p.results.find(r=>String(r.gameId)==='1').player_points,0);assert.equal(result.teams[0].verification.filled,1);
});
test('unverified minutes stay missing until official participation and statistics agree',async()=>{
 for(const minutes of ['0','--'])for(const mode of ['missing','verified','conflict','dnp']){
  const f=feeds(),base=f.fetcher;
  f.fetcher=async url=>{const r=await base(url),d=await r.json();if(String(url).endsWith('event=1'))d.boxscore.players[0].statistics[0].athletes[0].stats[0]=minutes;return {ok:true,headers:new Headers(),json:async()=>d};};
  const official=async data=>data.header.id!=='1'||mode==='missing'?{available:false}:{available:true,gameId:'1',tipoff:teamGames[0][0].tipoff,teams:[{id:'4',players:[{name:'Player A',participation:mode==='dnp'?'dnp':'played',minutes:30,values:{player_points:mode==='conflict'?19:18,player_rebounds:0,player_assists:5,player_threes:2}}]}]};
  const result=await createPlayerHistory({...f,now:()=>now,official})(selected,'2026-10-26',2026),p=result.teams[0].players.find(p=>p.name==='Player A');
  assert.equal(p.available,mode==='verified');assert.equal(p.coverage.played,mode==='verified'?2:1);assert.equal(p.coverage.missing,mode==='verified'?0:1);assert.equal(p.coverage.dnp,0);assert.equal(p.unverified.length,mode==='verified'?0:1);
 }
});

test('known team-history gaps cannot become apparently complete NBA player samples',async()=>{
 for(const field of ['unverifiedGames','invalid','conflictingGames']){
  const f=feeds(),read=f.publicFeed.context;
  f.publicFeed.context=async()=>{const d=await read();d.away.coverage[field]=1;return d;};
  const report=await createPlayerHistory({...f,now:()=>now})(selected,'2026-10-26',2026);
  assert.equal(report.teams[0].available,false);assert.equal(report.teams[0].games,0);assert.deepEqual(report.teams[0].players,[]);
  assert.equal(report.teams[1].available,true);assert.ok(report.teams[1].players.some(p=>p.name==='Player B'));
  assert.equal(f.getCalls(),2,'Only the intact opposing team needs box-score requests');
 }
});
test('NBA player histories recover after source gaps clear without caching a partial sample',async()=>{
 const f=feeds(),read=f.publicFeed.context;let gap=true;
 f.publicFeed.context=async()=>{const d=await read();for(const side of [d.away,d.home])side.coverage.unverifiedGames=gap?1:0;return d;};
 const get=createPlayerHistory({...f,now:()=>now});
 const blocked=await get(selected,'2026-10-26',2026);assert.ok(blocked.teams.every(t=>!t.available));assert.equal(f.getCalls(),0);
 gap=false;const recovered=await get(selected,'2026-10-26',2026);assert.ok(recovered.teams.every(t=>t.available));assert.equal(f.getCalls(),4);
 assert.equal(recovered.teams[0].players.find(p=>p.name==='Player A').results[0].player_rebounds,0);
});

test('stable NBA player IDs retain history across accent, punctuation and omitted-suffix formatting',async()=>{
 for(const names of [["José O'Neal Jr.",'Jose ONeal'],['Jose ONeal',"José O'Neal Jr."]]){
  const f=feeds(),base=f.fetcher;f.fetcher=async url=>{const r=await base(url),d=await r.json();const id=Number(new URL(url).searchParams.get('event'));if(id<=2)d.boxscore.players[0].statistics[0].athletes[0].athlete.displayName=names[id-1];return {...r,json:async()=>d};};
  const out=await createPlayerHistory({...f,now:()=>now})(selected,'2026-10-26',2026);
  assert.equal(out.teams[0].available,true);assert.equal(out.teams[0].players[0].results.length,2);assert.equal(out.teams[0].players[0].coverage.missing,0);
 }
});

test('verified public matchup carries the selected provider team mapping',async()=>{
 const f=feeds();
 const game={...selected,provider:'api-nba',awayId:900,homeId:901};
 const result=await createPlayerHistory({...f,now:()=>now})(game,'2026-10-26',2026);
 assert.equal(result.teams[0].id,4);assert.equal(result.teams[0].selectedTeamId,900);
 assert.equal(result.teams[1].selectedTeamId,901);assert.equal(result.teams[0].selectedProvider,'api-nba');
});
