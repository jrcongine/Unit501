'use strict';
(()=>{
 const $=id=>document.getElementById(id);let snapshot=null;
 const date=value=>value?new Date(value).toLocaleString('en-US',{timeZone:'America/Chicago',timeZoneName:'short'}):'Not recorded';
 function node(tag,text,cls){const el=document.createElement(tag);el.textContent=text;if(cls)el.className=cls;return el;}
 function render(){
  if(!snapshot)return;
  const filter=$('health-filter').value,root=$('health-feeds');root.replaceChildren();
  for(const row of snapshot.feeds){
   if(filter==='attention'&&!['failed','unavailable','partial','stale','unchecked','loading'].includes(row.status))continue;
   if(!['all','attention'].includes(filter)&&!row.id.startsWith(filter+':'))continue;
   const card=node('article','','health-feed');card.append(node('h3',row.label),node('span',row.status.toUpperCase(),'health-badge health-'+row.status),node('p','Source / check: '+date(row.sourceAt)),node('p','Last successful response: '+date(row.lastSuccessAt)));root.append(card);
  }
  if(!root.children.length)root.append(node('p','No feeds match this filter. Unchecked feeds are not confirmed working.'));
 }
 async function refresh(){
  $('health-refresh').disabled=true;$('health-message').textContent='Reading saved status…';
  try{
   const response=await fetch('/api/data-health',{cache:'no-store',signal:AbortSignal.timeout(10000)});
   if(!response.ok)throw Error();snapshot=await response.json();
   $('health-scope').textContent=snapshot.scope;
   const usage=snapshot.footballUsage,history=snapshot.lineHistory,root=$('health-capacity');root.replaceChildren();
   const quota=usage.providerQuota;
   for(const [title,detail] of [
    ['Football provider quota',quota?.dailyLimit!=null?quota.dailyLimit.toLocaleString()+'/day · '+(quota.dailyRemaining??'Unknown')+' remaining at '+date(quota.observedAt):'Not yet verified from provider headers.'],
    ['Server request budget',usage.outboundAttempts+' / '+usage.budget+' attempts today · resets on restart.'],
    ['Football recovery',usage.cooldownUntil?'Paused until '+date(usage.cooldownUntil):usage.providerAllowance===0||usage.remaining===0?'Daily allowance exhausted; requests paused.':'One retry for temporary network or 502/503/504 errors. Each attempt uses the quota guard.'],
    ['Feed status storage',snapshot.storage?.error|| (snapshot.storage?.persistent?'Saved across server restarts; original update times retained.':snapshot.storage?.configured?'Persistence configured; waiting for a saved observation.':'Temporary storage; status resets on restart.')],
    ['Line history',history.message+' · '+(history.persistent?'Persistent storage':'Temporary storage')]
   ]){const item=node('div','','health-stat');item.append(node('strong',title),node('p',detail));root.append(item);}
   render();$('health-message').textContent='Status read '+date(snapshot.checkedAt)+' · server started '+date(snapshot.startedAt);
  }catch{$('health-message').textContent='Could not refresh status. Any displayed values are from the previous refresh.';}
  finally{$('health-refresh').disabled=false;}
 }
 $('health-refresh').addEventListener('click',refresh);$('health-filter').addEventListener('change',render);refresh();
})();
