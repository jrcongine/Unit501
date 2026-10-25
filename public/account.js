'use strict';
(() => {
 const byId=id=>document.getElementById(id);
 const keys=['unit501:war-room:v1','unit501-score-archive-v1'];
 let user=null,saved=null,busy=false;
 async function api(path,method='GET',body){
  const response=await fetch('/api/account/'+path,{method,credentials:'same-origin',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(20000)});
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
   const result=await api(mode,'POST',input);user=result.user;
   byId(mode+'-password').value='';byId('signup-invite').value='';
   view();byId('account-status').textContent='Signed in. Your browser records have not been changed.';
   saved=await api('records');recordsNote();
  });
 });
 function browserRecords(){const records={};for(const key of keys){const value=localStorage.getItem(key);if(value!==null)records[key]=value;}return records;}
 function download(records){
  const blob=new Blob([JSON.stringify({schema:1,exportedAt:new Date().toISOString(),records},null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='unit501-browser-backup.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 byId('save-records').addEventListener('click',()=>run(async()=>{
  const records=browserRecords();if(!Object.keys(records).length)throw Error('There are no War Room or forecast records on this browser to save.');
  const latest=await api('records');
  if(!window.confirm('Save this browser’s War Room and forecast records to '+user.email+'? This replaces that account’s saved copy. Only continue if these are your records.'))return;
  saved=await api('records','PUT',{revision:latest.revision,records});recordsNote();byId('account-status').textContent='Records saved to your account.';
 }));
 byId('load-records').addEventListener('click',()=>run(async()=>{
  const latest=await api('records');if(!Object.keys(latest.records).length)throw Error('There are no saved records in this account yet.');
  if(!window.confirm('Load the saved records for '+user.email+'? This replaces the War Room and forecast archives on this browser. A backup of existing browser records will download first. Close other UNIT501 dashboard tabs before continuing.'))return;
  const original=browserRecords();download(original);
  try{for(const key of keys){if(Object.hasOwn(latest.records,key))localStorage.setItem(key,latest.records[key]);else localStorage.removeItem(key);}}
  catch(error){for(const key of keys){if(Object.hasOwn(original,key))localStorage.setItem(key,original[key]);else localStorage.removeItem(key);}throw error;}
  saved=latest;recordsNote();byId('account-status').textContent='Your saved records are loaded. Open or reload the dashboard to use them.';
 }));
 byId('logout').addEventListener('click',()=>run(async()=>{
  await api('logout','POST',{});user=null;saved=null;view();byId('account-status').textContent='Signed out. Records remain on this browser.';
 }));
 run(async()=>{
  try{user=(await api('me')).user;}catch(error){view();byId('account-status').textContent=error.message==='Sign in to your customer account.'?'Sign in or use your beta invitation to begin.':error.message;return;}
  view();byId('account-status').textContent='Welcome back.';saved=await api('records');recordsNote();
 });
})();
