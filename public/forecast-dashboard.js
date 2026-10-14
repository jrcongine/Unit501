/* Scope complete snapshots without changing archived forecasts or results. */
(function(root){
 'use strict';
 function dateKey(timestamp){
  if(!Number.isFinite(timestamp))return '';
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(timestamp).map(p=>[p.type,p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
 }
 function filter(snapshots,filters={}){
  return snapshots.filter(snapshot=>{
   const records=snapshot.records||[];
   if(filters.from||filters.to){
    const date=dateKey(snapshot.game?.kickoff);
    if(!date||(filters.from&&date<filters.from)||(filters.to&&date>filters.to))return false;
   }
   return records.length>0&&records.every(record=>
    ['league','season','modelVersion'].every(key=>
     !filters[key]||String(record[key])===String(filters[key])));
  });
 }
 function diagnosis(metric){
  if(!metric.games||!Number.isFinite(metric.adjustedBias))return 'Awaiting final outcomes';
  const direction=Math.abs(metric.adjustedBias)<0.005?'No net bias':metric.adjustedBias>0?'Running high':'Running low';
  return `${direction}${direction==='No net bias'?'':` by ${Math.abs(metric.adjustedBias).toFixed(2)} on average`} · ${metric.games<30?'small sample; insufficient evidence':'observed sample only'}`;
 }
 function report(snapshots,filters,audit,generatedAt=Date.now()){
  return {schema:1,generatedAt:new Date(generatedAt).toISOString(),timezone:'America/Chicago',filters:{...filters},
   snapshots:snapshots.length,forecastSnapshots:snapshots.filter(s=>!s.selection).length,selectedPickSnapshots:snapshots.filter(s=>s.selection).length,
   accuracy:audit,note:'Forecast accuracy excludes selected picks. Dates refer to game kickoff in America/Chicago. Browser-local history only; not reconstructed season history. Descriptive errors are not betting profit or proof of future accuracy.'};
 }
 const api={filter,dateKey,diagnosis,report};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 else root.Unit501ForecastDashboard=api;
})(typeof globalThis!=='undefined'?globalThis:this);
