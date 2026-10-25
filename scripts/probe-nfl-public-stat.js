'use strict';
// Diagnostic only. Uses public ESPN endpoints and NO paid API credentials.
// Summarizes structure rather than logging raw payloads.
const base='https://site.api.espn.com/apis/site/v2/sports/football/nfl';
const sources=[
  ['site-team','https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/23?enable=stats'],
  ['site-team-stats','https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/23/statistics?season=2026&seasontype=2'],
  ['site-saints-stats','https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/18/statistics?season=2026&seasontype=2'],
  ['site-all-teams','https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams?limit=40'],
  ['core-team-stats','https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/2026/types/2/teams/23/statistics'],
  ['site-league-stats','https://site.api.espn.com/apis/site/v2/sports/football/nfl/statistics?season=2026'],
  ['web-league-stats','https://site.web.api.espn.com/apis/common/v3/sports/football/nfl/statistics/team?season=2026']
];
async function load(url){
 const response=await fetch(url,{headers:{Accept:'application/json','User-Agent':'Unit501-Public-Data-Validation'},signal:AbortSignal.timeout(9000)});
 const raw=await response.text();
 if(!response.ok)throw Error('HTTP '+response.status+' response: '+raw.slice(0,75));
 return JSON.parse(raw);
}
function shape(data){
 const keys=v=>v&&typeof v==='object'?Object.keys(v).slice(0,35):[];
 const samples=[];
 function descend(value,prefix,depth=0){
  if(depth>8||samples.length>=65||!value||typeof value!=='object')return;
  if(Array.isArray(value)){for(const [i,x]of value.slice(0,3).entries())descend(x,prefix+'['+i+']',depth+1);return;}
  for(const [k,v] of Object.entries(value)){
   if(samples.length>=65)break;
   if(!v||typeof v==='object'){descend(v,prefix+'.'+k,depth+1);continue;}
   if(/rush|pass|yard|gamesplayed|games|opp|defen|pergame|average|statname/i.test(k)||/rush|pass|yards|offense|defense/i.test(String(v))){
    samples.push((prefix+'.'+k+'='+String(v)).slice(0,165));
   }
  }
 }
 descend(data,'$');
 const seasonStats=data?.results?.stats?.categories||[];
 const opponentStats=data?.results?.opponent||[];
 const targeted=categories=>categories.map(c=>({
  name:c.name,
  stats:(c.stats||[]).filter(s=>/rushingYards|netPassingYards|passingYards|gamesPlayed|totalYards|sackYards/i.test(s.name))
     .map(s=>({name:s.name,value:s.value,displayValue:s.displayValue,perGameValue:s.perGameValue,rank:s.rank}))
 })).filter(c=>c.stats.length);
 const all=data?.sports?.[0]?.leagues?.[0]?.teams||[];
 return {top:keys(data),team:keys(data?.team),stats:keys(data?.stats),
   season:data?.season,requestedSeason:data?.requestedSeason,
   teamRecord:data?.team?.recordSummary,activeTeams:all.map(x=>({id:x.team?.id,name:x.team?.displayName})).slice(0,34),
   seasonCategories:seasonStats.map(x=>x.name),opponentCategories:opponentStats.map(x=>x.name),
   exactOffense:targeted(seasonStats),exactDefense:targeted(opponentStats),
   splits:keys(data?.splits),categories:Array.isArray(data?.splits?.categories)?
   data.splits.categories.map(c=>({name:c.name,stats:(c.stats||[]).slice(0,4).map(s=>({name:s.name,displayValue:s.displayValue}))})).slice(0,14):[],
   samples};
}
(async()=>{
 for(const [name,url] of sources){
  try{const result=await load(url);console.log('NFL PUBLIC',name,JSON.stringify(shape(result)));}
  catch(error){console.log('NFL PUBLIC',name,'UNAVAILABLE',error.message);}
 }
 try{
  const board=await load(base+'/scoreboard?dates=2026&week=6&seasontype=2&limit=50');
  console.log('NFL PUBLIC scoreboard',JSON.stringify({top:Object.keys(board),leagues:board.leagues?.map(x=>({season:x.season?.year,week:x.week?.number})),events:(board.events||[]).slice(0,2).map(e=>({id:e.id,date:e.date,status:e.status?.type?.name,teams:e.competitions?.[0]?.competitors?.map(x=>x.team.displayName)}))}));
  const event=(board.events||[]).find(e=>e.status?.type?.completed===true);
  if(event){
   const detail=await load(base+'/summary?event='+encodeURIComponent(event.id));
   const box=detail.boxscore;
   console.log('NFL PUBLIC summary',JSON.stringify({event:event.id,keys:Object.keys(detail),boxKeys:Object.keys(box||{}),
    teams:(box?.teams||[]).map(t=>({team:t.team?.displayName,keys:Object.keys(t),
      statistics:(t.statistics||[]).slice(0,18).map(s=>({name:s.name,label:s.label,displayValue:s.displayValue}))}))}));
  }
 }catch(error){console.log('NFL PUBLIC scoreboard-summary UNAVAILABLE',error.message);}
})().catch(e=>{console.error('Public NFL probe failed:',e.message);process.exitCode=1;});
