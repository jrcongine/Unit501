'use strict';
// Retrospective research only. No coefficients from this module reach live models.
const clip=p=>Math.max(1e-6,Math.min(1-1e-6,p));
const logit=p=>Math.log(clip(p)/(1-clip(p)));
const logistic=x=>x>=0?1/(1+Math.exp(-x)):Math.exp(x)/(1+Math.exp(x));
function seededRandom(key){let state=2166136261;for(const c of String(key))state=Math.imul(state^c.charCodeAt(0),16777619)>>>0;return ()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};}
function metrics(rows){
 if(!rows.length)return {games:0,brier:null,logLoss:null,reliability:[]};
 const bins=Array.from({length:10},(_,i)=>({lower:i/10,upper:(i+1)/10,games:0,sum:0,wins:0}));
 let brier=0,loss=0;
 for(const r of rows){const {p,y}=r;if(!Number.isFinite(p)||p<0||p>1||![0,1].includes(y))throw Error('Invalid probability/outcome');brier+=(p-y)**2;loss-=y*Math.log(clip(p))+(1-y)*Math.log(1-clip(p));const b=bins[Math.min(9,Math.floor(p*10))];b.games++;b.sum+=p;b.wins+=y;}
 return {games:rows.length,brier:brier/rows.length,logLoss:loss/rows.length,reliability:bins.filter(b=>b.games).map(b=>{
  const n=b.games,f=b.wins/n,z=1.96,den=1+z*z/n,mid=(f+z*z/(2*n))/den,half=z*Math.sqrt(f*(1-f)/n+z*z/(4*n*n))/den;
  return {lower:b.lower,upper:b.upper,games:n,meanProbability:b.sum/n,observedHomeWin:f,observedInterval95:[mid-half,mid+half]};
 })};
}
function fit(rows){
 // Ridge logistic recalibration: intercept + slope * logit(p). Unit penalty
 // pulls toward intercept=0, slope=1. Fit training rows only; no tuning on test.
 let a=0,b=1;
 for(let i=0;i<100;i++){
  let ga=a,gb=b-1,haa=1,hab=0,hbb=1;
  for(const r of rows){const x=logit(r.p),p=logistic(a+b*x),w=p*(1-p);ga+=p-r.y;gb+=(p-r.y)*x;haa+=w;hab+=w*x;hbb+=w*x*x;}
  const det=haa*hbb-hab*hab,da=(hbb*ga-hab*gb)/det,db=(haa*gb-hab*ga)/det;
  // Damp very large Newton steps for extreme/constant forecast samples.
  const scale=Math.max(1,Math.abs(da),Math.abs(db));a-=da/scale;b-=db/scale;
  if(Math.max(Math.abs(da),Math.abs(db))<1e-9)break;
 }
 return {intercept:a,slope:b};
}
function audit(input,{splitAt,minTraining=200,minEvaluation=200}={}){
 if(!Array.isArray(input)||!Number.isFinite(splitAt)||!Number.isInteger(minTraining)||minTraining<1||!Number.isInteger(minEvaluation)||minEvaluation<1)throw Error('Valid rows, chronological split and sample limits required');
 const unique=new Map();
 for(const row of input){
  if(row?.id===null||row?.id===undefined||!String(row.id).trim())throw Error('Missing forecast identity');
  const key=String(row.id),old=unique.get(key);if(old&&JSON.stringify(old)!==JSON.stringify(row))throw Error('Conflicting duplicate forecast');unique.set(key,row);
 }
 let invalid=0,allTies=0,unavailableSimulation=0;const rows=[];
 for(const r of unique.values()){
  const s=r.simulation;
  if(s?.available===false){unavailableSimulation++;continue;}
  if(!Number.isFinite(r.kickoff)||!Number.isFinite(r.knownAt)||r.knownAt<=r.kickoff||!Number.isFinite(r.forecastAt)||r.forecastAt>=r.kickoff||
   !s?.available||![s.homeWin,s.awayWin,s.tie].every(p=>Number.isFinite(p)&&p>=0&&p<=1)||Math.abs(s.homeWin+s.awayWin+s.tie-1)>1e-8||![0,1].includes(r.homeWon)){invalid++;continue;}
  const decided=s.homeWin+s.awayWin;if(decided===0){allTies++;continue;}
  // Conditional on a non-tied simulation. This is not an overtime model.
  rows.push({id:r.id,kickoff:r.kickoff,knownAt:r.knownAt,p:s.homeWin/decided,y:r.homeWon,tie:s.tie});
 }
 rows.sort((a,b)=>a.kickoff-b.kickoff||String(a.id).localeCompare(String(b.id)));
 const training=rows.filter(r=>r.kickoff<splitAt&&r.knownAt<splitAt),evaluation=rows.filter(r=>r.kickoff>=splitAt);
 const report={splitAt:new Date(splitAt).toISOString(),valid:rows.length,invalid,allTies,unavailableSimulation,splitEmbargoed:rows.length-training.length-evaluation.length,training:metrics(training),evaluation:metrics(evaluation),candidate:null,
  meanSimulationTie:rows.length?rows.reduce((s,r)=>s+r.tie,0)/rows.length:null,
  status:'insufficient',deploymentEligible:false};
 if(training.length<minTraining||evaluation.length<minEvaluation)return report;
 const coefficients=fit(training);
 const changed=evaluation.map(r=>({...r,p:logistic(coefficients.intercept+coefficients.slope*logit(r.p))}));
 // Paired bootstrap by UTC game date (not individual game): same-day results
 // share conditions. Descriptive interval, not proof of future independence.
 const groups=new Map();evaluation.forEach((r,i)=>{const day=new Date(r.kickoff).toISOString().slice(0,10);if(!groups.has(day))groups.set(day,[]);groups.get(day).push((changed[i].p-r.y)**2-(r.p-r.y)**2);});
 const blocks=[...groups.values()],rng=seededRandom('probability-audit-block-bootstrap-v1'),deltas=[];
 for(let run=0;run<2000;run++){let sum=0,n=0;for(let i=0;i<blocks.length;i++)for(const d of blocks[Math.floor(rng()*blocks.length)]){sum+=d;n++;}deltas.push(sum/n);}
 deltas.sort((a,b)=>a-b);
 report.candidate={coefficients,training:metrics(training.map(r=>({...r,p:logistic(coefficients.intercept+coefficients.slope*logit(r.p))}))),evaluation:metrics(changed),brierDeltaInterval95:[deltas[49],deltas[1949]],dateBlocks:blocks.length};
 report.status='research-only';return report;
}
module.exports={audit,metrics,seededRandom};
