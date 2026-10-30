'use strict';
const source=require('../data/nba-public-2024-2025-audit.json');
const {backtest}=require('../nba-backtest');
const {summarize}=require('../public/score-audit');
const names=new Map(source.counts.map(t=>[Number(t.id),t.name]));
const games=source.rows.map(([id,tipoff,awayId,homeId,awayScore,homeScore,arena])=>({id,league:'standard',season:2024,stage:2,date:{start:tipoff},status:{short:3},teams:{visitors:{id:awayId,name:names.get(awayId)},home:{id:homeId,name:names.get(homeId)}},scores:{visitors:{points:awayScore},home:{points:homeScore}},arena:{name:arena}}));
if(games.length!==1230||new Set(games.map(g=>g.id)).size!==1230||source.counts.length!==30)throw Error('Invalid archived season coverage');
for(const team of source.counts)if(games.filter(g=>[g.teams.visitors.id,g.teams.home.id].includes(Number(team.id))).length!==82)throw Error('Incomplete team history');
const results=['recent5','recent10','season'].map(scope=>{
 const replay=backtest(games,scope);
 const rows=replay.games.map(r=>({...r,projectedAway:r.predictedAway,projectedHome:r.predictedHome,actualAway:r.awayScore,actualHome:r.homeScore}));
 const metrics=rows=>{const m=summarize(rows);return {games:m.games,scoreMAE:m.scoreMAE,totalMAE:m.totalMAE,totalBias:m.totalBias,marginMAE:m.marginMAE,favoriteMarginBias:m.favoriteMarginBias};};
 return {scope,evaluated:replay.evaluated,skipped:replay.skipped,metrics:replay.metrics,diagnostics:metrics(rows),
  modelFavorite:{home:metrics(rows.filter(r=>r.projectedHome>r.projectedAway)),away:metrics(rows.filter(r=>r.projectedAway>r.projectedHome))},
  teams:source.counts.map(team=>({name:team.name,...metrics(rows.filter(r=>r.away===team.name||r.home===team.name))}))};
});
console.log(JSON.stringify({method:'Descriptive NBA 2024–25 regular-season replay using public ESPN team schedules retrieved '+source.retrievedAt+'. Source wrapper season incorrectly described the current season; individual event season years, duplicate agreement, 30 team identities and 82 completed regular-season games per team were checked. Five non-final schedule entries and the source-labeled NBA Cup Championship were excluded. Uses the existing production NBA backtest and its pre-tipoff history safeguards. Settings are compared on this one season; this is not an untouched validation set for choosing a new default. No historical odds, injuries, player props, returns, simulation calibration or future confidence validation. Model favorites are not sportsbook favorites; per-team groups overlap.',results},null,2));
