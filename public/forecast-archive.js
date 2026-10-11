/* Device-local pregame score forecasts; no postgame reconstruction. */
(function(root){
 'use strict';
 const model=typeof module!=='undefined'&&module.exports?require('./team-model'):root.Unit501TeamModel;
 const key='unit501-score-archive-v1';
 function capture(inputs,now=Date.now()){
  const {game,data,options}=inputs;
  if(!['1','2'].includes(String(game?.league))||!/^\d{4}$/.test(String(game?.season))||![game?.id,game?.awayId,game?.homeId].every(id=>/^\d+$/.test(String(id)))||String(game.awayId)===String(game.homeId))return null;
  if(!Number.isFinite(now)||!Number.isFinite(game?.kickoff)||game.kickoff<=now||game.kickoff>now+7*86400000)return null;
  const shared={...options,now};
  const adjusted=model.project(data,game,shared);
  const baseline=model.project(data,game,{...shared,injury:{awayOffense:0,awayDefense:0,homeOffense:0,homeDefense:0},lineup:null});
  if(!adjusted.available||!baseline.available||(!adjusted.injury.applied&&!adjusted.lineup.awayChange&&!adjusted.lineup.homeChange))return null;
  // JSON copy freezes the inputs; later refreshes cannot edit archived reports.
  return JSON.parse(JSON.stringify({schema:1,forecastAt:now,game,inputs:{...inputs,options:shared},baseline,adjusted,
   records:[['away',game.awayId],['home',game.homeId]].map(([side,teamId])=>({
    league:String(game.league),season:String(game.season),gameId:String(game.id),teamId:String(teamId),kind:'score',market:'points',
    modelVersion:baseline.modelVersion+'-lineup-v1-archive-v1',forecastAt:now,inputAsOf:now,kickoff:game.kickoff,
    evidenceUrl:'https://unit501-production-0bd5.up.railway.app/',evidenceType:'forecast-application-with-captured-inputs',
    baseline:baseline[side],adjusted:adjusted[side],actual:null,resultKnownAt:null
   }))}));
 }
 function read(storage){
  const raw=storage.getItem(key);
  if(!raw)return {schema:1,snapshots:[]};
  const archive=JSON.parse(raw);
  if(archive.schema!==1||!Array.isArray(archive.snapshots))throw Error('Saved archive could not be read. Existing data retained.');
  return archive;
 }
 function save(storage,snapshot){
  try{
   if(!snapshot)return {saved:false,message:'Archive waits for an upcoming game with an applied injury or lineup score scenario.'};
   const archive=read(storage);
   const identity=s=>JSON.stringify([s.game.league,s.game.season,s.game.id,s.kind||'score',...(s.kind==='prop'?[s.records[0].teamId,s.records[0].playerId,s.records[0].market]:[])].map(String));
   // A fixed first-forecast policy prevents choosing a revision after the result.
   if(archive.snapshots.some(s=>identity(s)===identity(snapshot)))return {saved:false,message:'First adjusted forecast for this target is already saved on this browser. Later revisions do not replace it.'};
   archive.snapshots.push(snapshot);
   storage.setItem(key,JSON.stringify(archive));
   return {saved:true,message:'First adjusted forecast saved on this browser before kickoff. Download the archive to keep a backup.'};
  }catch{return {saved:false,message:'Forecast archive could not be saved on this browser. Existing data retained; this prediction is not archived.'};}
 }
 function captureProp({game,teamId,playerId,market,baseline,adjusted,inputs},now=Date.now()){
  if(!['1','2'].includes(String(game?.league))||!/^\d{4}$/.test(String(game?.season))||
     ![game?.id,teamId,playerId].every(id=>/^\d+$/.test(String(id)))||![game?.awayId,game?.homeId].map(String).includes(String(teamId))||
     !Number.isFinite(now)||!Number.isFinite(game?.kickoff)||game.kickoff<=now||game.kickoff>now+7*86400000||
     !['passYds','passTD','carries','rushYds','rushTD','recYds','rec','recTD'].includes(market)||
     ![baseline,adjusted].every(Number.isFinite)||(!market.endsWith('Yds')&&[baseline,adjusted].some(v=>v<0)))return null;
  return JSON.parse(JSON.stringify({schema:1,kind:'prop',forecastAt:now,game,inputs,records:[{
   league:String(game.league),season:String(game.season),gameId:String(game.id),teamId:String(teamId),playerId:String(playerId),kind:'prop',market,
   modelVersion:'player-form-v1-lineup-v1-archive-v1',forecastAt:now,inputAsOf:now,kickoff:game.kickoff,
   evidenceUrl:'https://unit501-production-0bd5.up.railway.app/',evidenceType:'forecast-application-with-captured-inputs',
   baseline,adjusted,actual:null,resultKnownAt:null
  }]}));
 }
 const api={capture,captureProp,read,save,key};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.Unit501ForecastArchive=api;
})(typeof globalThis!=='undefined'?globalThis:this);
