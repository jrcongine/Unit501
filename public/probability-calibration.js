/* Symmetric probability calibration fitted only on earlier replay predictions. */
(function(root){
  'use strict';
  const logit=p=>Math.log(Math.max(.001,Math.min(.999,p))/(1-Math.max(.001,Math.min(.999,p))));
  const logistic=x=>1/(1+Math.exp(-x));
  function fit(rows) {
    const valid=rows.filter(r=>Number.isFinite(r.p)&&r.p>=0&&r.p<=1&&(r.y===0||r.y===1));
    const games=new Set(valid.map(r=>r.id)).size;
    const outcomes=new Map();
    for(const r of valid)if(!outcomes.has(r.id))outcomes.set(r.id,new Set());
    for(const r of valid)outcomes.get(r.id).add(r.y);
    if(games<100 || [...outcomes.values()].filter(s=>s.has(0)).length<20 || [...outcomes.values()].filter(s=>s.has(1)).length<20)return null;
    const counts=new Map();for(const r of valid)counts.set(r.id,(counts.get(r.id)||0)+1);
    // One game's several reference thresholds together carry one game's weight.
    // A neutral slope prior limits instability; no team-specific fitted offsets.
    let low=.25,high=2;
    for(let i=0;i<50;i++){
      const slope=(low+high)/2;
      let gradient=10*(slope-1);
      for(const r of valid){const x=logit(r.p);gradient+=(logistic(slope*x)-r.y)*x/counts.get(r.id);}
      if(gradient>0)high=slope;else low=slope;
    }
    return {method:'temperature-v1',slope:(low+high)/2,games};
  }
  function apply(p,fit) {
    if(!Number.isFinite(p)||p<0||p>1||fit?.method!=='temperature-v1'||fit.games<100||!Number.isFinite(fit.slope)||fit.slope<.25||fit.slope>2)return null;
    return logistic(fit.slope*logit(p));
  }
  const api={fit,apply};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.Unit501ProbabilityCalibration=api;
})(typeof globalThis!=='undefined'?globalThis:this);
