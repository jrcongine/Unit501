'use strict';
// Offline replay of the archived NFL schedule. Context segments are descriptive,
// not fitted weights or evidence of an edge against historical bookmaker lines.
const source=require('../data/nfl-home-field-games-2024-2025.json');
const {summarize}=require('../rankings');
const {reconcileGames}=require('../football-schedule-integrity');
const model=require('../public/team-model');
const {summarize:metrics}=require('../public/score-audit');
const hour=new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',hour:'numeric',hourCycle:'h23'});
const {fit}=require('../backtest');
const results=[];
function tails(rows,history){
 let expected=0,defaultExpected=0,fitted=0,strongCount=0,predictedMargin=0,realMargin=0;
 for(const r of rows){
  const earlier=history.filter(p=>p.kickoff<r.kickoff-86400000);
  const calibration=fit(earlier.map(p=>({away:p.actualAway-p.projectedAway,home:p.actualHome-p.projectedHome})));
  const prediction={available:true,away:r.projectedAway,home:r.projectedHome};
  const run=fit=>{
   let state=Number(r.id)>>>0;
   const random=()=>((state=(Math.imul(state,1664525)+1013904223)>>>0)/4294967296);
   // Thresholds for unrelated cover/over counters have no effect on the score draws.
   return model.simulate({...prediction,calibration:fit},0,1,10000,random).blowout.any;
  };
  const raw=run(null);defaultExpected+=raw;expected+=calibration?run(calibration):raw;
  if(calibration)fitted++;
  const margin=r.projectedHome-r.projectedAway;
  if(Math.abs(margin)>=7){strongCount++;predictedMargin+=Math.abs(margin);realMargin+=Math.sign(margin)*(r.actualHome-r.actualAway);}
 }
 return {games:rows.length,fitted,expected,defaultExpected,observed:rows.filter(r=>Math.abs(r.actualHome-r.actualAway)>=21).length,strongCount,predictedMargin:strongCount?predictedMargin/strongCount:null,actualMargin:strongCount?realMargin/strongCount:null};
}
for(const season of ['2024','2025']) {
 const raw=source.filter(r=>r.season===season);
 const games=reconcileGames(raw.map(r=>({league:{id:'1',season},game:{id:r.id,stage:r.stage,status:{short:r.status},date:{timestamp:r.kickoff/1000},venue:{name:r.venue}},teams:{away:{id:r.awayId,name:r.awayName},home:{id:r.homeId,name:r.homeName}},scores:{away:{total:r.awayScore},home:{total:r.homeScore}}})));
 const roster=[...new Map(raw.flatMap(r=>[[r.awayId,{id:r.awayId,name:r.awayName}],[r.homeId,{id:r.homeId,name:r.homeName}]])).values()];
 const snapshots=new Map(),records=[];
 for(const g of games.sort((a,b)=>a.game.date.timestamp-b.game.date.timestamp)) {
  const kickoff=g.game.date.timestamp*1000;
  if(!snapshots.has(kickoff))snapshots.set(kickoff,{...summarize(games,new Map(),{league:'1',season,before:kickoff-86400000},roster),before:kickoff});
  const data=snapshots.get(kickoff),game={league:'1',season,kickoff,awayId:String(g.teams.away.id),homeId:String(g.teams.home.id),venueName:g.game.venue.name};
  const p=model.project(data,game);
  if(!p.available)continue;
  records.push({id:String(g.game.id),kickoff,awayId:game.awayId,homeId:game.homeId,projectedAway:p.away,projectedHome:p.home,actualAway:g.scores.away.total,actualHome:g.scores.home.total});
 }
 const boundary=records[29]?.kickoff??Infinity;
 const later=records.filter(r=>r.kickoff>boundary);
 const segment=rows=>{
  const decided=rows.filter(r=>r.projectedHome!==r.projectedAway&&r.actualHome!==r.actualAway);
  return {...metrics(rows),winnerDecisions:decided.length,winnerAccuracy:decided.length?decided.filter(r=>Math.sign(r.projectedHome-r.projectedAway)===Math.sign(r.actualHome-r.actualAway)).length/decided.length:null};
 };
 results.push({season,eligible:records.length,warmupExcluded:records.length-later.length,simulatedMargins:tails(later,records),overall:segment(later),
  modelFavorite:{home:segment(later.filter(r=>r.projectedHome>r.projectedAway)),away:segment(later.filter(r=>r.projectedAway>r.projectedHome)),pickem:segment(later.filter(r=>r.projectedAway===r.projectedHome))},
  centralKickoff:{evening18OrLater:segment(later.filter(r=>Number(hour.format(r.kickoff))>=18)),earlier:segment(later.filter(r=>Number(hour.format(r.kickoff))<18))},
  teams:roster.map(t=>({id:t.id,name:t.name,...segment(later.filter(r=>r.awayId===t.id||r.homeId===t.id))}))});
}
console.log(JSON.stringify({method:'Archived NFL 2024/2025 regular-season results. Production baseline; each forecast uses games at least 24 hours earlier. Exclude first 30 eligible forecasts and same-kickoff peers separately per season. Team segments overlap; do not add their game counts. Favorites are MODEL favorites, not sportsbook favorites. Evening means Central kickoff hour >=18, not verified prime-time broadcast. No contemporaneous injuries, weather, odds, profit or calibrated-confidence validation. These seasons have already informed earlier audits, so this is descriptive replay, not a new untouched holdout. No live weights changed.',results},null,2));
