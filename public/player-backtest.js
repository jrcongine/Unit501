/* Historical recorded-stat baseline checks; no archived odds or role inputs. */
(function(root){
  'use strict';
  const form=typeof module!=='undefined'&&module.exports?require('./player-form'):root.Unit501PlayerForm;
  function validate(history,key){
    const games=history.filter(g=>Number.isFinite(g.gameDate)).sort((a,b)=>a.gameDate-b.gameDate);
    const counts=new Map();games.forEach(g=>counts.set(g.gameDate,(counts.get(g.gameDate)||0)+1));
    const records=[];let missingActual=0,insufficient=0,withheld=0,ambiguous=0;
    const valid=g=>Number.isFinite(g[key])&&(key.endsWith('Yds')||g[key]>=0);
    for(const target of games){
      if(counts.get(target.gameDate)>1){ambiguous++;continue;}
      if(!valid(target)){missingActual++;continue;}
      // Dates are kickoff seconds. A full day buffer avoids overlapping-game results.
      const cutoff=target.gameDate-86400;
      const prior=games.filter(g=>g.gameDate<cutoff&&counts.get(g.gameDate)===1);
      const prediction=form.project(prior,key);
      if(!prediction){insufficient++;continue;}
      if(prediction.withheld||!Number.isFinite(prediction.baseline)){withheld++;continue;}
      records.push({gameDate:target.gameDate,historyBefore:cutoff,actual:target[key],prediction:prediction.baseline,meanPrediction:prediction.average,priorRecorded:prediction.coverage.recorded});
    }
    const n=records.length;
    const avg=fn=>n?records.reduce((sum,r)=>sum+fn(r),0)/n:null;
    return {records,count:n,missingActual,insufficient,withheld,ambiguous,
      mae:avg(r=>Math.abs(r.prediction-r.actual)),bias:avg(r=>r.prediction-r.actual),
      meanMAE:avg(r=>Math.abs(r.meanPrediction-r.actual))};
  }
  function range(history,key,before){
    if(!Number.isFinite(before))return {available:false,reason:'Target kickoff is unknown.'};
    const prior=history.filter(g=>Number.isFinite(g.gameDate)&&g.gameDate<before-86400);
    const dates=new Map();prior.forEach(g=>dates.set(g.gameDate,(dates.get(g.gameDate)||0)+1));
    const unique=prior.filter(g=>dates.get(g.gameDate)===1);
    const forecast=form.project(unique,key),audit=validate(prior,key);
    if(!forecast||forecast.withheld||!Number.isFinite(forecast.baseline))return {available:false,count:audit.count,reason:'Recent recorded coverage cannot support a baseline range.'};
    if(audit.count<10)return {available:false,count:audit.count,reason:'Need at least 10 earlier replay errors for a historical-error range.'};
    const errors=audit.records.map(r=>r.actual-r.prediction).sort((a,b)=>a-b);
    const quantile=p=>{const index=(errors.length-1)*p,low=Math.floor(index),high=Math.ceil(index);return errors[low]+(errors[high]-errors[low])*(index-low);};
    const bound=v=>key.endsWith('Yds')?v:Math.max(0,v);
    return {available:true,count:audit.count,baseline:forecast.baseline,
      low:bound(forecast.baseline+quantile(.1)),high:bound(forecast.baseline+quantile(.9))};
  }
  const api={validate,range};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.Unit501PlayerBacktest=api;
})(typeof globalThis!=='undefined'?globalThis:this);
