'use strict';
// Offline research only. Production predictions and defaults are not changed.
const {backtest}=require('../nba-backtest');
const day=at=>{const p=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(at)).map(p=>[p.type,p.value]));return Date.UTC(+p.year,+p.month-1,+p.day)/86400000;};
function fit(rows,rest=false){
 if(rows.length<30)throw Error('At least 30 training games required');
 let sx=0,sy=0,sxx=20,sxy=0;
 for(const r of rows){const x=rest?r.restDifference:0,y=r.actualMargin-r.predictedMargin;if(![x,y].every(Number.isFinite))throw Error('Invalid training row');sx+=x;sy+=y;sxx+=x*x;sxy+=x*y;}
 const slope=rest?(sxy-sx*sy/rows.length)/(sxx-sx*sx/rows.length):0;
 return {homeMargin:sy/rows.length-slope*sx/rows.length,restPointsPerDay:slope};
}
const adjusted=(r,w)=>r.predictedMargin+w.homeMargin+w.restPointsPerDay*r.restDifference;
function metrics(rows,w){
 const errors=rows.map(r=>Math.abs(adjusted(r,w)-r.actualMargin));
 const decisions=rows.filter(r=>adjusted(r,w)!==0);
 return {games:rows.length,marginMAE:errors.reduce((a,b)=>a+b,0)/rows.length,
  winnerDecisions:decisions.length,winnerAccuracy:decisions.filter(r=>Math.sign(adjusted(r,w))===Math.sign(r.actualMargin)).length/decisions.length};
}
function pairedInterval(rows,base,candidate){
 const diffs=rows.map(r=>Math.abs(adjusted(r,candidate)-r.actualMargin)-Math.abs(adjusted(r,base)-r.actualMargin));
 let seed=501;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 // Date blocks preserve some same-day dependence. Not a full team-cluster model.
 const groups=new Map();rows.forEach((r,i)=>{const key=day(r.tipoff);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(diffs[i]);});
 const blocks=[...groups.values()],draws=[];
 for(let i=0;i<1000;i++){let sum=0,n=0;for(let j=0;j<blocks.length;j++){const b=blocks[Math.floor(rand()*blocks.length)];sum+=b.reduce((a,b)=>a+b,0);n+=b.length;}draws.push(sum/n);}
 draws.sort((a,b)=>a-b);
 return {meanChange:diffs.reduce((a,b)=>a+b,0)/diffs.length,lower95:draws[24],upper95:draws[974],dateBlocks:blocks.length};
}
function audit(source){
 const names=new Map(source.counts.map(t=>[Number(t.id),t.name]));
 if(source.rows.length!==1230||new Set(source.rows.map(r=>r[0])).size!==1230||names.size!==30)throw Error('Archived season coverage mismatch');
 for(const id of names.keys())if(source.rows.filter(r=>r[2]===id||r[3]===id).length!==82)throw Error('Incomplete team schedule');
 const raw=source.rows.map(([id,tipoff,awayId,homeId,awayScore,homeScore,arena])=>({id,league:'standard',season:2024,stage:2,date:{start:tipoff},status:{short:3},teams:{visitors:{id:awayId,name:names.get(awayId)},home:{id:homeId,name:names.get(homeId)}},scores:{visitors:{points:awayScore},home:{points:homeScore}},arena:{name:arena}}));
 const replay=backtest(raw,'recent5'),byId=new Map(source.rows.map(r=>[r[0],r]));
 const prior=new Map(),restById=new Map();
 for(const r of [...source.rows].sort((a,b)=>Date.parse(a[1])-Date.parse(b[1]))){
  const rest=id=>prior.has(id)?Math.min(3,Math.max(0,day(r[1])-day(prior.get(id))-1)):null;
  const a=rest(r[2]),h=rest(r[3]);if(a!==null&&h!==null)restById.set(r[0],h-a);
  prior.set(r[2],r[1]);prior.set(r[3],r[1]);
 }
 const rows=replay.games.map(r=>({...r,restDifference:restById.get(Number(r.id))})).filter(r=>Number.isFinite(r.restDifference)&&byId.has(Number(r.id)));
 const cutoff=Date.parse('2025-01-01T00:00:00Z'),train=rows.filter(r=>Date.parse(r.tipoff)<cutoff),validation=rows.filter(r=>Date.parse(r.tipoff)>=cutoff);
 const weights={baseline:{homeMargin:0,restPointsPerDay:0},homeOnly:fit(train),homeAndRest:fit(train,true)};
 return {method:'Research candidate, not production. Archived NBA 2024-25, existing recent5 baseline. Fit residual home margin on games before 2025-01-01 UTC; evaluate later games with frozen coefficients. Home-minus-away full Central calendar days off, capped at 3 per team; ridge penalty 20 on rest slope only, no tuning. Training fits home advantage and home advantage plus rest as an ablation. Date-block bootstrap uses 1000 seeded draws; team dependence across dates remains. This season has already been inspected, so this is not independent external validation. No odds, ROI, injuries, travel paths or calibrated win probabilities.',
  trainingGames:train.length,validationGames:validation.length,cutoff:new Date(cutoff).toISOString(),weights,
  validation:Object.fromEntries(Object.entries(weights).map(([name,w])=>[name,metrics(validation,w)])),
  pairedMarginError:{homeVsBaseline:pairedInterval(validation,weights.baseline,weights.homeOnly),homeAndRestVsBaseline:pairedInterval(validation,weights.baseline,weights.homeAndRest),restVsHomeOnly:pairedInterval(validation,weights.homeOnly,weights.homeAndRest)},
  validationHalves:[validation.slice(0,Math.floor(validation.length/2)),validation.slice(Math.floor(validation.length/2))].map(part=>Object.fromEntries(Object.entries(weights).map(([name,w])=>[name,metrics(part,w)])))};
}
if(require.main===module)console.log(JSON.stringify(audit(require('../data/nba-public-2024-2025-audit.json')),null,2));
module.exports={fit,metrics,audit};
