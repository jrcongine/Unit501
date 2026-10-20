'use strict';
// Local, process-scoped counter for *outbound* American-football API requests.
// Counters reset with the app process and are NOT provider account usage.
function category(endpoint){
  const route=String(endpoint).split('?')[0];
  if(route==='/games/statistics/teams')return 'teamBoxScores';
  if(route==='/games/statistics/players')return 'playerBoxScores';
  if(route==='/games')return 'schedules';
  if(route==='/players')return 'rosters';
  if(route==='/injuries')return 'injuries';
  if(route==='/odds')return 'odds';
  if(route==='/leagues')return 'leagueCoverage';
  return 'other';
}
function createMeter({now=Date.now,budget=1500}={}){
  const cap=Number(budget);
  if(!Number.isSafeInteger(cap)||cap<1||cap>7500)throw Error('Invalid football daily soft budget');
  const startedAt=new Date(now()).toISOString();
  let date='',attempts=0,failures=0,blocked=0,blockedByProviderQuota=0,byCategory={},providerQuota=null;
  const inFlight=new Map();
  let providerAllowance=null,cooldownUntil=0,blockedByCooldown=0;
  const refresh=()=>{
    const current=new Date(now()).toISOString().slice(0,10);
    if(current!==date){date=current;attempts=0;failures=0;blocked=0;blockedByProviderQuota=0;byCategory={};providerQuota=null;providerAllowance=null;cooldownUntil=0;blockedByCooldown=0;}
  };
  const snapshot=()=>{
    refresh();
    return {scope:'This Railway instance only; resets on restart. Not API-Sports account usage.',
      dateUTC:date,startedAt,budget:cap,outboundAttempts:attempts,failedResponses:failures,blockedByGuard:blocked,
      remaining:Math.max(0,cap-attempts),byCategory:{...byCategory},
      blockedByProviderQuota,blockedByCooldown,cooldownUntil:cooldownUntil>now()?new Date(cooldownUntil).toISOString():null,providerAllowance,providerQuota:providerQuota?{...providerQuota}:null};
  };
  // API-Sports supplies account-wide quota counts on each HTTP response.
  // No additional provider calls are needed to observe these headers.
  function headerCount(headers,name){
    if(!headers||typeof headers.get!=='function')return null;
    const raw=headers.get(name);
    if(raw===null||!/^[0-9]+$/.test(String(raw).trim()))return null;
    const value=Number(raw);
    return Number.isSafeInteger(value)?value:null;
  }
  function observeHeaders(headers,requestDate){
    refresh();
    // A response started yesterday cannot exhaust today’s quota.
    const responseDate=headers?.get?.('date');
    const timestamp=responseDate?Date.parse(responseDate):NaN;
    const observedDate=Number.isFinite(timestamp)?new Date(timestamp).toISOString().slice(0,10):requestDate;
    if(observedDate && observedDate!==date)return;
    const dailyLimit=headerCount(headers,'x-ratelimit-requests-limit');
    const dailyRemaining=headerCount(headers,'x-ratelimit-requests-remaining');
    const minuteLimit=headerCount(headers,'x-ratelimit-limit');
    const minuteRemaining=headerCount(headers,'x-ratelimit-remaining');
    if([dailyLimit,dailyRemaining,minuteLimit,minuteRemaining].every(value=>value===null))return;
    const previous=providerQuota;
    // Keep a conservative local allowance: missing/stale headers never refund a call.
    if(dailyRemaining!==null)providerAllowance=Math.min(providerAllowance??Infinity,dailyRemaining);
    if(minuteRemaining===0)cooldownUntil=Math.max(cooldownUntil,now()+60000);
    // Responses can finish out of order. Keep the smallest daily remainder
    // observed during a UTC day, rather than accidentally increasing it.
    providerQuota={
      dailyLimit:dailyLimit??previous?.dailyLimit??null,
      dailyRemaining:dailyRemaining===null?(previous?.dailyRemaining??null):
        Math.min(dailyRemaining,previous?.dailyRemaining??Infinity),
      minuteLimit:minuteLimit??previous?.minuteLimit??null,
      minuteRemaining:minuteRemaining??previous?.minuteRemaining??null,
      observedAt:new Date(now()).toISOString()
    };
  }
  function observeResponse(status,headers,data,requestDate){
    refresh();
    if(requestDate!==date)return;
    if(status===429){
      const raw=headers?.get?.('retry-after');
      const seconds=raw!==null&&raw!==undefined&&/^\d+$/.test(raw)?Number(raw):NaN;
      const until=Number.isFinite(seconds)?now()+seconds*1000:Date.parse(raw);
      cooldownUntil=Math.max(cooldownUntil,now()+60000,Number.isFinite(until)?until:0);
    }else if(data?.errors&&Object.keys(data.errors).length){
      // API-Sports can return an application error with HTTP 200. Pause retries,
      // but do not invent daily exhaustion from an unverified error message.
      cooldownUntil=Math.max(cooldownUntil,now()+60000);
    }
  }
  async function track(endpoint,perform){
    refresh();
    if(providerAllowance===0){
      blockedByProviderQuota++;
      throw Error(providerQuota?.dailyRemaining===0
        ?'Football provider daily quota exhausted. No additional API calls will be made until the next UTC day.'
        :'Football conservative provider allowance exhausted. Calls paused until the next UTC day; check the provider dashboard for the actual account balance.');
    }
    if(providerQuota?.dailyRemaining!=null && (inFlight.get(date)||0)>=providerQuota.dailyRemaining){
      blockedByProviderQuota++;
      throw Error('Football provider remaining quota reserved by pending requests. Try again after they finish.');
    }
    if(cooldownUntil>now()){
      blockedByCooldown++;
      throw Error('Football provider cooldown active. Try again after '+new Date(cooldownUntil).toISOString()+'.');
    }
    if(attempts>=cap){
      blocked++;
      throw Error('Unit 501 football API safety budget reached for this instance today. Try after the next UTC day or adjust the owner-set budget.');
    }
    if(providerAllowance!==null)providerAllowance=Math.max(0,providerAllowance-1);
    attempts++;
    const group=category(endpoint);
    byCategory[group]=(byCategory[group]||0)+1;
    const requestDate=date;
    inFlight.set(requestDate,(inFlight.get(requestDate)||0)+1);
    try{return await perform(headers=>observeHeaders(headers,requestDate),(status,headers,data)=>observeResponse(status,headers,data,requestDate));}
    catch(error){refresh();if(date===requestDate)failures++;throw error;}
    finally{const left=inFlight.get(requestDate)-1;if(left)inFlight.set(requestDate,left);else inFlight.delete(requestDate);}
  }
  return {track,snapshot,observeHeaders};
}
module.exports={category,createMeter};
