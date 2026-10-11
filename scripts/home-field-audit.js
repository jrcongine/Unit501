'use strict';
const fs=require('node:fs'),path=require('node:path');
const {fitHomeField}=require('../home-field'),{summarize}=require('../rankings'),model=require('../public/team-model');
const games=require('../data/nfl-home-field-games-2024-2025.json');
const raw=games.filter(g=>g.season==='2025').map(g=>({game:{id:g.id,stage:g.stage,status:{short:g.status},date:{timestamp:g.kickoff/1000},venue:{name:g.venue}},league:{id:1,season:2025},teams:{home:{id:g.homeId,name:g.homeName},away:{id:g.awayId,name:g.awayName}},scores:{home:{total:g.homeScore},away:{total:g.awayScore}}}));
const teams=[...new Map(raw.flatMap(g=>[g.teams.home,g.teams.away]).map(t=>[String(t.id),t])).values()];
const training={...fitHomeField(games,Date.parse('2025-03-01T00:00:00Z')),league:'1',season:'2025'},rows=[];
for(const g of raw.filter(g=>['FT','AOT','FINAL'].includes(g.game.status.short)).sort((a,b)=>a.game.date.timestamp-b.game.date.timestamp)){
 const before=g.game.date.timestamp*1000,data=summarize(raw,new Map(),{league:'1',season:'2025',before:before-86400000},teams);data.before=before;
 for(const t of data.teams){t.opponentScheduleVerified=true;t.scoringOnly=true;}
 const game={league:'1',season:'2025',kickoff:before,homeId:String(g.teams.home.id),awayId:String(g.teams.away.id),venueName:g.game.venue.name};
 const a=model.project(data,game),b=model.project(data,game,{variableHomeField:true,homeFieldProfile:training});
 if(!a.available||!b.available||!b.venue.variable)continue;
 const actual=g.scores.home.total-g.scores.away.total;rows.push({id:g.game.id,kickoff:before,baseline:Math.abs(actual-(a.home-a.away)),candidate:Math.abs(actual-(b.home-b.away))});
}
const mean=k=>rows.reduce((s,r)=>s+r[k],0)/rows.length;
const profile={...fitHomeField(games,Date.parse('2026-02-01T00:00:00Z')),league:'1',season:'2026',source:'API-Sports completed regular-season schedules',automatic:false,
 validation:{trainingSeason:'2024',evaluationSeason:'2025',games:rows.length,baselineMarginMAE:mean('baseline'),candidateMarginMAE:mean('candidate'),automatic:false},
 coverageNote:'2024 has 256 verified finals; 16 regular-season games lack final status and are excluded. 2025 has 272 verified finals. Unknown, alternate and shared home venues are excluded.'};
profile.validation.reason=`Did not improve held-out margin error: ${profile.validation.candidateMarginMAE.toFixed(2)} vs ${profile.validation.baselineMarginMAE.toFixed(2)} points over ${rows.length} games. Optional experiment; flat bonus remains default.`;
if(process.argv.includes('--write'))fs.writeFileSync(path.join(__dirname,'../public/home-field-profiles.json'),JSON.stringify(profile,null,2)+'\n');
console.log(JSON.stringify({games:profile.games,excludedVenueGames:profile.excludedVenueGames,validation:profile.validation},null,2));
