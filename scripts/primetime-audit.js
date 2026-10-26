'use strict';
// Read-only historical research. The archive has final scores, not betting lines.
const {summarize}=require('../rankings');
const {project}=require('../public/team-model');
const {summarize:metrics}=require('../public/score-audit');
const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',weekday:'short',hour:'2-digit',hourCycle:'h23'});
function windowFor(timestamp){
 if(!Number.isFinite(timestamp))return null;
 const p=Object.fromEntries(parts.formatToParts(timestamp).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
 const hour=Number(p.hour);
 if(['Thu','Sun','Mon'].includes(p.weekday)&&hour>=18)return 'evening';
 if(p.weekday==='Sun'&&hour>=6&&hour<18)return 'sundayDay';
 return null;
}
function compare(rows){
 const metric=variant=>metrics(rows.map(r=>({id:r.id,kickoff:r.kickoff,projectedAway:r[variant].away,projectedHome:r[variant].home,actualAway:r.actualAway,actualHome:r.actualHome})));
 const evaluated=rows.filter(r=>r.normal.away!==r.normal.home&&r.actualAway!==r.actualHome);
 const modelFavoriteWins=evaluated.filter(r=>Math.sign(r.normal.home-r.normal.away)===Math.sign(r.actualHome-r.actualAway)).length;
 return {baseline:metric('normal'),scenario:metric('scenario'),modelFavoriteWins,modelFavoriteLosses:evaluated.length-modelFavoriteWins};
}
function audit(source){
 const results=[];
 for(const season of ['2024','2025']){
  const rows=source.filter(r=>r.season===season&&r.league==='1'&&r.stage==='Regular Season'&&['FT','AOT'].includes(r.status)).sort((a,b)=>a.kickoff-b.kickoff||String(a.id).localeCompare(String(b.id)));
  if(new Set(rows.map(r=>r.id)).size!==rows.length)throw Error('Duplicate historical game ID');
  const games=rows.map(r=>({league:{id:'1',season},game:{id:r.id,stage:r.stage,status:{short:r.status},date:{timestamp:r.kickoff/1000},venue:{name:r.venue}},teams:{away:{id:r.awayId,name:r.awayName},home:{id:r.homeId,name:r.homeName}},scores:{away:{total:r.awayScore},home:{total:r.homeScore}}}));
  const roster=[...new Map(rows.flatMap(r=>[[r.awayId,{id:r.awayId,name:r.awayName}],[r.homeId,{id:r.homeId,name:r.homeName}]])).values()];
  const valid=[],snapshots=new Map();
  for(const r of rows){
   if(!snapshots.has(r.kickoff))snapshots.set(r.kickoff,{...summarize(games,new Map(),{league:'1',season,before:r.kickoff-86400000},roster),before:r.kickoff});
   const game={league:'1',season,kickoff:r.kickoff,awayId:r.awayId,homeId:r.homeId,venueName:r.venue};
   const data=snapshots.get(r.kickoff),normal=project(data,game),window=windowFor(r.kickoff);
   if(!normal.available)continue;
   const scenario=window?project(data,game,{gameMode:window==='evening'?'primetime':'upset'}):null;
   valid.push({id:r.id,kickoff:r.kickoff,actualAway:r.awayScore,actualHome:r.homeScore,window,normal,scenario});
  }
  const boundary=valid[29]?.kickoff??Infinity;
  const later=valid.filter(r=>r.kickoff>boundary&&r.window&&r.scenario?.available);
  results.push({season,evening:compare(later.filter(r=>r.window==='evening')),sundayDay:compare(later.filter(r=>r.window==='sundayDay'))});
 }
 return {method:'Research replay of existing manual +/-10% margin scenarios, preserving projected totals. NFL regular-season archive 2024 and 2025. Pre-kickoff data at least 24 hours old; first 30 eligible forecasts and same-kickoff peers excluded. Evening = Thursday/Sunday/Monday kickoff 6pm or later Central; Sunday day = Sunday 6am–5:59pm Central. Kickoff-time proxy, not verified TV scheduling. Favorite means model-projected winner, not sportsbook favorite. No betting lines, player prop outcomes, injuries, weather, college or wagering returns.',results};
}
if(require.main===module)console.log(JSON.stringify(audit(require('../data/nfl-home-field-games-2024-2025.json')),null,2));
module.exports={windowFor,compare,audit};
