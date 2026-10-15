/* Read-only score diagnostics and chronological candidate evaluation. */
(function(root){
 'use strict';
 const mean=xs=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:null;
 function summarize(rows){
  const favorites=rows.filter(r=>r.projectedHome!==r.projectedAway);
  return {games:rows.length,
   totalMAE:mean(rows.map(r=>Math.abs(r.projectedHome+r.projectedAway-r.actualHome-r.actualAway))),
   totalBias:mean(rows.map(r=>r.projectedHome+r.projectedAway-r.actualHome-r.actualAway)),
   marginMAE:mean(rows.map(r=>Math.abs((r.projectedHome-r.projectedAway)-(r.actualHome-r.actualAway)))),
   favoriteGames:favorites.length,
   favoriteMarginBias:mean(favorites.map(r=>Math.abs(r.projectedHome-r.projectedAway)-Math.sign(r.projectedHome-r.projectedAway)*(r.actualHome-r.actualAway)))};
 }
 function audit(input){
  const counts=new Map();for(const r of input)counts.set(String(r.id),(counts.get(String(r.id))||0)+1);
  const rows=input.filter(r=>counts.get(String(r.id))===1&&['kickoff','knownAt','projectedAway','projectedHome','actualAway','actualHome'].every(k=>Number.isFinite(r[k]))&&r.knownAt>r.kickoff).sort((a,b)=>a.kickoff-b.kickoff);
  const baseline=[],candidate=[],checks=[];
  for(const r of rows){
   // Never train on results that were not known before this forecast.
   const cutoff=Number.isFinite(r.forecastAt)?Math.min(r.forecastAt,r.kickoff):r.kickoff;
   const prior=rows.filter(p=>p.kickoff<r.kickoff-86400000&&p.knownAt<cutoff);
   if(prior.length<30)continue;
   const correction=Math.max(-6,Math.min(6,summarize(prior).totalBias));
   const total=Math.max(0,r.projectedHome+r.projectedAway-correction);
   const margin=Math.max(-total,Math.min(total,(r.projectedHome-r.projectedAway)*.85));
   const adjusted={...r,projectedHome:(total+margin)/2,projectedAway:(total-margin)/2};
   baseline.push(r);candidate.push(adjusted);
   checks.push({id:r.id,kickoff:r.kickoff,trainingGames:prior.length,totalCorrection:correction,projectedAway:adjusted.projectedAway,projectedHome:adjusted.projectedHome});
  }
  const current=summarize(baseline),proposed=summarize(candidate);
  return {overall:summarize(rows),recent:summarize(rows.slice(-10)),
   marginBands:[[0,7],[7,14],[14,Infinity]].map(([min,max])=>({label:max===Infinity?'14+':`${min}–<${max}`, ...summarize(rows.filter(r=>Math.abs(r.projectedHome-r.projectedAway)>=min&&Math.abs(r.projectedHome-r.projectedAway)<max))})),
   candidate:{current,proposed,checks,status:baseline.length<30?'insufficient':proposed.totalMAE<current.totalMAE&&proposed.marginMAE<current.marginMAE?'review-candidate':'retain-current'},
   explanation:'Positive total bias means totals ran high. Positive favorite-margin bias means the predicted favorite won by less than projected (including upset losses); negative means margins were too small. Pick’em forecasts are excluded from favorite bias. Candidate: subtract earlier mean total bias (capped at 6 points) and shrink margins 15%. Training requires 30 earlier games, a 24-hour kickoff gap and results known before the forecast. Compare on the same later games; at least 30 later games are required for review. This experimental candidate never changes live predictions. No historical sportsbook lines or profit claim.'};
 }
 const api={audit,summarize};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.Unit501ScoreAudit=api;
})(typeof globalThis!=='undefined'?globalThis:this);
