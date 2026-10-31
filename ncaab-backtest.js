'use strict';
// Replay the college scoring baseline. No fitted weights, bookmaker results,
// or simulation confidence is inferred from this descriptive report.
const {convert,summarize}=require('./ncaab-feed');
const {project,simulate}=require('./public/ncaab-model');
function backtest(raw,scope='season',options={}){
 const runs=options.simulationRuns??0;if(!Number.isInteger(runs)||runs<0||runs>100000)throw Error('Invalid simulation runs');
 if(!Array.isArray(raw))throw Error('Expected college basketball event array');
 if(!['season','recent5','recent10'].includes(scope))throw Error('Invalid scope');
 const unique=new Map();let invalid=0;
 const signature=g=>JSON.stringify([g.id,g.awayId,g.homeId,g.season,g.stage,g.tipoff,g.timeKnown,g.status,g.neutral,g.awayScore,g.homeScore]);
 for(const row of raw){const g=convert(row);if(!g){invalid++;continue;}const key=g.season+':'+g.id,old=unique.get(key);if(old&&signature(old)!==signature(g))throw Error('Conflicting college game records; replay withheld');unique.set(key,g);}
 const games=[];let skipped=0;
 for(const g of unique.values()){
  if(g.stage!==2||g.status!=='Final'||!g.timeKnown||g.awayScore===null||g.homeScore===null||g.awayScore===g.homeScore){skipped++;continue;}
  const now=Date.parse(g.tipoff)-1;
  const data={gameId:g.id,tipoff:g.tipoff,away:{id:g.awayId,...summarize(raw,g.awayId,g,now)},home:{id:g.homeId,...summarize(raw,g.homeId,g,now)}};
  const p=project({...g,status:'Scheduled'},data,scope,now);
  if(!p.available){skipped++;continue;}
  const predictedMargin=p.home-p.away,actualMargin=g.homeScore-g.awayScore;
  games.push({...(runs?{simulation:simulate(p,data,{},runs,require('./probability-audit').seededRandom(g.id))}:{}),id:g.id,season:g.season,tipoff:g.tipoff,away:g.away,home:g.home,awayId:g.awayId,homeId:g.homeId,predictedAway:p.away,predictedHome:p.home,actualAway:g.awayScore,actualHome:g.homeScore,predictedMargin,actualMargin,winnerCorrect:predictedMargin===0?null:Math.sign(predictedMargin)===Math.sign(actualMargin)});
 }
 games.sort((a,b)=>Date.parse(a.tipoff)-Date.parse(b.tipoff)||a.id.localeCompare(b.id));
 const mean=fn=>games.length?games.reduce((s,g)=>s+fn(g),0)/games.length:null;
 const decisions=games.filter(g=>g.winnerCorrect!==null);
 return {scope,evaluated:games.length,skipped,invalid,metrics:{teamScoreMAE:mean(g=>(Math.abs(g.predictedAway-g.actualAway)+Math.abs(g.predictedHome-g.actualHome))/2),totalMAE:mean(g=>Math.abs(g.predictedAway+g.predictedHome-g.actualAway-g.actualHome)),totalBias:mean(g=>g.predictedAway+g.predictedHome-g.actualAway-g.actualHome),marginMAE:mean(g=>Math.abs(g.predictedMargin-g.actualMargin)),winnerDecisions:decisions.length,winnerAccuracy:decisions.length?decisions.filter(g=>g.winnerCorrect).length/decisions.length:null},games};
}
if(require.main===module){try{const fs=require('node:fs');if(!process.argv[2])throw Error('Usage: node ncaab-backtest.js events.json [season|recent5|recent10]');const d=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));console.log(JSON.stringify(backtest(Array.isArray(d)?d:d.events,process.argv[3]||'season'),null,2));}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={backtest};
