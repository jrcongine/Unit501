'use strict';
// Public NFL team-season yardage context, for display only.
// Never substitutes for historical pregame box scores or the calibrated scoring/prop models.
// Publicly reachable endpoints are not a grant of commercial redistribution rights.
const BASE='https://site.api.espn.com/apis/site/v2/sports/football/nfl';
const YARDAGE=['rushFor','passFor','rushAgainst','passAgainst'];
const normalize=name=>String(name||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const finite=v=>typeof v==='number'&&Number.isFinite(v)?v:null;
function numberField(categories,category,name){
 const groups=(categories||[]).filter(x=>x?.name===category);
 const entries=groups.length===1?(groups[0].stats||[]).filter(x=>x.name===name):[];
 return entries.length===1?finite(entries[0].value):null;
}
function readESPNTeam(raw,club,season){
 if(!raw||Number(raw.season?.year)!==Number(season)||Number(raw.season?.type)!==2||
    Number(raw.requestedSeason?.year)!==Number(season)||
    Number(raw.requestedSeason?.type)!==2||
    String(raw.team?.id)!==String(club.id)||
    normalize(raw.team?.displayName)!==normalize(club.name))return null;
 const offense=raw.results?.stats?.categories,defense=raw.results?.opponent;
 if(!Array.isArray(offense)||!Array.isArray(defense))return null;
 const games=numberField(offense,'general','gamesPlayed');
 if(!Number.isInteger(games)||games<1||games>17)return null;
 const record=/^(\d+)-(\d+)(?:-(\d+))?$/.exec(String(raw.team?.recordSummary||''));
 if(record&&Number(record[1])+Number(record[2])+Number(record[3]||0)!==games)return null;
 const fields=[
  ['rushFor',offense,'rushing','rushingYards','rushingYardsPerGame'],
  ['passFor',offense,'passing','netPassingYards','netPassingYardsPerGame'],
  ['rushAgainst',defense,'rushing','rushingYards','rushingYardsPerGame'],
  ['passAgainst',defense,'passing','netPassingYards','netPassingYardsPerGame']
 ];
 const totals={};
 for(const [key,categories,group,stat,averageStat]of fields){
  const total=numberField(categories,group,stat);
  const reportedAvg=numberField(categories,group,averageStat);
  const matchesGames=numberField(categories,group,'teamGamesPlayed');
  if(!Number.isInteger(total)||total<0||total>900*games||
     reportedAvg===null||Math.abs(total/games-reportedAvg)>0.16||
     (matchesGames!==null&&matchesGames!==games))return null;
  totals[key]=total;
 }
 return {id:String(club.id),name:club.name,games,totals};
}
function createPublicNFLYardage(options={}){
 const request=options.request||async url=>{
  const response=await fetch(url,{signal:AbortSignal.timeout(10000),headers:{Accept:'application/json'}});
  if(!response.ok)throw Error('Public NFL data HTTP '+response.status);
  return response.json();
 };
 const clock=options.now||Date.now;
 const lifetime=options.ttlMs??30*60000;
 let cache=null,inflight=null;
 async function build(season){
  const list=await request(BASE+'/teams?limit=40');
  const clubs=list?.sports?.[0]?.leagues?.[0]?.teams?.map(v=>v.team);
  if(!Array.isArray(clubs)||clubs.length!==32||new Set(clubs.map(t=>String(t?.id))).size!==32||
    new Set(clubs.map(t=>normalize(t?.displayName))).size!==32)throw Error('Incomplete public NFL team list.');
  const results=new Array(32),workers=Array.from({length:4},async(_,worker)=>{
   for(let i=worker;i<32;i+=4){
    const club=clubs[i];
    const payload=await request(BASE+'/teams/'+encodeURIComponent(club.id)+
      '/statistics?season='+encodeURIComponent(season)+'&seasontype=2');
    const row=readESPNTeam(payload,{id:club.id,name:club.displayName},season);
    if(!row)throw Error('Unverified public team statistics: '+club.displayName);
    results[i]=row;
   }
  });
  await Promise.all(workers);
  if(results.some(t=>!t))throw Error('Incomplete NFL public yardage snapshot.');
  return {season:String(season),fetchedAt:clock(),source:'ESPN 2026 NFL team statistics',
    teams:results};
 }
 return async function get(query,leagueGames=[]){
  const now=clock(),season=String(query?.season||''),before=Number(query?.before);
  if(String(query?.league)!=='1'||season!==String(new Date(now).getUTCFullYear())||
    !Number.isFinite(before)||before<=now||before-now>10*86400000)return null;
  // Never blend live-game totals into a pregame ranking. A final game is fine:
  // the calling adapter separately compares all 32 completed-game counts.
  if(leagueGames.some(g=>String(g?.league?.id)==='1'&&
    String(g?.league?.season)===season&&g.game?.stage==='Regular Season'&&
    Number(g.game?.date?.timestamp)*1000<=now&&
    !['FT','AOT','FINAL'].includes(String(g.game?.status?.short||'').toUpperCase())))return null;
  try{
   if(!cache||cache.season!==season||now-cache.fetchedAt>=lifetime){
    if(!inflight)inflight=build(season).then(value=>{cache=value;return value;})
      .catch(()=>null).finally(()=>{inflight=null;});
    const fresh=await inflight;
    if(!fresh)return null;
   }
   return cache?.fetchedAt<before?cache:null;
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
  source:'ESPN NFL regular-season team statistics',
  fetchedAt:snapshot.fetchedAt,coverage:32,
  teams:Object.fromEntries(ranks)
 }};
}
module.exports={createPublicNFLYardage,readESPNTeam,withVerifiedYardage};
