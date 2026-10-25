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
  let storage;try{storage=root.Unit501Storage;}catch{}
  return observe(storage,scope,line,sourceAt,now);
 }
 const api={observe,observeBrowser};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 else root.Unit501LineWatch=api;
})(typeof globalThis!=='undefined'?globalThis:this);
