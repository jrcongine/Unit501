/* Read-only market diagnostics from already-validated, archived forecast rows. */
(function(root){
 'use strict';
 const markets=['passYds','passTD','carries','rushYds','rushTD','recYds','rec','recTD'];
 const mean=(rows,key)=>rows.length?rows.reduce((sum,row)=>sum+row[key],0)/rows.length:null;
 const keyOf=r=>JSON.stringify([String(r.league),String(r.season),String(r.modelVersion),r.market]);
 function summarize(accepted=[],pending=[]){
  const groups=new Map();
  function group(r){
   if(r?.kind!=='prop'||!markets.includes(r.market))return null;
   if(!['1','2'].includes(String(r.league))||!/^\d{4}$/.test(String(r.season))||typeof r.modelVersion!=='string'||!r.modelVersion.trim())return null;
   const key=keyOf(r);
   if(!groups.has(key))groups.set(key,{league:String(r.league),season:String(r.season),modelVersion:r.modelVersion,market:r.market,rows:[],pending:0});
   return groups.get(key);
  }
  for(const r of accepted){
   const g=group(r);
   if(g&&[r.actual,r.adjusted,r.baseline,r.kickoff].every(Number.isFinite))g.rows.push(r);
  }
  for(const r of pending){const g=group(r);if(g)g.pending++;}
  return [...groups.values()].map(g=>{
   const byGame=new Map();
   for(const r of g.rows){
    const id=String(r.gameId);
    if(!byGame.has(id))byGame.set(id,[]);
    byGame.get(id).push(r);
   }
   // Each game receives one vote regardless of the number of tracked players.
   const games=[...byGame.entries()].map(([id,rs])=>({
    id,kickoff:Math.max(...rs.map(r=>r.kickoff)),
    mae:rs.reduce((sum,r)=>sum+Math.abs(r.adjusted-r.actual),0)/rs.length,
    baselineMAE:rs.reduce((sum,r)=>sum+Math.abs(r.baseline-r.actual),0)/rs.length,
    bias:rs.reduce((sum,r)=>sum+r.adjusted-r.actual,0)/rs.length
   })).sort((a,b)=>b.kickoff-a.kickoff||b.id.localeCompare(a.id));
   const recent=games.slice(0,10),previous=games.slice(10,20);
   const overall=mean(games,'mae'),older=mean(previous,'mae'),newer=mean(recent,'mae');
   const difference=older===null||newer===null?null:newer-older;
   const threshold=older===null?null:Math.max(0.1,older*0.10);
   const trend=games.length<30||previous.length<10?'Not enough games to review':
    difference>threshold?'Recent error higher':
    difference< -threshold?'Recent error lower':'Recent error similar';
   return {
    league:g.league,season:g.season,modelVersion:g.modelVersion,market:g.market,
    games:games.length,targets:g.rows.length,pending:g.pending,
    mae:overall,baselineMAE:mean(games,'baselineMAE'),bias:mean(games,'bias'),
    recentMAE:newer,recentGames:recent.length,previousMAE:older,previousGames:previous.length,
    highGames:games.filter(r=>r.bias>1e-9).length,lowGames:games.filter(r=>r.bias< -1e-9).length,
    evenGames:games.filter(r=>Math.abs(r.bias)<=1e-9).length,trend
   };
  }).sort((a,b)=>a.league.localeCompare(b.league)||b.season.localeCompare(a.season)||
    markets.indexOf(a.market)-markets.indexOf(b.market)||a.modelVersion.localeCompare(b.modelVersion));
 }
 const api={summarize};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 else root.Unit501MarketReliability=api;
})(typeof globalThis!=='undefined'?globalThis:this);
