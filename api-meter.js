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
  const refresh=()=>{
    const current=new Date(now()).toISOString().slice(0,10);
    if(current!==date){date=current;attempts=0;failures=0;blocked=0;blockedByProviderQuota=0;byCategory={};providerQuota=null;}
  };
  const snapshot=()=>{
    refresh();
    return {scope:'This Railway instance only; resets on restart. Not API-Sports account usage.',
      dateUTC:date,startedAt,budget:cap,outboundAttempts:attempts,failedResponses:failures,blockedByGuard:blocked,
      remaining:Math.max(0,cap-attempts),byCategory:{...byCategory},
      blockedByProviderQuota,providerQuota:providerQuota?{...providerQuota}:null};
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
  async function track(endpoint,perform){
    refresh();
    if(providerQuota?.dailyRemaining===0){
      blockedByProviderQuota++;
      throw Error('Football provider daily quota exhausted. No additional API calls will be made until the next UTC day.');
    }
    if(providerQuota?.dailyRemaining!=null && (inFlight.get(date)||0)>=providerQuota.dailyRemaining){
      blockedByProviderQuota++;
      throw Error('Football provider remaining quota reserved by pending requests. Try again after they finish.');
    }
    if(attempts>=cap){
      blocked++;
      throw Error('Unit 501 football API safety budget reached for this instance today. Try after the next UTC day or adjust the owner-set budget.');
    }
    attempts++;
    const group=category(endpoint);
    byCategory[group]=(byCategory[group]||0)+1;
    const requestDate=date;
    inFlight.set(requestDate,(inFlight.get(requestDate)||0)+1);
    try{return await perform(headers=>observeHeaders(headers,requestDate));}
    catch(error){refresh();if(date===requestDate)failures++;throw error;}
    finally{const left=inFlight.get(requestDate)-1;if(left)inFlight.set(requestDate,left);else inFlight.delete(requestDate);}
  }
  return {track,snapshot,observeHeaders};
}
module.exports={category,createMeter};
