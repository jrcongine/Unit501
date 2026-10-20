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
  const baseline=model.project(data,game,{...shared,injury:{awayOffense:0,awayDefense:0,homeOffense:0,homeDefense:0},lineup:null,quarterback:null,primeTimeEnabled:false,sundayUpsetEnabled:false});
  if(!adjusted.available||!baseline.available)return null;
  // JSON copy freezes the inputs; later refreshes cannot edit archived reports.
  return JSON.parse(JSON.stringify({schema:1,forecastAt:now,game,inputs:{...inputs,options:shared},baseline,adjusted,
   records:[['away',game.awayId],['home',game.homeId]].map(([side,teamId])=>({
    league:String(game.league),season:String(game.season),gameId:String(game.id),teamId:String(teamId),kind:'score',market:'points',
    modelVersion:adjusted.modelVersion+'-lineup-v2-archive-v1',forecastAt:now,inputAsOf:now,kickoff:game.kickoff,
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
   if(!snapshot)return {saved:false,message:'Archive waits for an eligible pregame forecast within seven days.'};
   const archive=read(storage);
   // A fixed first-forecast policy prevents choosing a revision after the result.
   if(archive.snapshots.some(s=>identity(s)===identity(snapshot)))return {saved:false,message:'First forecast or selected pick for this target is already saved on this browser. Later revisions do not replace it.'};
   archive.snapshots.push(snapshot);
   storage.setItem(key,JSON.stringify(archive));
  if(root.document&&typeof root.Event==='function')root.document.dispatchEvent(new root.Event('unit501:archive-updated'));
   return {saved:true,message:(snapshot.selection?'Selected pick':'First forecast')+' saved on this browser before kickoff. Download the archive to keep a backup.'};
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
   modelVersion:'player-form-v2-lineup-v2-archive-v1'+(inputs?.spotlight?.applied?'-spotlight-v1':''),forecastAt:now,inputAsOf:now,kickoff:game.kickoff,
   evidenceUrl:'https://unit501-production-0bd5.up.railway.app/',evidenceType:'forecast-application-with-captured-inputs',
   baseline,adjusted,actual:null,resultKnownAt:null
  }]}));
 }

 const identity=s=>JSON.stringify([s.game.league,s.game.season,s.game.id,s.kind||'score',...(s.kind==='prop'?[s.records[0].teamId,s.records[0].playerId,s.records[0].market]:[]),s.selection?'selected:'+s.selection.market:'forecast'].map(String));
 function validSelection(s,now){
  const p=s.selection;
  return p&&Number.isFinite(p.selectedAt)&&p.selectedAt>=s.forecastAt&&p.selectedAt<s.game.kickoff&&p.selectedAt<=now&&
   Number.isFinite(p.line)&&Number.isInteger(p.line*2)&&
   (p.price===null||(Number.isInteger(p.price)&&Math.abs(p.price)>=100))&&
   (s.kind==='prop'?p.market===s.records[0].market&&['over','under'].includes(p.direction)&&
    (p.market.endsWith('Yds')||p.line>=0):
    (p.market==='spread'&&['away','home'].includes(p.direction))||(p.market==='total'&&p.line>0&&['over','under'].includes(p.direction)));
 }
 function select(storage,snapshot,selection,now=Date.now()){
  if(!snapshot)return {saved:false,message:'Run an eligible pregame forecast first.'};
  const s=JSON.parse(JSON.stringify(snapshot));s.selection={...selection,selectedAt:now};
  if(!validSelection(s,now))return {saved:false,message:'Check the pick direction, line and American price (blank is unknown). Picks must be saved before kickoff.'};
  return save(storage,s);
 }
 function selectionResult(s){
  if(!s.selection)return null;
  const p=s.selection;
  if(s.records.some(r=>!Number.isFinite(r.actual)))return 'Pending statistic';
  let difference;
  if(s.kind==='prop')difference=s.records[0].actual-p.line;
  else{
   const away=s.records.find(r=>String(r.teamId)===String(s.game.awayId))?.actual;
   const home=s.records.find(r=>String(r.teamId)===String(s.game.homeId))?.actual;
   if(!Number.isFinite(away)||!Number.isFinite(home))return 'Pending statistic';
   difference=p.market==='spread'?away-home+p.line:away+home-p.line;
  }
  if(difference===0)return 'Push by statistic';
  const wins=['over','away'].includes(p.direction)?difference>0:difference<0;
  return wins?'Win by statistic':'Loss by statistic';
 }
 function importArchive(storage,text,now=Date.now()){
  if(!Number.isFinite(now)||now<=0)throw Error('Current time unavailable.');
  if(typeof text!=='string'||text.length>20*1024*1024)throw Error('Choose an archive smaller than 20 MB.');
  const incoming=JSON.parse(text);
  if(incoming?.schema!==1||!Array.isArray(incoming.snapshots))throw Error('Unsupported forecast archive.');
  const seen=new Set();
  for(const s of incoming.snapshots){
   const g=s?.game,kind=s?.kind||'score';
   if(s?.schema!==1||!['score','prop'].includes(kind)||!g||!['1','2'].includes(String(g.league))||!/^\d{4}$/.test(String(g.season))||
      ![g.id,g.awayId,g.homeId].every(id=>/^\d+$/.test(String(id)))||String(g.awayId)===String(g.homeId)||
      !Number.isFinite(g.kickoff)||g.kickoff<=0||!Number.isFinite(s.forecastAt)||s.forecastAt<=0||s.forecastAt>now||s.forecastAt>=g.kickoff||
      !s.inputs||typeof s.inputs!=='object'||Array.isArray(s.inputs)||!Array.isArray(s.records)||s.records.length!==(kind==='score'?2:1))throw Error('Archive contains an invalid forecast. Existing data retained.');
   const targets=new Set();
   for(const r of s.records){
    const pending=r?.actual===null&&r?.resultKnownAt===null;
    if(!r||r.kind!==kind||String(r.gameId)!==String(g.id)||String(r.league)!==String(g.league)||String(r.season)!==String(g.season)||r.kickoff!==g.kickoff||
       r.forecastAt!==s.forecastAt||!Number.isFinite(r.inputAsOf)||r.inputAsOf<=0||r.inputAsOf>r.forecastAt||
       ![g.awayId,g.homeId].map(String).includes(String(r.teamId))||![r.baseline,r.adjusted].every(Number.isFinite)||
       typeof r.modelVersion!=='string'||!r.modelVersion.trim()||typeof r.evidenceUrl!=='string'||!/^https:\/\/[^\s]+$/.test(r.evidenceUrl)||
       (kind==='score'&&r.market!=='points')||(kind==='prop'&&(!/^\d+$/.test(String(r.playerId))||!['passYds','passTD','carries','rushYds','rushTD','recYds','rec','recTD'].includes(r.market)))||
       (!pending&&(!Number.isFinite(r.actual)||!Number.isFinite(r.resultKnownAt)||r.resultKnownAt<=g.kickoff||r.resultKnownAt>now))||
       (!String(r.market).endsWith('Yds')&&[r.baseline,r.adjusted,...(pending?[]:[r.actual])].some(v=>v<0)))throw Error('Archive contains an invalid target. Existing data retained.');
    if(kind==='score'){const side=String(r.teamId)===String(g.awayId)?'away':'home';if(s.baseline?.[side]!==r.baseline||s.adjusted?.[side]!==r.adjusted)throw Error('Archive score values conflict with its saved forecast.');}
    const target=JSON.stringify([String(r.teamId),r.playerId==null?null:String(r.playerId),r.market]);
    if(targets.has(target))throw Error('Archive contains duplicate targets. Existing data retained.');targets.add(target);
   }
   if(kind==='score'&&new Set(s.records.map(r=>String(r.teamId))).size!==2)throw Error('Archive score teams do not match.');
   if(s.selection&&!validSelection(s,now))throw Error('Archive contains an invalid selected pick.');
   const id=identity(s);if(seen.has(id))throw Error('Archive repeats a forecast target. Existing data retained.');seen.add(id);
  }
  const existing=read(storage),known=new Set(existing.snapshots.map(identity));let imported=0,skipped=0;
  for(const s of incoming.snapshots){if(known.has(identity(s))){skipped++;continue;}existing.snapshots.push(s);known.add(identity(s));imported++;}
  // One write after full validation: no partial imports or replacement of old forecasts.
  if(imported){storage.setItem(key,JSON.stringify(existing));if(root.document&&typeof root.Event==='function')root.document.dispatchEvent(new root.Event('unit501:archive-updated'));}
  return {imported,skipped};
 }

 const api={capture,captureProp,read,save,select,selectionResult,importArchive,key};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.Unit501ForecastArchive=api;
})(typeof globalThis!=='undefined'?globalThis:this);
