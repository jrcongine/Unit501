/* Account-scoped dashboard storage. Existing owner keys stay unchanged. */
(function(root){
 'use strict';
 const markerKey='unit501:browser-identity:v1';
 const valid=scope=>scope==='owner'||scope==='guest'||/^customer:[0-9a-f-]{36}$/.test(scope||'');
 function create({raw,scope='guest',onMismatch=()=>{}}){
  if(!valid(scope))throw Error('Invalid browser account scope.');
  let current=scope,blocked=false,lease=null;
  const snapshot=()=>raw.getItem(markerKey);
  function identity(){try{return JSON.parse(snapshot()||'null')?.scope||null;}catch{return null;}}
  lease=snapshot();
  function guard(){
   if(blocked||current==='guest'||snapshot()!==lease||identity()!==current){blocked=true;onMismatch();throw Error('Your account changed. Open the account page before using saved records.');}
  }
  function key(name){guard();return current==='owner'?String(name):'unit501:'+current+':'+String(name);}
  const storage={getItem:name=>raw.getItem(key(name)),setItem:(name,value)=>raw.setItem(key(name),String(value)),removeItem:name=>raw.removeItem(key(name))};
  function activate(next,expected,rotate=false){
   if(!valid(next))throw Error('Invalid browser account scope.');
   if(snapshot()!==expected){blocked=true;onMismatch();throw Error('Your account changed in another tab. Reload and try again.');}
   if(!rotate&&identity()===next){current=next;lease=expected;blocked=false;return;}
   // An epoch makes a logout/login cycle visible even when it returns to the same user.
   const nextLease=JSON.stringify({scope:next,epoch:Date.now()+':'+Math.random()});
   raw.setItem(markerKey,nextLease);lease=nextLease;
   current=next;blocked=false;
  }
  function check(){if(snapshot()!==lease||identity()!==current){blocked=true;onMismatch();return false;}return !blocked;}
  return {storage,snapshot,activate,check,get scope(){return current;}};
 }
 const api={create,markerKey};
 if(typeof module!=='undefined'&&module.exports){module.exports=api;return;}
 const accountPage=root.location?.pathname==='/account.html';
 function lock(){
  // Remove the previous user's visible dashboard before navigating away.
  root.document.documentElement.style.visibility='hidden';
  root.location.replace('/account.html');
 }
 let manager;
 try{
  const scope=root.document.body.dataset.unit501Scope||'guest';
  manager=create({raw:root.localStorage,scope,onMismatch:lock});
  const initial=manager.snapshot();
  // Only a server-authenticated scope can initialize a fresh dashboard browser.
  if(!accountPage){if(initial===null&&scope!=='guest')manager.activate(scope,initial);manager.check();}
  root.addEventListener('storage',event=>{if(event.key===markerKey||event.key===null)manager.check();});
 }catch{
  if(!accountPage)lock();
  const unavailable=()=>{throw Error('Browser storage is unavailable. Enable site storage to use your saved records.');};
  manager={storage:{getItem:unavailable,setItem:unavailable,removeItem:unavailable},snapshot:unavailable,activate:unavailable,scope:'guest'};
 }
 root.Unit501Storage=manager.storage;
 root.Unit501BrowserIdentity=manager;
})(typeof window!=='undefined'?window:globalThis);
