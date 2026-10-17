/* Bounded experimental weather scenarios, not fitted performance coefficients. */
(function(root){
 'use strict';
 function effect(game,forecast,market,enabled=true,now=Date.now()){
  const skip=reason=>({factor:1,applied:false,reason});
  if(!enabled)return skip('Weather adjustment switched off.');
  if(forecast?.roof==='indoor')return skip('Indoor venue: no outdoor weather adjustment.');
  if(forecast?.roof!=='outdoor')return skip('Venue or roof unverified: no weather adjustment.');
  if(!forecast.available||forecast.kickoff!==game?.kickoff||!Number.isFinite(game?.kickoff)||game.kickoff<=now||!Number.isFinite(forecast.fetchedAt)||forecast.fetchedAt>now||now-forecast.fetchedAt>900000||!Number.isFinite(forecast.forecastTime)||Math.abs(forecast.forecastTime-game.kickoff)>1800000)return skip('Current kickoff forecast unavailable: no weather adjustment.');
  const wind=Number.isFinite(forecast.windMph)&&forecast.windMph>=0&&forecast.windMph<=200?Math.min(.15,Math.max(0,forecast.windMph-15)*.01):0;
  const rain=Number.isFinite(forecast.precipitationMm)&&forecast.precipitationMm>=0?Math.min(.06,Math.max(0,forecast.precipitationMm-.5)*.012):0;
  const temp=Number.isFinite(forecast.temperatureF)&&forecast.temperatureF>=-100&&forecast.temperatureF<=150?Math.min(.04,Math.max(0,25-forecast.temperatureF)*.002+Math.max(0,forecast.temperatureF-95)*.002):0;
  // Do not infer increased rushing yardage from weather alone or change TD markets.
  const weights={passYds:[1,1,1],recYds:[1,1,1],attempts:[.35,.5,.5],completions:[.6,.7,.7],rec:[.35,.5,.5],carries:[-.2,-.25,.5],rushYds:[0,.25,1],score:[1,.5,.5]}[market];
  if(!weights)return skip('No weather coefficient for this market.');
  const delta=Math.max(-.04,Math.min(.20,wind*weights[0]+rain*weights[1]+temp*weights[2]));
  const missing=['windMph','precipitationMm','temperatureF'].filter(k=>!Number.isFinite(forecast[k]));
  const details=[wind?'wind':null,rain?'precipitation':null,temp?'temperature':null].filter(Boolean).join(', ');
  return {factor:1-delta,applied:delta!==0,experimental:true,inputs:{windMph:forecast.windMph,precipitationMm:forecast.precipitationMm,temperatureF:forecast.temperatureF},reason:(delta?`Weather ${delta>0?'−':'+'}${Math.abs(delta*100).toFixed(1)}% (${details}). Experimental; not backtested.`:'Weather: no material adjustment.')+(missing.length?' Some forecast inputs unavailable; missing effects omitted.':'')};
 }
 const api={effect};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.Unit501WeatherModel=api;
})(typeof globalThis!=='undefined'?globalThis:this);
