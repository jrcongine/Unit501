(()=>{
'use strict';
const panel=document.getElementById('api-usage-panel');
const refresh=document.getElementById('api-usage-refresh');
const message=document.getElementById('api-usage-message');
const details=document.getElementById('api-usage-details');
if(!panel||!refresh||!message||!details)return;
let pending=false,baseline=null;
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
  if(!baseline||baseline.startedAt!==d.startedAt||baseline.dateUTC!==d.dateUTC||d.outboundAttempts<baseline.count)baseline={startedAt:d.startedAt,dateUTC:d.dateUTC,count:d.outboundAttempts};
  const delta=document.createElement('p');
  delta.textContent=format.format(d.outboundAttempts-baseline.count)+' outgoing football requests since the first check on this page. Refreshing this counter uses no sports API requests.';
  details.append(delta);
  const quota=d.providerQuota;
  const providerLine=document.createElement('p');
  if(quota&&Number.isSafeInteger(quota.dailyLimit)&&Number.isSafeInteger(quota.dailyRemaining)){
    providerLine.textContent='API-Sports provider: '+format.format(quota.dailyLimit-quota.dailyRemaining)+
      ' of '+format.format(quota.dailyLimit)+' daily football calls used; '+
      format.format(quota.dailyRemaining)+' remaining (last reported '+new Date(quota.observedAt).toLocaleTimeString()+').';
  }else{
    providerLine.textContent='Provider account usage not yet observed by this instance. Check your API-Sports dashboard for the account total.';
  }
  details.append(providerLine);
  if(Number.isSafeInteger(d.providerAllowance)){
    const allowance=document.createElement('p');
    allowance.textContent='Conservative provider allowance for new calls: '+format.format(d.providerAllowance)+'. This deducts local attempts since the last reported balance; it is not a fresh account reading.';
    details.append(allowance);
  }
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
    '. Calls blocked by provider quota or pending reservations: '+format.format(d.blockedByProviderQuota||0)+
    '. Calls blocked by cooldown: '+format.format(d.blockedByCooldown||0)+
    (d.cooldownUntil?'. Retry after '+new Date(d.cooldownUntil).toLocaleTimeString():'')+
    '. This process started '+new Date(d.startedAt).toLocaleString()+'.';
  details.append(foot);
 }catch{
  message.textContent='App request counter unavailable. Check the provider dashboard for account-wide usage.';
  details.replaceChildren();
 }finally{pending=false;refresh.disabled=false;}
}
panel.addEventListener('toggle',()=>{if(panel.open)load();});
refresh.addEventListener('click',load);
})();