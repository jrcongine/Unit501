(function(){
 'use strict';
 // This deliberately runs only while the NBA page is open. It does NOT register server push.
 const toggle=document.getElementById('nba-comeback-enabled');
 const status=document.getElementById('nba-comeback-status');
 const alerts=document.getElementById('nba-comeback-alerts');
 const check=document.getElementById('nba-comeback-check');
 const permission=document.getElementById('nba-comeback-permission');
 const shared=window.Unit501SharedUI;
 if(!toggle||!status||!alerts||!check||!permission||!shared)return;
 const KEY='unit501:nba-comeback-watch:v1';
 const SEEN='unit501:nba-comeback-alerts:v1';
 const INTERVAL=120000;
 let timer=null,enabled=false,epoch=0,windows=[];
 const seenInMemory=new Set();
 const node=(tag,value)=>{const x=document.createElement(tag);x.textContent=String(value);return x;};
 const getFlag=()=>{try{return localStorage.getItem(KEY)==='on';}catch{return false;}};
 const saveFlag=value=>{try{localStorage.setItem(KEY,value?'on':'off');}catch{}};
 function readSeen(){
  try{
   const parsed=JSON.parse(localStorage.getItem(SEEN)||'{}');
   if(!parsed||Array.isArray(parsed)||typeof parsed!=='object')return {};
   const cutoff=Date.now()-3*86400000;
   return Object.fromEntries(Object.entries(parsed).filter(([key,value])=>
    /^\d+$/.test(key)&&value&&Number.isFinite(value.at)&&value.at>cutoff&&typeof value.text==='string').slice(-40));
  }catch{return {};}
 }
 function saveSeen(map){try{localStorage.setItem(SEEN,JSON.stringify(map));}catch{}}
 function renderSeen(){
  alerts.replaceChildren();
  const found=Object.values(readSeen()).sort((a,b)=>b.at-a.at).slice(0,15);
  for(const item of found){
   const card=node('p',item.text+' · detected '+new Date(item.at).toLocaleTimeString());
   card.className='nba-comeback-entry';
   alerts.append(card);
  }
 }
 function notify(a){
  // Capture every first qualifying observation for later official final-score grading.
  window.Unit501ComebackTracker?.observe(a);
  const seen=readSeen(),id=String(a.id);
  if(seen[id]||seenInMemory.has(id))return;
  seenInMemory.add(id);
  const text=a.trailing+' trails '+a.leading+' by '+a.deficit+
   ' ('+a.away+' '+a.awayScore+' – '+a.home+' '+a.homeScore+', Q'+a.period+
   (a.clock?' '+a.clock:'')+'). Check the live moneyline; this is not a bet recommendation.';
  seen[id]={at:Date.now(),text};
  saveSeen(seen);renderSeen();
  if('Notification' in window&&Notification.permission==='granted'){
   try{const n=new Notification('Unit 501 · NBA Comeback Watch',{body:text,tag:'unit501-comeback-'+id});
    n.onclick=()=>{window.focus();n.close();};}catch{}
  }
 }
 function pause(){if(timer!==null)clearTimeout(timer);timer=null;}
 function setNext(ms,token){
  pause();if(!enabled||token!==epoch)return;
  timer=setTimeout(()=>{if(enabled&&token===epoch)tick(token);},Math.max(1000,Math.min(ms,2147483647)));
 }
 function nextWindow(now){
  if(windows.some(w=>now>=w.start&&now<w.end))return {active:true};
  const future=windows.filter(w=>w.start>now).map(w=>w.start);
  return {active:false,delay:future.length?Math.min(...future)-now:null};
 }
 async function tick(token){
  if(!enabled||token!==epoch)return;
  const windowState=nextWindow(Date.now());
  if(!windowState.active){
   if(windowState.delay===null){status.textContent='No more scheduled first-half monitoring windows for today. Turn off or check again tomorrow.';return;}
   status.textContent='Comeback Watch armed. Waiting for tonight’s NBA tipoffs; no NBA live-score polling yet.';
   return setNext(windowState.delay,token);
  }
  check.disabled=true;
  try{
   const r=await fetch('/api/nba/comeback-watch',{signal:AbortSignal.timeout(16000)});
   const data=await r.json();
   if(!enabled||token!==epoch)return;
   if(!r.ok||!data.available||!Array.isArray(data.alerts))throw Error(data.message||'Live NBA score feed unavailable.');
   if(Date.now()-Date.parse(data.checkedAt)>180000)throw Error('Live NBA scores are stale.');
   for(const a of data.alerts)if(a&&Number.isSafeInteger(a.id)&&Number.isFinite(a.deficit)&&a.deficit>=20&&[1,2].includes(a.period))notify(a);
   status.textContent='Comeback Watch ON · NBA live scores checked '+new Date(data.checkedAt).toLocaleTimeString()+
    ' · '+(data.alerts.length?data.alerts.length+' qualifying game(s) observed.':'No 20-point first-half lead right now.')+
    ' One alert per game; verify the live line yourself.';
  }catch(e){
   if(enabled&&token===epoch)status.textContent='Comeback Watch could not verify current NBA scores: '+e.message+' No alert issued.';
  }finally{
   check.disabled=false;
   if(enabled&&token===epoch)setNext(INTERVAL,token);
  }
 }
 async function start(){
  ++epoch;pause();enabled=toggle.checked;saveFlag(enabled);check.disabled=!enabled;
  if(!enabled){status.textContent='Comeback Watch OFF. No live-score checks.';return;}
  const token=epoch;
  status.textContent='Loading today’s NBA tipoffs for Comeback Watch…';
  try{
   const date=shared.dateCentral();
   const r=await fetch('/api/nba/games?date='+encodeURIComponent(date),{signal:AbortSignal.timeout(17000)});
   const data=await r.json();
   if(token!==epoch||!enabled)return;
   if(!r.ok||!Array.isArray(data.games))throw Error('NBA schedule unavailable.');
   windows=data.games.map(g=>Date.parse(g.tipoff)).filter(Number.isFinite).map(t=>
    ({start:t-30000,end:t+95*60000}));
   if(!windows.length){status.textContent='No NBA games returned for today; automatic checks paused. Use Check live scores to retry manually.';return;}
   tick(token);
  }catch{
   if(enabled&&token===epoch)status.textContent='NBA schedule unavailable. Automatic checks paused; use Check live scores to try manually.';
  }
 }
 async function manualCheck(){
  if(!enabled)return;
  const token=epoch;
  status.textContent='Checking live NBA scores…';
  check.disabled=true;
  try{
   const r=await fetch('/api/nba/comeback-watch',{signal:AbortSignal.timeout(16000)});
   const data=await r.json();
   if(token!==epoch||!enabled)return;
   if(!r.ok||!data.available||!Array.isArray(data.alerts)||Date.now()-Date.parse(data.checkedAt)>180000)throw Error(data.message||'Live feed unavailable.');
   for(const a of data.alerts)if(a&&Number.isSafeInteger(a.id)&&a.deficit>=20&&[1,2].includes(a.period))notify(a);
   status.textContent='Checked '+new Date(data.checkedAt).toLocaleTimeString()+
    ': '+(data.alerts.length?data.alerts.length+' qualifying game(s) in progress.':'No first-half 20-point leads detected.');
  }catch(e){if(token===epoch)status.textContent='No verified live scores: '+e.message;}
  finally{check.disabled=!enabled;}
 }
 toggle.addEventListener('change',start);
 check.addEventListener('click',manualCheck);
 permission.addEventListener('click',async()=>{
  if(!('Notification' in window)){status.textContent='This browser cannot display system notifications; in-page alerts still work.';return;}
  if(!window.isSecureContext){status.textContent='System notifications need a secure HTTPS page. In-page alerts still work.';return;}
  try{
   const decision=await Notification.requestPermission();
   status.textContent=decision==='granted'?
    'Browser notifications allowed while the NBA page remains open. Closed-app push is not enabled.':
    'Notifications not granted; in-page alerts are still available while this page stays open.';
  }catch{status.textContent='Browser notifications could not be enabled; in-page alerts remain available.';}
 });
 renderSeen();toggle.checked=getFlag();check.disabled=!toggle.checked;
 if(toggle.checked)start();
})();