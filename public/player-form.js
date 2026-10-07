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
  const api={summarize};
  if(typeof module!=='undefined' && module.exports)module.exports=api;
  else root.Unit501PlayerForm=api;
})(typeof globalThis!=='undefined'?globalThis:this);
