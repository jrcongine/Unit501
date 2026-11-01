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
function rateLimited(data){
  const errors=data?.errors;
  const text=typeof errors==='string'?errors:errors&&typeof errors==='object'?Object.entries(errors).map(([key,value])=>key+' '+String(value)).join(' '):'';
  return /rate[ -]?limit|too many requests|requests?[^.]{0,60}(?:per minute|per second)|(?:per minute|per second)[^.]{0,60}(?:limit|requests)/i.test(text);
}
function createMeter({now=Date.now,budget=7500,history=null}={}){
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
    let recentDays=null;
    if(history){try{recentDays=history.recent();}catch{/* Preserve the live meter when the volume cannot be read. */}}
    return {recentDays,scope:'This Railway instance only; resets on restart. Not API-Sports account usage.',
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
    if(requestDate && requestDate!==date)return;
    if(observedDate && observedDate!==date)return;
    const dailyLimit=headerCount(headers,'x-ratelimit-requests-limit');
    const dailyRemaining=headerCount(headers,'x-ratelimit-requests-remaining');
    const minuteLimit=headerCount(headers,'x-ratelimit-limit');
    const minuteRemaining=headerCount(headers,'x-ratelimit-remaining');
    if([dailyLimit,dailyRemaining,minuteLimit,minuteRemaining].every(value=>value===null))return;
    const previous=providerQuota;
    // Keep a conservative local allowance: missing/stale headers never refund a call.
    if(dailyRemaining!==null)providerAllowance=Math.min(providerAllowance??Infinity,Math.max(0,dailyRemaining-Math.max(0,(inFlight.get(date)||0)-(requestDate?1:0))));
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
    }else if(rateLimited(data)){
      // Only a rate-limit error justifies pausing unrelated endpoints. Invalid
      // parameters, missing coverage and auth failures must retain their own cause.
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
      const error=Error('Football provider cooldown active. Try again after '+new Date(cooldownUntil).toISOString()+'.');
      error.code='FOOTBALL_COOLDOWN';error.retryAt=cooldownUntil;throw error;
    }
    if(attempts>=cap){
      blocked++;
      throw Error('Unit 501 football API safety budget reached for this instance today. Try after the next UTC day or adjust the owner-set budget.');
    }
    // Do not send an uncounted request when durable metering is configured.
    if(history){try{history.record(date);}catch{throw Error('Football usage storage unavailable. Request paused before contacting provider.');}}
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
module.exports={category,createMeter,rateLimited};
