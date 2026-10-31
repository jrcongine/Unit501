'use strict';
// Frozen candidate from October 30; no fitting or tuning on the new season.
const {metrics,seededRandom}=require('../probability-audit');
const {backtest}=require('../nba-backtest');
const archive=require('../data/nba-public-2025-2026-audit.json');
const prior=require('../data/basketball-probability-audit-2026-10-30.json');
const coefficients=prior.nba.candidate.coefficients;
const names=new Map(archive.counts.map(t=>[Number(t.id),t.name]));
if(archive.season!==2025||archive.rows.length!==1230||archive.counts.length!==30||archive.counts.some(t=>t.games!==82))throw Error('Independent archive coverage invalid');
const raw=archive.rows.map(([id,tipoff,a,h,af,hf,arena])=>({id,league:'standard',season:2025,stage:2,date:{start:tipoff},status:{short:3},teams:{visitors:{id:a,name:names.get(a)},home:{id:h,name:names.get(h)}},scores:{visitors:{points:af},home:{points:hf}},arena:{name:arena}}));
const replay=backtest(raw,'season',{simulationRuns:10000}),rows=[],adjusted=[];let withheld=0;
for(const g of replay.games){const s=g.simulation;if(!s?.available||s.homeWin+s.awayWin<=0){withheld++;continue;}
 const p=s.homeWin/(s.homeWin+s.awayWin),y=Number(g.homeScore>g.awayScore),row={id:g.id,tipoff:g.tipoff,p,y};
 if(!Number.isFinite(p)||p<0||p>1)throw Error('Invalid simulation');rows.push(row);
 const clipped=Math.max(1e-6,Math.min(1-1e-6,p)),z=coefficients.intercept+coefficients.slope*Math.log(clipped/(1-clipped));
 adjusted.push({...row,p:z>=0?1/(1+Math.exp(-z)):Math.exp(z)/(1+Math.exp(z))});
}
const blocks=new Map();rows.forEach((r,i)=>{const date=r.tipoff.slice(0,10);if(!blocks.has(date))blocks.set(date,[]);blocks.get(date).push((adjusted[i].p-r.y)**2-(r.p-r.y)**2);});
const groups=[...blocks.values()],rng=seededRandom('independent-nba-calibration-2025-v1'),deltas=[];
for(let b=0;b<2000;b++){let sum=0,n=0;for(let i=0;i<groups.length;i++)for(const value of groups[Math.floor(rng()*groups.length)]){sum+=value;n++;}deltas.push(sum/n);}deltas.sort((a,b)=>a-b);
console.log(JSON.stringify({method:'Newly collected 2025–26 full regular season. Fixed October 30 candidate trained on pre-January-2025 games; no refitting or tuning on this season. Retrospective pre-tipoff score replay, 10,000 deterministic draws per game. Probabilities condition on non-tied simulations; no overtime model, odds, historical injuries or prospective acceptance. Brier/log-loss lower is better. Paired date-block bootstrap: 2,000 replicates. This audit alone never modifies production probabilities.',coefficients,season:archive.season,archiveGames:archive.rows.length,scoreForecasts:replay.games.length,unavailableSimulation:withheld,baseline:metrics(rows),candidate:metrics(adjusted),brierDeltaInterval95:[deltas[49],deltas[1949]],dateBlocks:groups.length,monthly:[...new Set(rows.map(r=>r.tipoff.slice(0,7)))].map(month=>({month,baseline:metrics(rows.filter(r=>r.tipoff.startsWith(month))),candidate:metrics(adjusted.filter(r=>r.tipoff.startsWith(month)))})),productionPolicy:'This script does not deploy models; production scope and validation decision are documented separately.'},null,2));
