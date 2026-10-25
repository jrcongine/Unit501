'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createPublicNFLYardage,parseWeekData,verifyMatchSchedule,withVerifiedYardage}=require('../nfl-public-yardage');
const clubs=[
 ['Arizona Cardinals','ARI'],['Atlanta Falcons','ATL'],['Baltimore Ravens','BAL'],
 ['Buffalo Bills','BUF'],['Carolina Panthers','CAR'],['Chicago Bears','CHI'],
 ['Cincinnati Bengals','CIN'],['Cleveland Browns','CLE'],['Dallas Cowboys','DAL'],
 ['Denver Broncos','DEN'],['Detroit Lions','DET'],['Green Bay Packers','GB'],
 ['Houston Texans','HOU'],['Indianapolis Colts','IND'],['Jacksonville Jaguars','JAX'],
 ['Kansas City Chiefs','KC'],['Las Vegas Raiders','LV'],['Los Angeles Chargers','LAC'],
 ['Los Angeles Rams','LA'],['Miami Dolphins','MIA'],['Minnesota Vikings','MIN'],
 ['New England Patriots','NE'],['New Orleans Saints','NO'],['New York Giants','NYG'],
 ['New York Jets','NYJ'],['Philadelphia Eagles','PHI'],['Pittsburgh Steelers','PIT'],
 ['San Francisco 49ers','SF'],['Seattle Seahawks','SEA'],['Tampa Bay Buccaneers','TB'],
 ['Tennessee Titans','TEN'],['Washington Commanders','WAS']
];
function fixture(){
 const header='season,week,team,season_type,game_id,opponent_team,passing_yards,sack_yards_lost,rushing_yards';
 const rows=[],games=[];
 const timestamp=Date.parse('2026-10-18T19:00:00Z')/1000;
 for(let i=0;i<clubs.length;i+=2){
  const [away,ac]=clubs[i],[home,hc]=clubs[i+1];
  const id='2026_06_'+ac+'_'+hc;
  const start=20+i;
  rows.push('2026,6,'+ac+',REG,'+id+','+hc+','+(200+start)+',-10,'+(80+start));
  rows.push('2026,6,'+hc+',REG,'+id+','+ac+','+(210+start)+',-20,'+(90+start));
  games.push({league:{id:1,season:2026},
   game:{id:i/2+1,date:{timestamp},stage:'Regular Season',status:{short:'FT'}},
   teams:{away:{id:i+1,name:away},home:{id:i+2,name:home}}});
 }
 return {csv:header+'\n'+rows.join('\n')+'\n',games};
}
test('nflverse team-week parser calculates net passing yards and opponent defensive totals for all 32',()=>{
 const {csv,games}=fixture(),snapshot=parseWeekData(csv,2026);
 assert.ok(snapshot);
 assert.equal(snapshot.teams.length,32);
 assert.equal(snapshot.gameCount,16);
 const first=snapshot.teams.find(x=>x.name==='Arizona Cardinals');
 const second=snapshot.teams.find(x=>x.name==='Atlanta Falcons');
 assert.deepEqual(first.totals,{rushFor:100,passFor:210,rushAgainst:110,passAgainst:210});
 assert.deepEqual(second.totals,{rushFor:110,passFor:210,rushAgainst:100,passAgainst:210});
 assert.equal(verifyMatchSchedule(snapshot,games,{season:'2026',before:Date.parse('2026-10-25')}),true);
 assert.equal(verifyMatchSchedule(snapshot,[...games,games[0]],{season:'2026',before:Date.parse('2026-10-25')}),false);
 assert.equal(parseWeekData(csv.replace('2026_06_ARI_ATL','2026_05_ARI_ATL'),2026),null);
 assert.equal(parseWeekData(csv.replace('2026,6,ATL,REG','2026,6,AAA,REG'),2026),null);
 assert.equal(parseWeekData(csv.replace('2026,6,ATL,REG','2025,6,ATL,REG'),2026),null);
 assert.equal(parseWeekData(csv.replace('2026,6,ATL,REG','2026,6,ATL,PRE'),2026),null);
 assert.equal(parseWeekData(csv.replace('2026,6,ATL,REG','2026,6,ATL,REG,extra'),2026),null);
});
test('nflverse source makes one CC-BY CSV request, caches, refuses mismatched schedule and past kickoff',async()=>{
 const now=Date.parse('2026-10-25T12:00:00Z');
 const {csv,games}=fixture(),calls=[];
 const get=createPublicNFLYardage({now:()=>now,request:async url=>{calls.push(url);return csv;}});
 const q={league:'1',season:'2026',before:now+3600000};
 const result=await get(q,games);
 assert.ok(result);
 assert.equal(result.teams.length,32);
 assert.match(result.source,/nflverse/);
 assert.equal(result.licenseUrl,'https://creativecommons.org/licenses/by/4.0/');
 assert.equal(calls.length,1);
 assert.match(calls[0],/stats_team_week_2026\.csv/);
 assert.equal((await get(q,games)).teams.length,32);
 assert.equal(calls.length,1);
 assert.equal(await get(q,[...games,{...games[0],game:{...games[0].game,id:99}}]),null);
 assert.equal(await get({...q,before:now-1},games),null);
 assert.equal(await get({...q,season:'2025'},games),null);
 // An unrelated game in progress is excluded from the completed-game field,
 // but cannot be smuggled into the csv, which must match completed pairs.
 const live={...games[0],game:{...games[0].game,id:999,status:{short:'Q2'}}};
 assert.equal((await get(q,[...games,live])).teams.length,32);
 assert.equal(calls.length,1);
});
test('malformed, missing, mismatched and duplicate rows cannot create all-32 coverage',async()=>{
 const now=Date.parse('2026-10-25T12:00:00Z');
 const {csv,games}=fixture();
 for(const invalid of [
  csv.replace(/2026,6,WAS,REG,[^\n]+\n/,''),
  csv.replace('2026,6,ATL,REG','2026,6,CHI,REG'),
  csv.replace('2026,6,ARI,REG','2027,6,ARI,REG'),
  csv.replace(',-10,100',',garbage,100'),
  csv.replace('2026,6,ARI,REG','2026,6,ARI,REG,garbage,')
 ]){
  const get=createPublicNFLYardage({now:()=>now,request:async()=>invalid});
  assert.equal(await get({league:'1',season:'2026',before:now+30000},games),null);
 }
});
function scoringData(){
 return {scope:'NFL regular season',season:'2026',before:Date.parse('2026-10-25T13:30:00Z'),
  coverage:{pointsFor:{ranked:true,expected:32},pointsAgainst:{ranked:true,expected:32}},
  teams:clubs.map(([name],i)=>({id:String(i+1),name,games:6,metrics:{
   rushFor:{average:null,games:0,rank:null},passFor:{average:null,games:0,rank:null},
   rushAgainst:{average:null,games:0,rank:null},passAgainst:{average:null,games:0,rank:null},
   pointsFor:{average:22,games:6,rank:1},pointsAgainst:{average:24,games:6,rank:1}
  }}))}
}
test('display-only national ranks do not alter scoring stats, paid yardage sample or projections',()=>{
 const data=scoringData();
 const raw=data.teams.map((t,i)=>({name:t.name,games:6,
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
