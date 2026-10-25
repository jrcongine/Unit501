'use strict';
// Display-only NFL regular-season yardage rankings from nflverse team-week data.
// The stats_team release is CC BY 4.0, with attribution required.
// This module never changes the paid provider's historical game boxes or score/prop models.
// The weekly CSV is checked against the complete API-Sports scoring schedule before use.
const URL='https://github.com/nflverse/nflverse-data/releases/download/stats_team/stats_team_week_';
const SOURCE='https://github.com/nflverse/nflverse-data/releases/tag/stats_team';
const LICENSE='https://creativecommons.org/licenses/by/4.0/';
const YARDAGE=['rushFor','passFor','rushAgainst','passAgainst'];
const normalize=name=>String(name||'').toLowerCase().replace(/[^a-z0-9]/g,'');
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
const nameToCode=new Map(clubs.map(([name,code])=>[normalize(name),code]));
const codeToName=new Map(clubs.map(([name,code])=>[code,name]));
function csvRows(source){
 if(typeof source!=='string'||source.length>12000000||source.length<50)return null;
 const rows=[];let row=[],value='',quoted=false;
 for(let i=0;i<source.length;i++){
  const c=source[i];
  if(c==='"'){if(quoted&&source[i+1]==='"'){value+='"';i++;}else quoted=!quoted;}
  else if(c===','&&!quoted){row.push(value);value='';}
  else if((c==='\n'||c==='\r')&&!quoted){
   if(c==='\r'&&source[i+1]==='\n')i++;
   row.push(value);value='';
   if(row.some(x=>x!==''))rows.push(row);
   row=[];
  }else value+=c;
 }
 if(quoted)return null;
 if(value||row.length){row.push(value);rows.push(row);}
 return rows;
}
function parseWeekData(text,season){
 const table=csvRows(text);
 if(!table?.length)return null;
 const header=table.shift().map((s,i)=>i===0?s.replace(/^\uFEFF/,''):s);
 const columns=['season','week','team','season_type','game_id','opponent_team',
  'passing_yards','sack_yards_lost','rushing_yards'];
 const indices=columns.map(k=>header.indexOf(k));
 if(indices.some(i=>i<0)||new Set(header).size!==header.length)return null;
 const groups=new Map();
 const numeric=value=>/^-?\d+$/.test(String(value))?Number(value):null;
 let seen=0;
 for(const line of table){
  if(line.length!==header.length)return null;
  const row=Object.fromEntries(columns.map((k,i)=>[k,line[indices[i]]]));
  if(row.season!==String(season)||row.season_type!=='REG')continue;
  const week=numeric(row.week);
  if(!Number.isInteger(week)||week<1||week>18||
    !new RegExp('^'+season+'_' + String(week).padStart(2,'0')+'_[A-Z]+_[A-Z]+$').test(row.game_id)||
    !codeToName.has(row.team)||!codeToName.has(row.opponent_team)||
    row.team===row.opponent_team)return null;
  const pass=numeric(row.passing_yards),sack=numeric(row.sack_yards_lost),rush=numeric(row.rushing_yards);
  if(!Number.isInteger(pass)||pass<0||pass>900||
    !Number.isInteger(sack)||sack>0||sack< -200||
    !Number.isInteger(rush)||rush< -100||rush>650||
    pass+sack< -200)return null;
  const item={team:row.team,opponent:row.opponent_team,pass:pass+sack,rush,week};
  if(!groups.has(row.game_id))groups.set(row.game_id,[]);
  groups.get(row.game_id).push(item);seen++;
 }
 if(!seen||seen>32*18||groups.size*2!==seen)return null;
 const totals=new Map(clubs.map(([name,code])=>[code,{name,games:0,
  totals:{rushFor:0,passFor:0,rushAgainst:0,passAgainst:0}}]));
 const pairs=new Map();
 for(const rows of groups.values()){
  if(rows.length!==2||rows[0].team!==rows[1].opponent||
    rows[1].team!==rows[0].opponent||rows[0].week!==rows[1].week)return null;
  const pair=[rows[0].team,rows[1].team].sort().join('|');
  pairs.set(pair,(pairs.get(pair)||0)+1);
  for(const [i,row]of rows.entries()){
   const opponent=rows[1-i];
   const t=totals.get(row.team);
   t.games++;
   t.totals.rushFor+=row.rush;
   t.totals.passFor+=row.pass;
   t.totals.rushAgainst+=opponent.rush;
   t.totals.passAgainst+=opponent.pass;
  }
 }
 if([...totals.values()].some(t=>t.games<1||t.games>17))return null;
 return {season:String(season),gameCount:groups.size,pairs,
  teams:[...totals.values()]};
}
function verifyMatchSchedule(snapshot,leagueGames,query){
 if(!snapshot||!Array.isArray(leagueGames))return false;
 const expected=new Map();let games=0;
 for(const g of leagueGames){
  if(String(g?.league?.id)!=='1'||String(g?.league?.season)!==String(query.season)||
      g.game?.stage!=='Regular Season')continue;
  const timestamp=Number(g.game?.date?.timestamp)*1000;
  if(!Number.isFinite(timestamp)||timestamp<=0||timestamp>=query.before||
     !['FT','AOT','FINAL'].includes(String(g.game?.status?.short||'').toUpperCase()))continue;
  const away=nameToCode.get(normalize((g.teams?.away||g.teams?.visitors)?.name));
  const home=nameToCode.get(normalize(g.teams?.home?.name));
  if(!away||!home||away===home)return false;
  const key=[away,home].sort().join('|');
  expected.set(key,(expected.get(key)||0)+1);
  games++;
 }
 if(games!==snapshot.gameCount||expected.size!==snapshot.pairs.size)return false;
 return [...expected].every(([key,count])=>snapshot.pairs.get(key)===count);
}
function createPublicNFLYardage(options={}){
 const request=options.request||(async url=>{
  const response=await fetch(url,{signal:AbortSignal.timeout(25000),
    headers:{Accept:'text/csv','User-Agent':'Unit501-NFL-Stats-Client'}});
  if(!response.ok)throw Error('nflverse statistics HTTP '+response.status);
  return response.text();
 });
 const clock=options.now||Date.now;
 const lifetime=options.ttlMs??30*60000;
 let cache=null,inflight=null;
 async function refresh(season){
  const text=await request(URL+encodeURIComponent(season)+'.csv');
  const snapshot=parseWeekData(text,season);
  if(!snapshot)throw Error('Incomplete or malformed nflverse team statistics.');
  snapshot.fetchedAt=clock();
  cache=snapshot;
  return cache;
 }
 return async function get(query,leagueGames=[]){
  const now=clock(),before=Number(query?.before),season=String(query?.season||'');
  const current=new Date(now).getUTCFullYear();
  const acceptedSeasons=[String(current)];
  if(new Date(now).getUTCMonth()<3)acceptedSeasons.push(String(current-1));
  if(String(query?.league)!=='1'||!acceptedSeasons.includes(season)||
    !Number.isFinite(before)||before<=now||before-now>10*86400000)return null;
  try{
   if(!cache||cache.season!==season||now-cache.fetchedAt>=lifetime){
    if(!inflight)inflight=refresh(season).catch(()=>null).finally(()=>{inflight=null});
    if(!(await inflight))return null;
   }
   return cache?.fetchedAt<before&&verifyMatchSchedule(cache,leagueGames,query)
     ? {season,source:'nflverse team-week statistics (CC BY 4.0)',
       sourceUrl:SOURCE,licenseUrl:LICENSE,fetchedAt:cache.fetchedAt,
       teams:cache.teams} : null;
  }catch{return null;}
 };
}
function withVerifiedYardage(data,snapshot){
 if(!data||data.scope!=='NFL regular season'||!snapshot||
    String(data.season)!==String(snapshot.season)||!(snapshot.fetchedAt<data.before)||
    data.teams?.length!==32||snapshot.teams?.length!==32||
    !data.coverage?.pointsFor?.ranked||!data.coverage?.pointsAgainst?.ranked)return data;
 const source=new Map();
 for(const row of snapshot.teams){
  const name=normalize(row.name);
  if(!name||source.has(name))return data;
  source.set(name,row);
 }
 const matched=new Map();
 for(const team of data.teams){
  const row=source.get(normalize(team.name));
  if(!row||row.games!==team.games||team.games<1||
     !YARDAGE.every(key=>Number.isFinite(row.totals[key])&&row.totals[key]>=0&&
       (team.metrics[key].games!==team.games||team.metrics[key].average===null||
        Math.abs(team.metrics[key].average-row.totals[key]/team.games)<=0.6)))return data;
  matched.set(String(team.id),row);
 }
 if(matched.size!==32)return data;
 const ranks=new Map([...matched.keys()].map(id=>[id,{}]));
 for(const key of YARDAGE){
  const defense=key.endsWith('Against');
  const sorted=[...matched].sort((a,b)=>{
   const left=a[1].totals[key]/a[1].games,right=b[1].totals[key]/b[1].games;
   return (left-right)*(defense?1:-1);
  });
  sorted.forEach(([id,row],i)=>{
   const avg=row.totals[key]/row.games;
   const prev=sorted[i-1],prevAvg=prev&&prev[1].totals[key]/prev[1].games;
   const rank=prev&&Math.abs(avg-prevAvg)<1e-9?ranks.get(prev[0])[key].rank:i+1;
   ranks.get(id)[key]={average:avg,rank,pool:32,games:row.games};
  });
 }
 return {...data,verifiedYardage:{
  source:snapshot.source||'nflverse team-week statistics (CC BY 4.0)',
  sourceUrl:snapshot.sourceUrl||SOURCE,licenseUrl:snapshot.licenseUrl||LICENSE,
  fetchedAt:snapshot.fetchedAt,coverage:32,
  teams:Object.fromEntries(ranks)
 }};
}
module.exports={createPublicNFLYardage,parseWeekData,verifyMatchSchedule,withVerifiedYardage};
