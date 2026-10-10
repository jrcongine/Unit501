'use strict';
const {project}=require('./public/team-model');
const {fit}=require('./backtest');
const mean=a=>a.reduce((s,x)=>s+x,0)/a.length;
function validatePace(games,query,snapshot){
 const records=[];
 const ordered=[...new Map(games.filter(g=>String(g.league?.id)===String(query.league)&&String(g.league?.season)===String(query.season)&&['FT','AOT','FINAL'].includes(g.game?.status?.short)&&Number(g.game?.date?.timestamp)>0&&Number(g.game.date.timestamp)*1000<query.before&&(query.league!=='1'||g.game?.stage==='Regular Season')).map(g=>[String(g.game.id),g])).values()].sort((a,b)=>a.game.date.timestamp-b.game.date.timestamp);
 let lastBefore,data;
 for(const g of ordered){
  const before=Number(g.game.date.timestamp)*1000;if(before!==lastBefore){data=snapshot(before);lastBefore=before;}
  const game={league:query.league,season:query.season,kickoff:before,awayId:String(g.teams.away.id),homeId:String(g.teams.home.id),venueName:g.game.venue?.name};
  const candidate=project(data,game,{pace:true}),baseline=project(data,game,{pace:false});
  const numeric=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
  if(!candidate.available||!candidate.pace?.applied||!baseline.available||![g.scores?.away?.total,g.scores?.home?.total].every(numeric))continue;
  const away=Number(g.scores.away.total)-candidate.away,home=Number(g.scores.home.total)-candidate.home;
  records.push({id:String(g.game.id),kickoff:before,away,home,
   scoreError:(Math.abs(away)+Math.abs(home))/2,totalError:Math.abs(away+home),
   baselineScoreError:(Math.abs(Number(g.scores.away.total)-baseline.away)+Math.abs(Number(g.scores.home.total)-baseline.home))/2,
   baselineTotalError:Math.abs(Number(g.scores.away.total)+Number(g.scores.home.total)-baseline.away-baseline.home)});
 }
 // Freeze a warm-up boundary by kickoff, so simultaneous games share the split.
 const warmupCutoff=records.length>=30?records[29].kickoff:Infinity;
 const later=records.filter(r=>r.kickoff>warmupCutoff);
 const result={modelVersion:'pace-v1',league:query.league,season:query.season,before:query.before,games:records.length,evaluatedGames:later.length,accepted:false,
  calibration:records.length>=30?{...fit(records),modelVersion:'pace-v1'}:null,
  explanation:'Pre-kickoff drive/scoring snapshots only. First 30 games are warm-up; later games compare fixed drive-based and current formulas. This in-season comparison is not independent external validation.'};
 if(later.length){for(const key of ['scoreError','totalError','baselineScoreError','baselineTotalError'])result[key]=mean(later.map(r=>r[key]));result.accepted=later.length>=30&&result.scoreError<result.baselineScoreError&&result.totalError<result.baselineTotalError;}
 return result;
}
module.exports={validatePace};
