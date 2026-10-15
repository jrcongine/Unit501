/* Device-local first-observed FanDuel line movement; never claims bookmaker opening prices. */
(function(root){
 'use strict';
 const prefix='unit501:observed-fanduel:v1:';
 function observe(storage,scope,line,sourceAt,now=Date.now()){
  if(typeof scope!=='string'||!scope||scope.length>250||!Number.isFinite(now)||
     !Number.isFinite(line)||!Number.isInteger(line*2)||!Number.isFinite(sourceAt)||
     sourceAt>now+60000||now-sourceAt>1800000)return null;
  const key=prefix+scope;
  try{
   const saved=storage.getItem(key);
   const first=saved?JSON.parse(saved):null;
   if(first && (!Number.isFinite(first.firstLine)||!Number.isFinite(first.firstAt)||first.firstAt>now||
     !Number.isFinite(first.lastAt)||first.lastAt>now||!Number.isFinite(first.lastLine)))return null;
   const entry=first||{firstLine:line,firstAt:sourceAt,lastLine:line,lastAt:sourceAt};
   // Do not treat an older cached quote as a change, or overwrite a newer source quote.
   if(sourceAt>entry.lastAt){entry.lastAt=sourceAt;entry.lastLine=line;}
   if(!first||sourceAt>first.lastAt)storage.setItem(key,JSON.stringify(entry));
   return {firstLine:entry.firstLine,firstAt:entry.firstAt,line:entry.lastLine,lastAt:entry.lastAt,
     delta:Math.round((entry.lastLine-entry.firstLine)*100)/100,changed:entry.lastLine!==entry.firstLine};
  }catch{return null;}
 }
 const api={observe};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 else root.Unit501LineWatch=api;
})(typeof globalThis!=='undefined'?globalThis:this);
