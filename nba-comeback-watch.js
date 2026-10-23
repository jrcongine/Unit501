'use strict';
// NBA first-half deficit watcher. These are informational score triggers, NOT betting signals.
const HOST='https://v2.nba.api-sports.io';
const THRESHOLD=20;
const MAX_REQUESTS_PER_DAY=150;
function positiveScore(value){
  if(typeof value==='boolean'||value==null||value==='')return null;
  const n=Number(value);return Number.isSafeInteger(n)&&n>=0?n:null;
}
function pickAlert(game){
  if(!game||game.league!=='standard'||Number(game.status?.short)!==2||game.status?.halftime===true)return null;
  const period=Number(game.periods?.current);
  if(![1,2].includes(period)||game.periods?.endOfPeriod===true)return null;
  const rawClock=game.status?.clock;
  if(period===2&&typeof rawClock==='string'&&/^0{1,2}:0{2}(?:\.0+)?$/.test(rawClock.trim()))return null;
  const away=game.teams?.visitors?.name,home=game.teams?.home?.name;
  const awayScore=positiveScore(game.scores?.visitors?.points),homeScore=positiveScore(game.scores?.home?.points);
  const id=Number(game.id);
  if(!Number.isSafeInteger(id)||id<=0||typeof away!=='string'||!away.trim()||typeof home!=='string'||!home.trim()||awayScore===null||homeScore===null)return null;
  const lead=Math.abs(awayScore-homeScore);
  if(lead<THRESHOLD)return null;
  const trailing=awayScore<homeScore?away:home;
  const leading=awayScore>homeScore?away:home;
  return {id,away:away.trim().slice(0,100),home:home.trim().slice(0,100),awayScore,homeScore,period,clock:typeof rawClock==='string'?rawClock.slice(0,16):null,deficit:lead,trailing:trailing.trim().slice(0,100),leading:leading.trim().slice(0,100)};
}
function createWatch({fetcher=fetch,now=Date.now,key=()=>process.env.NBA_API_SPORTS_KEY||process.env.API_SPORTS_KEY,maxRequests=MAX_REQUESTS_PER_DAY,ttl=85000}={}){
  let cache=null,pending=null,day=null,used=0;
  return async function watch(){
    const current=now(),today=new Date(current).toISOString().slice(0,10);
    if(day!==today){day=today;used=0;cache=null;}
    if(cache&&current-cache.at<ttl)return {...cache.data,cached:true};
    if(pending)return pending;
    if(used>=maxRequests)return {available:false,checkedAt:new Date(current).toISOString(),message:'NBA live-score watch reached its daily request budget.',alerts:[]};
    const credential=key();
    if(!credential)return {available:false,checkedAt:new Date(current).toISOString(),message:'NBA API credential unavailable.',alerts:[]};
    used+=1;
    const work=(async()=>{
      const response=await fetcher(HOST+'/games?live=all',{headers:{'x-apisports-key':credential,Accept:'application/json'},signal:AbortSignal.timeout(12000)});
      if(!response.ok)throw Error('Live NBA score provider HTTP '+response.status);
      const data=await response.json();
      if(!data||!Array.isArray(data.response)||(data.errors&&(Array.isArray(data.errors)?data.errors.length:Object.keys(data.errors).length)))throw Error('Live NBA score data unavailable');
      const alerts=data.response.map(pickAlert).filter(Boolean);
      const result={available:true,checkedAt:new Date(now()).toISOString(),alerts,message:alerts.length?null:'No NBA first-half leads of 20+ currently detected.'};
      cache={at:now(),data:result};
      return result;
    })();
    pending=work;
    try{return await work;}finally{if(pending===work)pending=null;}
  };
}
module.exports={pickAlert,createWatch,THRESHOLD,MAX_REQUESTS_PER_DAY};
