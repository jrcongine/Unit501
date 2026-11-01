(()=>{
'use strict';
const panel=document.getElementById('api-usage-panel');
const refresh=document.getElementById('api-usage-refresh');
const message=document.getElementById('api-usage-message');
const details=document.getElementById('api-usage-details');
if(!panel||!refresh||!message||!details)return;
let pending=false;
const format=new Intl.NumberFormat('en-US');
async function load(){
 if(pending)return;
 pending=true;refresh.disabled=true;
 message.textContent='Reading local app request counter…';
 try{
  const r=await fetch('/api/provider-usage',{signal:AbortSignal.timeout(10000)});
  const d=await r.json();
  if(!r.ok||!Number.isFinite(d.outboundAttempts)||!Number.isFinite(d.budget))throw Error();
  message.textContent=format.format(d.outboundAttempts)+' outgoing football API calls today (UTC) on this app instance; '+format.format(d.remaining)+' left before its safety cap of '+format.format(d.budget)+'.';
  details.replaceChildren();
  const entries=Object.entries(d.byCategory||{}).sort((a,b)=>b[1]-a[1]);
  const rows=entries.length?entries:[['No outgoing calls yet',0]];
  const list=document.createElement('ul');
  for(const [category,count]of rows){
    const li=document.createElement('li');
    li.textContent=category.replace(/([A-Z])/g,' $1')+': '+format.format(count);
    list.append(li);
  }
  details.append(list);
  const foot=document.createElement('p');
  foot.className='war-muted';
  foot.textContent='Failed outgoing requests: '+format.format(d.failedResponses)+
    '. Calls blocked by app safety cap: '+format.format(d.blockedByGuard)+
    '. This process started '+new Date(d.startedAt).toLocaleString()+'.';
  details.append(foot);
  if(Array.isArray(d.recentDays)){
    const title=document.createElement('strong');
    title.textContent='Recorded football calls by UTC day';
    const days=document.createElement('ul');
    for(const day of d.recentDays){
      const row=document.createElement('li');
      row.textContent=day.dateUTC+' · '+format.format(day.attempts);
      days.append(row);
    }
    const note=document.createElement('p');
    note.textContent='Includes calls recorded on this volume across restarts. Recording starts with this release. Only days with recorded calls appear.';
    details.append(title,days,note);
  }
 }catch{
  message.textContent='App request counter unavailable. Check the provider dashboard for account-wide usage.';
  details.replaceChildren();
 }finally{pending=false;refresh.disabled=false;}
}
panel.addEventListener('toggle',()=>{if(panel.open)load();});
refresh.addEventListener('click',load);
})();