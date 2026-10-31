/* Frozen pre-January-2025 fit, evaluated unchanged on the full 2025–26 season.
   See docs/nba-calibration-2026-10-31.md. Not a sportsbook price or profit model. */
(function(root){
 'use strict';
 const coefficients=Object.freeze({intercept:0.29273998511634036,slope:1.6006665404787768});
 function apply(game,projection,simulation){
  if(game?.stage!==2||projection?.available!==true||projection.version!=='nba-scoring-baseline-v1'||projection.scope!=='season'||
   !projection.injury||!Array.isArray(projection.injury.applied)||projection.injury.applied.length||simulation?.available!==true||
   !Array.isArray(simulation.sampleGames)||simulation.sampleGames.length!==2||simulation.sampleGames.some(n=>!Number.isInteger(n)||n<5)||
   ![simulation.homeWin,simulation.awayWin,simulation.tie].every(n=>Number.isFinite(n)&&n>=0&&n<=1)||Math.abs(simulation.homeWin+simulation.awayWin+simulation.tie-1)>1e-8)return null;
  const decided=simulation.homeWin+simulation.awayWin;if(decided<=0)return null;
  const p=Math.max(1e-6,Math.min(1-1e-6,simulation.homeWin/decided)),z=coefficients.intercept+coefficients.slope*Math.log(p/(1-p));
  const home=z>=0?1/(1+Math.exp(-z)):Math.exp(z)/(1+Math.exp(z));
  return {home,away:1-home,version:'nba-season-win-calibration-2026-10-31',evaluationGames:1151};
 }
 function percent(p){return p<.001?'<0.1%':p>.999?'>99.9%':(p*100).toFixed(1)+'%';}
 const api={apply,percent,coefficients};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.Unit501NBAWinCalibration=api;
})(typeof window!=='undefined'?window:globalThis);
