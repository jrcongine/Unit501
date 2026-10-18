'use strict';
// Reproducible historical replay. No API keys or network calls required.
const fs=require('node:fs');
const {summarize}=require('../rankings');
const model=require('../public/team-model');
const {summarize:metrics}=require('../public/score-audit');
const source=require('../data/nfl-home-field-games-2024-2025.json');
const results=[];
for(const season of ['2024','2025']) {
 const rows=source.filter(r=>r.season===season);
 const games=rows.map(r=>({league:{id:'1',season},game:{id:r.id,stage:r.stage,status:{short:r.status},date:{timestamp:r.kickoff/1000},venue:{name:r.venue}},teams:{away:{id:r.awayId,name:r.awayName},home:{id:r.homeId,name:r.homeName}},scores:{away:{total:r.awayScore},home:{total:r.homeScore}}}));
 const roster=[...new Map(rows.flatMap(r=>[[r.awayId,{id:r.awayId,name:r.awayName}],[r.homeId,{id:r.homeId,name:r.homeName}]])).values()];
 const records={2:[],3:[],4:[]},snapshots=new Map();
 for(const r of rows.sort((a,b)=>a.kickoff-b.kickoff)) {
  if(!snapshots.has(r.kickoff))snapshots.set(r.kickoff,{...summarize(games,new Map(),{league:'1',season,before:r.kickoff-86400000},roster),before:r.kickoff});
  const data=snapshots.get(r.kickoff),game={league:'1',season,kickoff:r.kickoff,awayId:r.awayId,homeId:r.homeId,venueName:r.venue};
  for(const prior of [2,3,4]){
   const p=model.project(data,game,{},false,prior);
   if(p.available)records[prior].push({id:r.id,kickoff:r.kickoff,projectedAway:p.away,projectedHome:p.home,actualAway:r.awayScore,actualHome:r.homeScore});
  }
 }
 const boundary=records[4][29]?.kickoff??Infinity;
 results.push({season,candidates:[2,3,4].map(prior=>({priorGames:prior,...metrics(records[prior].filter(r=>r.kickoff>boundary))}))});
}
const report={method:'Fixed 2/3/4 pseudo-game priors. Each forecast uses games at least 24 hours earlier; first 30 eligible predictions and their same-kickoff peers excluded. 2024 development comparison; 2025 separate-season check. No injury, weather, bookmaker lines or profit validation. NFL evidence does not establish college performance.',results};
console.log(JSON.stringify(report,null,2));
