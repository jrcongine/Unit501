/* Scope complete snapshots without changing archived forecasts or results. */
(function(root){
 'use strict';
 function filter(snapshots,filters={}){
  return snapshots.filter(snapshot=>{
   const records=snapshot.records||[];
   return records.length>0&&records.every(record=>
    ['league','season','modelVersion'].every(key=>
     !filters[key]||String(record[key])===String(filters[key])));
  });
 }
 const api={filter};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 else root.Unit501ForecastDashboard=api;
})(typeof globalThis!=='undefined'?globalThis:this);
