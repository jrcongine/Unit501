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
  let date='',attempts=0,failures=0,blocked=0,byCategory={};
  const refresh=()=>{
    const current=new Date(now()).toISOString().slice(0,10);
    if(current!==date){date=current;attempts=0;failures=0;blocked=0;byCategory={};}
  };
  const snapshot=()=>{
    refresh();
    return {scope:'This Railway instance only; resets on restart. Not API-Sports account usage.',
      dateUTC:date,startedAt,budget:cap,outboundAttempts:attempts,failedResponses:failures,blockedByGuard:blocked,
      remaining:Math.max(0,cap-attempts),byCategory:{...byCategory}};
  };
  async function track(endpoint,perform){
    refresh();
    if(attempts>=cap){
      blocked++;
      throw Error('Unit 501 football API safety budget reached for this instance today. Try after the next UTC day or adjust the owner-set budget.');
    }
    attempts++;
    const group=category(endpoint);
    byCategory[group]=(byCategory[group]||0)+1;
    try{return await perform();}
    catch(error){failures++;throw error;}
  }
  return {track,snapshot};
}
module.exports={category,createMeter};
