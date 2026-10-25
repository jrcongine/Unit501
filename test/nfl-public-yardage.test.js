'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createPublicNFLYardage,readESPNTeam,withVerifiedYardage}=require('../nfl-public-yardage');
const names=[
 'Arizona Cardinals','Atlanta Falcons','Baltimore Ravens','Buffalo Bills','Carolina Panthers',
 'Chicago Bears','Cincinnati Bengals','Cleveland Browns','Dallas Cowboys','Denver Broncos',
 'Detroit Lions','Green Bay Packers','Houston Texans','Indianapolis Colts','Jacksonville Jaguars',
 'Kansas City Chiefs','Las Vegas Raiders','Los Angeles Chargers','Los Angeles Rams','Miami Dolphins',
 'Minnesota Vikings','New England Patriots','New Orleans Saints','New York Giants','New York Jets',
 'Philadelphia Eagles','Pittsburgh Steelers','San Francisco 49ers','Seattle Seahawks',
 'Tampa Bay Buccaneers','Tennessee Titans','Washington Commanders'
];
const clubs=names.map((name,i)=>({id:String(i+1),displayName:name}));
const entry=(name,value)=>({name,value});
function payload(club,games=6,totals={rushFor:595,passFor:1328,rushAgainst:619,passAgainst:1226}){
 const off={
  categories:[
   {name:'general',stats:[entry('gamesPlayed',games)]},
   {name:'rushing',stats:[entry('rushingYards',totals.rushFor),entry('rushingYardsPerGame',totals.rushFor/games),entry('teamGamesPlayed',games)]},
   {name:'passing',stats:[entry('netPassingYards',totals.passFor),entry('netPassingYardsPerGame',totals.passFor/games),
     entry('passingYards',totals.passFor+100),entry('teamGamesPlayed',games)]}
  ]
 };
 const defense=[
  {name:'rushing',stats:[entry('rushingYards',totals.rushAgainst),entry('rushingYardsPerGame',totals.rushAgainst/games),entry('teamGamesPlayed',games)]},
  {name:'passing',stats:[entry('netPassingYards',totals.passAgainst),entry('netPassingYardsPerGame',totals.passAgainst/games),
    entry('passingYards',totals.passAgainst+50),entry('teamGamesPlayed',games)]}
 ];
 return {season:{year:2026,type:2},requestedSeason:{year:2026,type:2},
  team:{id:club.id,displayName:club.displayName,recordSummary:'4-2'},
  results:{stats:off,opponent:def}};
}
test('public season reader uses net passing, all four verified values and game counts',()=>{
 const club={id:'23',name:'Pittsburgh Steelers'};
 const row=readESPNTeam(payload({id:'23',displayName:club.name}),club,2026);
 assert.deepEqual(row.totals,{rushFor:595,passFor:1328,rushAgainst:619,passAgainst:1226});
 assert.equal(row.games,6);
 const wrong=payload({id:'23',displayName:club.name});
 wrong.results.stats.categories[2].stats[1].value=999;
 assert.equal(readESPNTeam(wrong,club,2026),null);
 const wrongSeason=payload({id:'23',displayName:club.name});wrongSeason.season.year=2025;
 assert.equal(readESPNTeam(wrongSeason,club,2026),null);
 const wrongGames=payload({id:'23',displayName:club.name});wrongGames.results.stats.categories[0].stats[0].value=5;
 assert.equal(readESPNTeam(wrongGames,club,2026),null);
});
test('public source checks all 32 teams, uses 33 no-key requests, caches and refuses past kickoffs or live games',async()=>{
 const now=Date.parse('2026-10-25T12:00:00Z'),kickoff=now+3600000;
 const calls=[];
 const request=async url=>{
  calls.push(url);
  if(url.endsWith('/teams?limit=40'))return {sports:[{leagues:[{teams:clubs.map(team=>({team}))}]}]};
  const id=/\/teams\/(\d+)\/statistics/.exec(url)?.[1];
  if(!id)throw Error('Unexpected '+url);
  return payload(clubs.find(t=>t.id===id));
 };
 const get=createPublicNFLYardage({request,now:()=>now});
 const q={league:'1',season:'2026',before:kickoff};
 const result=await get(q,[]);
 assert.equal(result.teams.length,32);
 assert.equal(calls.length,33);
 assert.equal((await get(q,[])).teams.length,32);
 assert.equal(calls.length,33);
 assert.equal(await get({...q,before:now-1},[]),null);
 assert.equal(await get({...q,season:'2025'},[]),null);
 const live=[{league:{id:1,season:2026},game:{stage:'Regular Season',date:{timestamp:(now-1000)/1000},status:{short:'Q2'}}}];
 assert.equal(await get(q,live),null);
 assert.equal(calls.length,33);
});
test('incomplete or wrong-season public data is never presented as full national coverage',async()=>{
 const now=Date.parse('2026-10-25T12:00:00Z');
 let bad=false;
 const request=async url=>{
  if(url.endsWith('/teams?limit=40'))return {sports:[{leagues:[{teams:clubs.map(team=>({team}))}]}]};
  const club=clubs.find(t=>t.id===/\/teams\/(\d+)\/statistics/.exec(url)?.[1]);
  const row=payload(club);if(club.id==='32')row.season.year=bad?2025:2026;else if(club.id==='31')row.results.opponent=[];
  return row;
 };
 const q={league:'1',season:'2026',before:now+30000};
 const get=createPublicNFLYardage({request,now:()=>now});
 assert.equal(await get(q,[]),null);
 bad=true;
 assert.equal(await get(q,[]),null);
});
function scoringData(){
 return {scope:'NFL regular season',season:'2026',before:Date.parse('2026-10-25T13:30:00Z'),
  coverage:{pointsFor:{ranked:true,expected:32},pointsAgainst:{ranked:true,expected:32}},
  teams:clubs.map(club=>({id:club.id,name:club.displayName,games:6,metrics:{
   rushFor:{average:null,games:0,rank:null},passFor:{average:null,games:0,rank:null},
   rushAgainst:{average:null,games:0,rank:null},passAgainst:{average:null,games:0,rank:null},
   pointsFor:{average:22,games:6,rank:1},pointsAgainst:{average:24,games:6,rank:1}
  }}))}
}
test('32-team verified ranks do not alter scoring stats, paid-box metrics or model eligibility',()=>{
 const data=scoringData();
 const raw=data.teams.map((t,i)=>({id:t.id,name:t.name,games:6,
  totals:{rushFor:600+i,passFor:1200+i,rushAgainst:600+i,passAgainst:1200+i}}));
 const snapshot={season:'2026',fetchedAt:data.before-1000,teams:raw};
 const original=JSON.stringify(data);
 const decorated=withVerifiedYardage(data,snapshot);
 assert.equal(decorated.verifiedYardage.coverage,32);
 assert.equal(decorated.verifiedYardage.teams['32'].rushFor.rank,1);
 assert.equal(decorated.verifiedYardage.teams['1'].rushAgainst.rank,1);
 assert.equal(decorated.verifiedYardage.teams['32'].passAgainst.rank,32);
 assert.equal(decorated.teams[0].metrics.rushFor.rank,null);
 assert.equal(JSON.stringify(data),original);
 assert.equal(decorated.teams[0].metrics.pointsFor.average,22);
 assert.equal(withVerifiedYardage(data,{...snapshot,fetchedAt:data.before+1}),data);
 assert.equal(withVerifiedYardage(data,{...snapshot,teams:raw.slice(1)}),data);
 data.teams[0].metrics.rushFor={average:1,games:6,rank:null};
 assert.equal(withVerifiedYardage(data,snapshot),data);
});
