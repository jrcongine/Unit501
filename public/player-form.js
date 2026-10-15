/* Recorded performance, not a player talent grade or calibrated forecast. */
(function(root){
  'use strict';
  function summarize(history,key) {
    const games=history.filter(g=>Number.isFinite(g.gameDate)).sort((a,b)=>b.gameDate-a.gameDate);
    const valid=g=>Number.isFinite(g[key]) && (key.endsWith('Yds') || g[key]>=0);
    const gameDetails=games.filter(valid);
    const values=gameDetails.map(g=>g[key]);
    if(values.length<2)return null;
    const average=values.reduce((a,b)=>a+b,0)/values.length;
    let sum=0,weight=0;
    // Age by recorded team game, so missing statistics do not erase elapsed games.
    games.forEach((g,i)=>{if(valid(g)){const w=2**(-i/3);sum+=g[key]*w;weight+=w;}});
    const recentWeighted=sum/weight;
    const weighted=(average+recentWeighted)/2;
    const recent=values.slice(0,3),earlier=values.slice(3);
    const mean=a=>a.reduce((s,v)=>s+v,0)/a.length;
    const trend=earlier.length<2?'Insufficient history for a trend':mean(recent)>mean(earlier)?'Trending up':mean(recent)<mean(earlier)?'Trending down':'Holding steady';
    const latestConsecutiveMissing=games.findIndex(valid);
    return {values,gameDetails,average,recentWeighted,weighted,trend,
      coverage:{recorded:values.length,total:games.length,missing:games.length-values.length,latestMissing:!valid(games[0]),latestConsecutiveMissing},
      sample:values.length<5?'Limited sample':values.length<9?'Developing sample':'Larger sample'};
  }
  function workloadSummary(history,key) {
    const metric=key.startsWith('pass')?'attempts':key.startsWith('rush')||key==='carries'?'carries':'targets';
    const label={attempts:'Pass attempts',carries:'Carries',targets:'Targets'}[metric];
    const games=history.filter(g=>Number.isFinite(g.gameDate)).sort((a,b)=>b.gameDate-a.gameDate);
    const values=games.map(g=>Number.isFinite(g[metric])&&g[metric]>=0?g[metric]:null);
    const recorded=values.filter(v=>v!==null);
    const recent=values.slice(0,3);
    const average=recorded.length?recorded.reduce((a,b)=>a+b,0)/recorded.length:null;
    const missing=values.length-recorded.length;
    const text=values.length
      ? `${label}: ${recent.map(v=>v===null?'missing':v).join(', ')} (latest ${recent.length} team games, newest first); ${average===null?'no recorded average':average.toFixed(1)+' average'} (${recorded.length}/${values.length} games recorded)`
      : `${label}: no dated team games available`;
    return {metric,label,recent,average,recorded:recorded.length,total:values.length,missing,text};
  }
  function workloadWarning(history,key) {
    const metric=key.startsWith('pass')?'attempts':key.startsWith('rush')||key==='carries'?'carries':'targets';
    const label={attempts:'pass attempts',carries:'carries',targets:'targets'}[metric];
    const games=history.filter(g=>Number.isFinite(g.gameDate)).sort((a,b)=>b.gameDate-a.gameDate);
    if(games.length && (!Number.isFinite(games[0][metric]) || games[0][metric]<0))
      return `Workload unverified: latest completed team game has no recorded ${label}. Older appearances do not confirm the current role; missing statistics are not zeros.`;
    const values=games.map(g=>g[metric]).filter(v=>Number.isFinite(v)&&v>=0);
    if(values.length<2)return `Workload unverified: fewer than two games with recorded ${label}. Confirm the expected role; this projection does not establish starting status.`;
    const mean=a=>a.reduce((s,v)=>s+v,0)/a.length;
    const recent=mean(values.slice(0,2)),older=values.slice(2);
    if(older.length>=2 && (recent>=2*Math.max(mean(older),1)||recent<=mean(older)/2))
      return `Workload change: latest two games average ${recent.toFixed(1)} ${label}, versus ${mean(older).toFixed(1)} earlier. Verify the current role before using the season/form estimate.`;
    const threshold={attempts:10,carries:5,targets:3}[metric];
    if(mean(values)<threshold)return `Limited recorded workload: ${mean(values).toFixed(1)} ${label} per appearance. A new starting role or larger workload can make this baseline misleading; verify the role first.`;
    return null;
  }
  function efficiencySummary(pairs,key,usageKey) {
    const median=a=>{const v=[...a].sort((a,b)=>a-b),m=Math.floor(v.length/2);return v.length%2?v[m]:(v[m-1]+v[m])/2;};
    const rates=pairs.map(g=>g[key]/g[usageKey]);
    const typical=median(rates);
    // Four paired games are required before damping high efficiency outliers.
    // Keep actual statistics and negative yardage intact; change only the estimate.
    const mad=median(rates.map(v=>Math.abs(v-typical)));
    const cap=pairs.length>=4?typical+Math.max(3*1.4826*mad,Math.abs(typical)*.5,1):Infinity;
    const totalUsage=pairs.reduce((n,g)=>n+g[usageKey],0);
    const pooled=pairs.reduce((n,g,i)=>n+Math.min(rates[i],cap)*g[usageKey],0)/totalUsage;
    return {efficiency:(pooled+typical)/2,dampened:rates.filter(v=>v>cap).length,cap:Number.isFinite(cap)?cap:null};
  }
  function project(history,key) {
    const form=summarize(history,key);
    if(!form)return null;
    if(form.coverage.latestConsecutiveMissing>=2 || (form.coverage.latestMissing && form.coverage.recorded*2<form.coverage.total))
      return {...form,withheld:true,reason:`Only ${form.coverage.recorded} of ${form.coverage.total} completed team games have this stat, and the latest game is missing it. Projection withheld until current usage can be verified; missing records are not zeros.`};
    const usageKey={rushYds:'carries',recYds:'rec',passYds:'attempts'}[key];
    const pairs=usageKey?history.filter(g=>Number.isFinite(g.gameDate)&&Number.isFinite(g[key])&&Number.isFinite(g[usageKey])&&g[usageKey]>0):[];
    let baseline=form.weighted,usage=null,usageUnavailable=null;
    if(pairs.length>=2) {
      const touches=summarize(history,usageKey);
      if(touches.coverage.latestMissing){
        usageUnavailable='Latest workload statistic is missing. Yardage uses recorded yardage form instead of an older workload estimate; verify current usage.';
        return {...form,baseline,usage,usageUnavailable};
      }
      const estimate=efficiencySummary(pairs,key,usageKey);
      baseline=touches.weighted*estimate.efficiency;
      usage={key:usageKey,workload:touches.weighted,efficiency:estimate.efficiency,games:pairs.length,
        dampened:estimate.dampened,efficiencyCap:estimate.cap};
    }
    return {...form,baseline,usage,usageUnavailable};
  }
  function reviewChecks(model,entry,availability,now=Date.now()) {
    const reasons=[];
    reasons.push(availability?.state==='conditional' ? 'Conditional availability: verify participation' : 'Verify participation');
    if(model.values.length<5) reasons.push('Fewer than 5 recorded games');
    if(model.form.coverage.missing>0) reasons.push('Missing game statistics');
    if(model.workloadWarning || model.form.usageUnavailable || model.workloadHistory?.missing>0) reasons.push('Verify current workload');
    if(model.workload!==100 || model.lineupChange) reasons.push('Scenario-adjusted projection');
    if(!Number.isFinite(entry.savedAt) || entry.savedAt>now || now-entry.savedAt>1800000) reasons.push('Refresh line');
    return reasons;
  }
  const api={efficiencySummary,summarize,workloadSummary,workloadWarning,project,reviewChecks};
  if(typeof module!=='undefined' && module.exports)module.exports=api;
  else root.Unit501PlayerForm=api;
})(typeof globalThis!=='undefined'?globalThis:this);
