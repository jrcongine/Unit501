'use strict';
(() => {
 const byId=id=>document.getElementById(id);
 const keys=['unit501:war-room:v1','unit501-score-archive-v1'];
 const identity=window.Unit501BrowserIdentity;
 let user=null,saved=null,busy=false;
 async function api(path,method='GET',body){
  const headers=body?{'Content-Type':'application/json'}:{};
  if(user&&['records','logout'].includes(path))headers['X-Unit501-Account-ID']=user.id;
  const response=await fetch('/api/account/'+path,{method,credentials:'same-origin',headers,body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(20000)});
  const result=await response.json();if(!response.ok)throw Error(result.error||'Account request failed.');return result;
 }
 function view(){
  byId('signed-out').hidden=Boolean(user);byId('signed-in').hidden=!user;
  byId('account-email').textContent=user?.email||'';
 }
 function recordsNote(){byId('records-status').textContent=saved?.updatedAt?'Account copy last saved '+new Date(saved.updatedAt).toLocaleString()+'.':'No records saved in this account yet.';}
 async function run(fn){
  if(busy)return;busy=true;document.querySelectorAll('button').forEach(b=>b.disabled=true);
  try{await fn();}catch(error){byId('account-status').textContent=error.message||'Request could not be completed. Try again.';}
  finally{busy=false;document.querySelectorAll('button').forEach(b=>b.disabled=false);}
 }
 for(const mode of ['login','signup'])byId(mode+'-form').addEventListener('submit',event=>{
  event.preventDefault();run(async()=>{
   const input={email:byId(mode+'-email').value,password:byId(mode+'-password').value};
   if(mode==='signup')input.invite=byId('signup-invite').value;
   const before=identity.snapshot();
   const result=await api(mode,'POST',input);
   identity.activate('customer:'+result.user.id,before,true);user=result.user;
   byId(mode+'-password').value='';byId('signup-invite').value='';
   view();byId('account-status').textContent='Signed in. This browser now uses your account’s records.';
   saved=await api('records');recordsNote();
  });
 });
 function browserRecords(){const records={};for(const key of keys){const value=Unit501Storage.getItem(key);if(value!==null)records[key]=value;}return records;}
 function download(records){
  const blob=new Blob([JSON.stringify({schema:1,exportedAt:new Date().toISOString(),records},null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='unit501-browser-backup.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 byId('save-records').addEventListener('click',()=>run(async()=>{
  const records=browserRecords();if(!Object.keys(records).length)throw Error('There are no War Room or forecast records on this browser to save.');
  const latest=await api('records');
  if(!window.confirm('Save your records on this browser to '+user.email+'? This replaces your account’s saved copy.'))return;
  saved=await api('records','PUT',{revision:latest.revision,records});recordsNote();byId('account-status').textContent='Records saved to your account.';
 }));
 byId('load-records').addEventListener('click',()=>run(async()=>{
  const latest=await api('records');if(!Object.keys(latest.records).length)throw Error('There are no saved records in this account yet.');
  if(!window.confirm('Load the saved records for '+user.email+'? This replaces your War Room and forecast archives on this browser. A backup of your existing records will download first.'))return;
  const original=browserRecords();download(original);
  try{for(const key of keys){if(Object.hasOwn(latest.records,key))Unit501Storage.setItem(key,latest.records[key]);else Unit501Storage.removeItem(key);}}
  catch(error){for(const key of keys){if(Object.hasOwn(original,key))Unit501Storage.setItem(key,original[key]);else Unit501Storage.removeItem(key);}throw error;}
  // Other dashboard tabs must reload rather than retain old in-memory archives.
  identity.activate('customer:'+user.id,identity.snapshot(),true);
  saved=latest;recordsNote();byId('account-status').textContent='Your saved records are loaded. Open or reload the dashboard to use them.';
 }));
 byId('logout').addEventListener('click',()=>run(async()=>{
  const before=identity.snapshot();
  await api('logout','POST',{});user=null;saved=null;view();
  identity.activate('guest',before);byId('account-status').textContent='Signed out. Your records are hidden until you sign in again.';
 }));
 run(async()=>{
  const before=identity.snapshot();
  try{
   const result=await api('me');
   identity.activate('customer:'+result.user.id,before);user=result.user;
  }catch(error){
   const scope=document.body.dataset.unit501Scope==='owner'?'owner':'guest';
   identity.activate(scope,before);view();byId('account-status').textContent=error.message==='Sign in to your customer account.'?'Sign in or use your beta invitation to begin.':error.message;return;
  }
  view();byId('account-status').textContent='Welcome back.';saved=await api('records');recordsNote();
 });
})();
