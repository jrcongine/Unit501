'use strict';
// Pace all football consumers together, including retries. Waiting never spends
// quota; the meter still checks the allowance immediately before the actual call.
function createProviderQueue({state,now=Date.now,wait=ms=>new Promise(resolve=>setTimeout(resolve,ms)),maxWait=65000}={}){
 let tail=Promise.resolve(),nextAt=0;
 function enqueue(perform){
  const queuedAt=now();
  const gate=tail.then(async()=>{
   for(;;){
    const snapshot=state(),cooldown=Date.parse(snapshot.cooldownUntil)||0;
    const due=Math.max(nextAt,cooldown),delay=due-now();
    if(delay<=0){
     const limit=snapshot.providerQuota?.minuteLimit;
     // Use observed capacity with headroom; unknown capacity starts conservatively.
     const gap=Number.isFinite(limit)&&limit>0?Math.max(250,Math.ceil(60000/(limit*0.8))):1100;
     nextAt=now()+gap;return;
    }
    if(now()+delay-queuedAt>maxWait){
     const error=Error('Football data requests are busy. Please retry shortly.');
     error.code='FOOTBALL_COOLDOWN';error.retryAt=due;throw error;
    }
    await wait(Math.min(delay,1000));
   }
  });
  tail=gate.catch(()=>{});
  return gate.then(perform);
 }
 return perform=>enqueue(perform).catch(error=>{
  // One bounded retry resumes the same request after an actual minute throttle.
  if(error.code==='FOOTBALL_COOLDOWN'&&Number.isFinite(error.retryAt)&&error.retryAt>now()&&error.retryAt-now()<=maxWait)return enqueue(perform);
  throw error;
 });
}
module.exports={createProviderQueue};
