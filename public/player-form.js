/* Recorded performance, not a player talent grade or calibrated forecast. */
(function(root){
  'use strict';
  function summarize(history,key) {
    const games=history.filter(g=>Number.isFinite(g.gameDate)).sort((a,b)=>b.gameDate-a.gameDate);
    const gameDetails=games.filter(g=>Number.isFinite(g[key]) && g[key]>=0);
    const values=gameDetails.map(g=>g[key]);
    if(values.length<2)return null;
    const average=values.reduce((a,b)=>a+b,0)/values.length;
    let sum=0,weight=0;
    // Age by recorded team game, so missing statistics do not erase elapsed games.
    games.forEach((g,i)=>{if(Number.isFinite(g[key]) && g[key]>=0){const w=2**(-i/3);sum+=g[key]*w;weight+=w;}});
    const recentWeighted=sum/weight;
    const weighted=(average+recentWeighted)/2;
    const recent=values.slice(0,3),earlier=values.slice(3);
    const mean=a=>a.reduce((s,v)=>s+v,0)/a.length;
    const trend=earlier.length<2?'Insufficient history for a trend':mean(recent)>mean(earlier)?'Trending up':mean(recent)<mean(earlier)?'Trending down':'Holding steady';
    return {values,gameDetails,average,recentWeighted,weighted,trend,
      sample:values.length<5?'Limited sample':values.length<9?'Developing sample':'Larger sample'};
  }
  function workloadWarning(history,key) {
    const metric=key.startsWith('pass')?'attempts':key.startsWith('rush')?'carries':'targets';
    const label={attempts:'pass attempts',carries:'carries',targets:'targets'}[metric];
    const values=history.filter(g=>Number.isFinite(g.gameDate)).sort((a,b)=>b.gameDate-a.gameDate)
      .map(g=>g[metric]).filter(v=>Number.isFinite(v)&&v>=0);
    if(values.length<2)return `Workload unverified: fewer than two games with recorded ${label}. Confirm the expected role; this projection does not establish starting status.`;
    const mean=a=>a.reduce((s,v)=>s+v,0)/a.length;
    const recent=mean(values.slice(0,2)),older=values.slice(2);
    if(older.length>=2 && (recent>=2*Math.max(mean(older),1)||recent<=mean(older)/2))
      return `Workload change: latest two games average ${recent.toFixed(1)} ${label}, versus ${mean(older).toFixed(1)} earlier. Verify the current role before using the season/form estimate.`;
    const threshold={attempts:10,carries:5,targets:3}[metric];
    if(mean(values)<threshold)return `Limited recorded workload: ${mean(values).toFixed(1)} ${label} per appearance. A new starting role or larger workload can make this baseline misleading; verify the role first.`;
    return null;
  }
  const api={summarize,workloadWarning};
  if(typeof module!=='undefined' && module.exports)module.exports=api;
  else root.Unit501PlayerForm=api;
})(typeof globalThis!=='undefined'?globalThis:this);
