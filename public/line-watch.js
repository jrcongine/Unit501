/* Device-local first-observed FanDuel line movement; never claims bookmaker opening prices. */
(function(root){
 'use strict';
 const session=new Map();
 const prefix='unit501:observed-fanduel:v1:';
 function observe(storage,scope,line,sourceAt,now=Date.now()){
  if(typeof scope!=='string'||!scope||scope.length>250||!Number.isFinite(now)||
     !Number.isFinite(line)||!Number.isInteger(line*2)||!Number.isFinite(sourceAt)||
     sourceAt>now+60000||now-sourceAt>1800000)return null;
  const key=prefix+scope;
  let first=null,persisted=true;
  try{
   const saved=storage.getItem(key);
   first=saved?JSON.parse(saved):null;
   if(first && (!Number.isFinite(first.firstLine)||!Number.isFinite(first.firstAt)||first.firstAt>now||
     !Number.isFinite(first.lastAt)||first.lastAt>now||!Number.isFinite(first.lastLine)))first=null;
  }catch{persisted=false;}
  // Storage can be blocked/full or contain an older damaged entry. A verified
  // current quote still starts history, with session-only persistence disclosed.
  if(!first)first=session.get(key)||null;
  const entry=first||{firstLine:line,firstAt:sourceAt,lastLine:line,lastAt:sourceAt};
  const newer=sourceAt>entry.lastAt;
  if(newer){entry.lastAt=sourceAt;entry.lastLine=line;}
  if(!first||newer||!persisted){
   try{storage.setItem(key,JSON.stringify(entry));persisted=true;}catch{persisted=false;}
  }
  session.set(key,entry);
  if(session.size>2000)session.delete(session.keys().next().value);
  return {firstLine:entry.firstLine,firstAt:entry.firstAt,line:entry.lastLine,lastAt:entry.lastAt,
    delta:Math.round((entry.lastLine-entry.firstLine)*100)/100,changed:entry.lastLine!==entry.firstLine,persisted};
 }
 function observeBrowser(scope,line,sourceAt,now=Date.now()){
  let storage;try{storage=root.localStorage;}catch{}
  return observe(storage,scope,line,sourceAt,now);
 }
 function fromServer(history,line,sourceAt,now=Date.now()){
  if(!history||history.scope!=='server'||history.line!==line||history.lastAt!==sourceAt||
    ![history.firstLine,history.firstAt,history.lastAt,history.delta,history.observations,history.changes].every(Number.isFinite)||
    history.firstAt>history.lastAt||history.lastAt>now+60000||now-history.lastAt>1800000||
    history.firstAt<0||!Number.isInteger(history.observations)||!Number.isInteger(history.changes)||
    history.observations<1||history.changes<0||history.changes>=history.observations||
    history.changed!==(history.line!==history.firstLine)||
    Math.abs(history.delta-(history.line-history.firstLine))>0.001)return null;
  return history;
 }
 function describe(h){
  if(!h)return 'Line history unavailable';
  const label='First '+h.firstLine;
  if(h.changed)return label+' → '+h.line+' ('+(h.delta>0?'+':'')+h.delta+')';
  if(h.changes>0)return label+' → '+h.line+' · returned after '+h.changes+' changes';
  return label+(h.observations>1?' · unchanged across recorded updates':' · waiting for another update');
 }
 function detail(h){
  if(!h)return 'No verified history for this quote.';
  const time=at=>new Date(at).toLocaleString('en-US',{timeZone:'America/Chicago',month:'numeric',day:'numeric',hour:'numeric',minute:'2-digit'});
  return (h.persisted?'Shared saved history':'Server memory only')+' · first '+time(h.firstAt)+' · latest '+time(h.lastAt)+' CT. First observed, not a confirmed opener.';
 }
 const api={observe,observeBrowser,fromServer,describe,detail};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 else root.Unit501LineWatch=api;
})(typeof globalThis!=='undefined'?globalThis:this);
