'use strict';
// Offline research collection only; never called by production routes.
const fs=require('node:fs');
const {convert}=require('../nba-public');
async function collect(season,fetcher=fetch){
 if(!Number.isInteger(season)||season<2020||season>new Date().getUTCFullYear()-1)throw Error('A completed NBA start-year is required');
 const teams=require('../data/nba-public-2024-2025-audit.json').counts;
 const observations=new Map(),exclusions=new Map(),sources=[],counts=[];
 for(const team of teams){
  const url=`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${team.id}/schedule?season=${season+1}&seasontype=2`;
  const r=await fetcher(url,{signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('Schedule HTTP '+r.status);
  const d=await r.json();if(!Array.isArray(d.events)||d.events.length>150)throw Error('Invalid schedule');
  sources.push({teamId:team.id,url,events:d.events.length,wrapperSeason:d.season?.year});
  const seen=new Set();
  for(const event of d.events){
   const raw=convert(event,season,2);if(!raw)throw Error('Unverified event '+event.id);
   if(raw.status.short!==3){exclusions.set(raw.id,{id:raw.id,reason:'Not a final result'});continue;}
   const notes=JSON.stringify(event.competitions?.[0]?.notes||[]);
   if(/NBA Cup.*Championship/i.test(notes)){exclusions.set(raw.id,{id:raw.id,reason:'Source identifies NBA Cup Championship; excluded from regular season'});continue;}
   const row=[raw.id,raw.date.start,raw.teams.visitors.id,raw.teams.home.id,raw.scores.visitors.points,raw.scores.home.points,raw.arena.name||null];
   if(!row.slice(2,4).includes(Number(team.id))||row[4]===row[5]||!row.slice(4,6).every(Number.isInteger)||seen.has(raw.id))throw Error('Invalid completed game '+raw.id);
   seen.add(raw.id);const old=observations.get(raw.id);
   if(old&&JSON.stringify(old.row)!==JSON.stringify(row))throw Error('Conflicting schedules '+raw.id);
   if(old)old.teams.add(String(team.id));else observations.set(raw.id,{row,teams:new Set([String(team.id)])});
  }
  if(seen.size!==82)throw Error('Expected 82 completed regular-season games for '+team.name+', got '+seen.size);
  counts.push({id:team.id,name:team.name,games:seen.size});
 }
 if(observations.size!==1230||[...observations.values()].some(r=>r.teams.size!==2))throw Error('Incomplete league coverage');
 return {retrievedAt:new Date().toISOString(),season,source:`ESPN public team schedules; event end-year ${season+1} regular season (wrapper season is not authoritative)`,sources,counts,exclusions:[...exclusions.values()],columns:['id','tipoff','awayId','homeId','awayScore','homeScore','arena'],rows:[...observations.values()].map(r=>r.row).sort((a,b)=>Date.parse(a[1])-Date.parse(b[1])||a[0]-b[0])};
}
if(require.main===module){const season=Number(process.argv[2]),out=process.argv[3];if(!out)throw Error('Usage: node scripts/collect-nba-audit.js START_YEAR OUTPUT.json');collect(season).then(d=>{fs.writeFileSync(out,JSON.stringify(d)+'\n',{flag:'wx'});console.log(JSON.stringify({file:out,games:d.rows.length,teams:d.counts.length}));}).catch(e=>{console.error(e.message);process.exitCode=1;});}
module.exports={collect};
