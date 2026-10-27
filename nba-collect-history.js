'use strict';
// Build an offline backtest dataset from public NBA team schedules.
const {convert}=require('./nba-public');
const {normalizeGame}=require('./nba-feed');
const ROOT='https://site.api.espn.com/apis/site/v2/sports/basketball/nba';
async function collect(season, stage=2, fetcher=fetch) {
 if (!Number.isInteger(season)||season<2000||season>2100||![1,2,3].includes(stage)) throw Error('Invalid NBA season or stage');
 async function read(path) {
  const r=await fetcher(ROOT+path,{signal:AbortSignal.timeout(20000),redirect:'error'});
  if (!r.ok) throw Error('NBA public history request failed');
  if (Number(r.headers?.get?.('content-length')||0)>5000000) throw Error('NBA response too large');
  return r.json();
 }
 const league=await read('/teams?limit=100');
 const teams=league?.sports?.[0]?.leagues?.[0]?.teams;
 if (!Array.isArray(teams)||teams.length!==30) throw Error('Expected 30 NBA teams; dataset not saved');
 const ids=teams.map(t=>Number(t.team?.id));
 if(ids.some(id=>!Number.isSafeInteger(id)||id<1)||new Set(ids).size!==30) throw Error('NBA team identities could not be verified');
 const results=new Array(ids.length);let next=0;
 await Promise.all(Array.from({length:4},async()=>{while(next<ids.length){
  const index=next++,id=ids[index];
  const data=await read(`/teams/${id}/schedule?season=${season+1}&seasontype=${stage}`);
  if(Number(data.team?.id)!==id||Number(data.season?.year)!==season+1||Number(data.season?.type)!==stage||!Array.isArray(data.events)||data.events.length>150)
   throw Error('NBA team schedule could not be verified');
  results[index]=data.events.map(event=>{
   const game=convert(event,season,stage);
   if(!game||game.stage!==stage||![game.teams.visitors.id,game.teams.home.id].includes(id)) throw Error('NBA schedule contains an unverified event');
   return game;
  });
 }}));
 const games=new Map(), appearances=new Map();
 for(const rows of results)for(const row of rows){
  const g=normalizeGame(row),old=games.get(g.id);
  if(old&&JSON.stringify(normalizeGame(old))!==JSON.stringify(g))throw Error('Conflicting NBA game records');
  games.set(g.id,row);appearances.set(g.id,(appearances.get(g.id)||0)+1);
 }
 if([...appearances.values()].some(n=>n!==2))throw Error('A game is missing from one team schedule or duplicated');
 return {source:'ESPN public team schedules',season,stage,collectedAt:new Date().toISOString(),teams:ids.length,
  response:[...games.values()].sort((a,b)=>Date.parse(a.date.start)-Date.parse(b.date.start)||a.id-b.id)};
}
if(require.main===module){
 (async()=>{
  const season=Number(process.argv[2]),stage=process.argv[3]?Number(process.argv[3]):2;
  const output=process.argv[4];if(!output)throw Error('Usage: node nba-collect-history.js SEASON [STAGE] OUTPUT.json');
  const result=await collect(season,stage);
  require('node:fs').writeFileSync(output,JSON.stringify(result,null,2),{flag:'wx'});
  console.log(`Saved ${result.response.length} games from ${result.teams} team schedules to ${output}`);
 })().catch(e=>{console.error(e.message);process.exitCode=1;});
}
module.exports={collect};
