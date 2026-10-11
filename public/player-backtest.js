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
  const api={validate};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.Unit501PlayerBacktest=api;
})(typeof globalThis!=='undefined'?globalThis:this);
