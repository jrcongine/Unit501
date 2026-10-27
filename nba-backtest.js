'use strict';
// Replay the production NBA scoring baseline using only earlier completed games.
const {normalizeGame,inferSeason}=require('./nba-feed');
const {summarize}=require('./nba-context');
const {project}=require('./public/nba-model');

function backtest(raw, scope='recent5') {
 if (!Array.isArray(raw)) throw Error('Expected an array of NBA provider games');
 if (!['season','recent5','recent10','venue'].includes(scope)) throw Error('Invalid scope');
 const groups=new Map();
 for (const row of raw) {
  const g=normalizeGame(row);
  if (!g || !g.id) continue;
  if (!groups.has(g.id)) groups.set(g.id,[]);
  groups.get(g.id).push(row);
 }
 const rows=[]; let skipped=0;
 for (const copies of groups.values()) {
  // Conflicting duplicate outcomes cannot be safely scored.
  const normalized=copies.map(normalizeGame);
  if (normalized.some(g=>JSON.stringify(g)!==JSON.stringify(normalized[0]))) { skipped++; continue; }
  const g=normalized[0];
  if (g.statusCode!==3 || !g.stage || !g.awayId || !g.homeId || g.awayId===g.homeId ||
      g.awayScore===null || g.homeScore===null || g.awayScore===g.homeScore) { skipped++; continue; }
  const season=inferSeason(g.tipoff.slice(0,10));
  const away=summarize(raw,g.awayId,g,season), home=summarize(raw,g.homeId,g,season);
  const matchup={...g,statusCode:1};
  const context={gameId:g.id,tipoff:g.tipoff,stage:g.stage,away:{...away,id:g.awayId},home:{...home,id:g.homeId}};
  const estimate=project(matchup,context,scope,Date.parse(g.tipoff)-1);
  if (!estimate.available) { skipped++; continue; }
  const actualTotal=g.awayScore+g.homeScore, actualMargin=g.homeScore-g.awayScore;
  const predictedMargin=estimate.home-estimate.away;
  rows.push({id:g.id,tipoff:g.tipoff,away:g.away,home:g.home,awayScore:g.awayScore,homeScore:g.homeScore,
   predictedAway:estimate.away,predictedHome:estimate.home,predictedTotal:estimate.total,
   actualTotal,predictedMargin,actualMargin,
   winnerCorrect:predictedMargin===0?null:Math.sign(predictedMargin)===Math.sign(actualMargin)});
 }
 rows.sort((a,b)=>Date.parse(a.tipoff)-Date.parse(b.tipoff)||a.id-b.id);
 const mean=fn=>rows.length?rows.reduce((sum,r)=>sum+fn(r),0)/rows.length:null;
 const decided=rows.filter(r=>r.winnerCorrect!==null);
 return {scope,evaluated:rows.length,skipped,metrics:{
  teamScoreMAE:mean(r=>(Math.abs(r.predictedAway-r.awayScore)+Math.abs(r.predictedHome-r.homeScore))/2),
  totalMAE:mean(r=>Math.abs(r.predictedTotal-r.actualTotal)),
  marginMAE:mean(r=>Math.abs(r.predictedMargin-r.actualMargin)),
  winnerAccuracy:decided.length?decided.filter(r=>r.winnerCorrect).length/decided.length:null,
  winnerDecisions:decided.length},games:rows};
}
if (require.main===module) {
 try {
  const fs=require('node:fs');
  if (!process.argv[2]) throw Error('Usage: node nba-backtest.js games.json [season|recent5|recent10|venue]');
  const input=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
  const rows=Array.isArray(input)?input:input.response;
  console.log(JSON.stringify(backtest(rows,process.argv[3]||'recent5'),null,2));
 } catch (error) { console.error(error.message); process.exitCode=1; }
}
module.exports={backtest};
