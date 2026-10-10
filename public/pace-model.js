/* Drive-based scoring candidate. Requires complete recorded league coverage. */
(function(root){
 'use strict';
 function project(pool,away,home,baseline,schedule){
  const skip=reason=>({available:false,reason});
  if(!pool.length||pool.some(t=>!t.games||t.pace?.games!==t.games||!Number.isFinite(t.pace.drives)||!Number.isFinite(t.pace.opponentDrives)||t.pace.drives<=0||t.pace.opponentDrives<=0))return skip('Pace adjustment waits for complete drive reports across the league.');
  const games=pool.reduce((s,t)=>s+t.games,0);
  const leagueDrives=pool.reduce((s,t)=>s+(t.pace.drives+t.pace.opponentDrives)/2,0)/games;
  if(!(leagueDrives>=3&&leagueDrives<=30))return skip('League drive counts need review.');
  const leagueRate=baseline/leagueDrives,pseudo=4*leagueDrives;
  const rate=(t,defense)=>{
   const key=defense?'pointsAgainst':'pointsFor',exposure=defense?t.pace.opponentDrives:t.pace.drives;
   const correction=schedule.applied?schedule[t.id]?.[defense?'defense':'offense']||0:0;
   return (t.metrics[key].average*t.games+leagueRate*pseudo)/(exposure+pseudo)+correction/leagueDrives*t.games/(t.games+4);
  };
  const drives=t=>((t.pace.drives+t.pace.opponentDrives)/2+pseudo)/(t.games+4);
  const expectedDrives=(drives(away)+drives(home))/2;
  return {available:true,leagueDrives,expectedDrives,
   away:Math.max(0,rate(away,false)+rate(home,true)-leagueRate)*expectedDrives,
   home:Math.max(0,rate(home,false)+rate(away,true)-leagueRate)*expectedDrives,
   reason:`Drive-based scoring: ${expectedDrives.toFixed(1)} expected drives per team; league baseline ${leagueDrives.toFixed(1)}. Four average-game equivalents soften pace and scoring-per-drive samples. Includes all recorded drives and total points; overtime and defensive scores are not separated.`};
 }
 const api={project};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.Unit501PaceModel=api;
})(typeof globalThis!=='undefined'?globalThis:this);
