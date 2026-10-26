'use strict';
// Research only. Replay the production NFL display formula at each cutoff;
// never use today's standings to modify an earlier forecast.
const {buildPowerBoard}=require('../league-pulse');
const {summarize}=require('../rankings');
const {project}=require('../public/team-model');
const {summarize:metrics}=require('../public/score-audit');
function historicalBoard(rows,season,before){
 const teams=new Map(),seen=new Set();
 for(const r of rows){
  if(r.season!==season||r.league!=='1'||r.stage!=='Regular Season'||
    !['FT','AOT'].includes(r.status)||!Number.isFinite(r.kickoff)||r.kickoff>=before)continue;
  if(seen.has(r.id))throw Error('Duplicate historical game ID');seen.add(r.id);
  if(![r.homeScore,r.awayScore].every(s=>Number.isInteger(s)&&s>=0))throw Error('Invalid historical score');
  for(const [id,name,scored,allowed] of [[r.homeId,r.homeName,r.homeScore,r.awayScore],[r.awayId,r.awayName,r.awayScore,r.homeScore]]){
   const t=teams.get(id)||{id,name,games:0,wins:0,losses:0,ties:0,pointsFor:0,pointsAgainst:0};
   t.games++;t.wins+=scored>allowed?1:0;t.losses+=scored<allowed?1:0;t.ties+=scored===allowed?1:0;
   t.pointsFor+=scored;t.pointsAgainst+=allowed;teams.set(id,t);
  }
 }
 const entries=[...teams.values()].map(t=>({team:{id:t.id,displayName:t.name},stats:
  Object.entries({...t,gamesPlayed:t.games,pointDifferential:t.pointsFor-t.pointsAgainst})
   .filter(([,value])=>typeof value==='number').map(([name,value])=>({name,value}))}));
 return buildPowerBoard({season:{year:Number(season)},standings:{entries}},'nfl',Number(season),before);
}
function candidate(baseline,board,game){
 if(!baseline?.available||!board?.available)return null;
 const away=board.teams.find(t=>t.id===game.awayId),home=board.teams.find(t=>t.id===game.homeId);
 if(!away||!home)return null;
 // Fixed research assumption: 10 index points = 1 margin point, capped at 6.
 // Apply an incremental signal to test whether existing corrections already
 // contain it. Transfer points rather than inflating the projected total.
 const delta=Math.max(-6,Math.min(6,(home.score-away.score)*.1));
 const transfer=Math.max(-baseline.home,Math.min(baseline.away,delta/2));
 return {away:baseline.away-transfer,home:baseline.home+transfer,marginChange:transfer*2};
}
function audit(source){
 const results=[];
 for(const season of ['2024','2025']){
  const rows=source.filter(r=>r.season===season).sort((a,b)=>a.kickoff-b.kickoff);
  const games=rows.map(r=>({league:{id:'1',season},game:{id:r.id,stage:r.stage,status:{short:r.status},date:{timestamp:r.kickoff/1000},venue:{name:r.venue}},teams:{away:{id:r.awayId,name:r.awayName},home:{id:r.homeId,name:r.homeName}},scores:{away:{total:r.awayScore},home:{total:r.homeScore}}}));
  const roster=[...new Map(rows.flatMap(r=>[[r.awayId,{id:r.awayId,name:r.awayName}],[r.homeId,{id:r.homeId,name:r.homeName}]])).values()];
  const records=[],snapshots=new Map();
  for(const r of rows){
   if(!snapshots.has(r.kickoff)){
    const before=r.kickoff-86400000;
    snapshots.set(r.kickoff,{data:{...summarize(games,new Map(),{league:'1',season,before},roster),before:r.kickoff},board:historicalBoard(rows,season,before)});
   }
   const {data,board}=snapshots.get(r.kickoff),game={league:'1',season,kickoff:r.kickoff,awayId:r.awayId,homeId:r.homeId,venueName:r.venue};
   const baseline=project(data,game),adjusted=candidate(baseline,board,game);
   if(adjusted)records.push({id:r.id,kickoff:r.kickoff,actualAway:r.awayScore,actualHome:r.homeScore,baseline,adjusted});
  }
  const boundary=records[29]?.kickoff??Infinity,heldout=records.filter(r=>r.kickoff>boundary);
  const scoreMetrics=key=>metrics(heldout.map(r=>({...r,projectedAway:r[key].away,projectedHome:r[key].home})));
  results.push({season,baseline:scoreMetrics('baseline'),candidate:scoreMetrics('adjusted')});
 }
 return {method:'Research-only fixed incremental margin correction: 0.1 points per home-minus-away NFL Power Index point, bounded to +/-6. Rebuild the production display formula using only results at least 24 hours earlier. Exclude first 30 eligible games and same-kickoff peers. No coefficient tuning, current standings, bookmaker lines, injury/weather or wagering returns. NFL evidence only.',results};
}
if(require.main===module)console.log(JSON.stringify(audit(require('../data/nfl-home-field-games-2024-2025.json')),null,2));
module.exports={historicalBoard,candidate,audit};
