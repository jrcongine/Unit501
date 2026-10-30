'use strict';
const source=require('../data/ncaab-selected-teams-2024-2025-audit.json');
const {backtest}=require('../ncaab-backtest');
const {summarize}=require('../public/score-audit');
const collected=new Set(source.sources.map(t=>t.id));
const events=source.rows.map(([id,tipoff,awayId,homeId,awayScore,homeScore,status,timeKnown,neutral])=>({id,date:tipoff,timeValid:timeKnown,season:{year:source.season,type:2},competitions:[{timeValid:timeKnown,neutralSite:neutral,status:{type:{name:status==='Final'?'STATUS_FINAL':status==='Canceled'?'STATUS_CANCELED':'STATUS_SCHEDULED',state:status==='Final'?'post':'pre',completed:status==='Final'}},competitors:[{homeAway:'away',team:{id:awayId,displayName:source.teams[awayId]},score:awayScore},{homeAway:'home',team:{id:homeId,displayName:source.teams[homeId]},score:homeScore}]}]}));
const results=['season','recent5','recent10'].map(scope=>{
 const replay=backtest(events,scope);
 // Do not score an opponent whose full returned team schedule was not collected.
 const rows=replay.games.filter(g=>collected.has(g.awayId)&&collected.has(g.homeId)).map(g=>({...g,projectedAway:g.predictedAway,projectedHome:g.predictedHome}));
 const m=summarize(rows),decisions=rows.filter(g=>g.winnerCorrect!==null);
 return {scope,evaluated:rows.length,invalid:replay.invalid,metrics:{teamScoreMAE:m.scoreMAE,totalMAE:m.totalMAE,totalBias:m.totalBias,marginMAE:m.marginMAE,winnerDecisions:decisions.length,winnerAccuracy:decisions.length?decisions.filter(g=>g.winnerCorrect).length/decisions.length:null},gameIds:rows.map(g=>g.id)};
});
console.log(JSON.stringify({method:'Selected-team college basketball replay of ESPN 2024–25 season-type-2 events. Ten purposively selected teams, not a representative league sample. Only matchups where BOTH teams had their schedules collected are graded. Individual event season and duplicate agreement were checked; current-year wrapper discrepancies are retained in provenance. This is a source-returned schedule sample, not independent certification of complete historical coverage. Existing pre-tipoff history and missing-score guards apply. No odds, betting returns, injuries, player props, simulation calibration or future confidence validation. No weights or defaults changed.',retrievedAt:source.retrievedAt,results},null,2));
