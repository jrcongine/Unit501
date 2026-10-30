'use strict';
// Experimental NBA-only schedule feed. Never reuse the American-football provider.
const {positiveId}=require('./provider-id');
const HOST='https://v2.nba.api-sports.io';
const STATES={1:'Scheduled',2:'Live',3:'Final',4:'Postponed',5:'Delayed',6:'Canceled'};
function validDate(date){
 if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date))return false;
 const parsed=new Date(date+'T00:00:00.000Z');
 return !Number.isNaN(parsed.valueOf())&&parsed.toISOString().slice(0,10)===date;
}
function centralDate(at){
 const p=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(at)).map(x=>[x.type,x.value]));
 return p.year+'-'+p.month+'-'+p.day;
}
function utcDates(date){
 const next=new Date(date+'T00:00:00Z');next.setUTCDate(next.getUTCDate()+1);
 return [date,next.toISOString().slice(0,10)];
}
function inferSeason(date){
 const [year,month]=date.split('-').map(Number);
 return month<7?year-1:year;
}
function numberOrNull(value){
 if(typeof value!=='number'&&(typeof value!=='string'||value.trim()===''))return null;
 const n=Number(value);
 return Number.isInteger(n)&&n>=0?n:null;
}
function normalizeGame(game){
 if(!game||typeof game!=='object')return null;
 const id=positiveId(game.id);
 const visitors=game.teams?.visitors;
 const home=game.teams?.home;
 const awayId=positiveId(visitors?.id),homeId=positiveId(home?.id);
 const stage=positiveId(game.stage);
 const start=game.date?.start;
 const endedAt=typeof game.date?.end==='string'&&Number.isFinite(Date.parse(game.date.end))?game.date.end:null;
 const status=positiveId(game.status?.short);
 if(!Number.isSafeInteger(id)||id<=0||
    !visitors||!home||
    typeof visitors.name!=='string'||!visitors.name.trim()||
    typeof home.name!=='string'||!home.name.trim()||
    typeof start!=='string'||!Number.isFinite(Date.parse(start)))return null;
 if(!Object.hasOwn(STATES,status)||visitors.id!=null&&awayId===null||home.id!=null&&homeId===null||awayId!==null&&awayId===homeId||game.stage!=null&&stage===null)return null;
 return {
  ...(typeof visitors.logo==='string'?{awayLogo:visitors.logo}:{}),...(typeof home.logo==='string'?{homeLogo:home.logo}:{}),
  id,away:visitors.name.trim().slice(0,100),home:home.name.trim().slice(0,100),
  awayId:Number.isSafeInteger(awayId)&&awayId>0?awayId:null,
  homeId:Number.isSafeInteger(homeId)&&homeId>0?homeId:null,
  stage:game.stage!=null&&Number.isSafeInteger(stage)&&stage>0?stage:null,
  tipoff:start,endedAt,status:STATES[status],statusCode:status,
  awayScore:status===2||status===3?numberOrNull(game.scores?.visitors?.points):null,
  homeScore:status===2||status===3?numberOrNull(game.scores?.home?.points):null,
  period:Number.isInteger(Number(game.periods?.current))&&Number(game.periods.current)>0?Number(game.periods.current):null,
  halftime:game.periods?.halftime===true,
  arena:typeof game.arena?.name==='string'?game.arena.name.slice(0,100):null
 };
}
function createNBAFeed({fetcher=fetch,now=Date.now,key=()=>process.env.NBA_API_SPORTS_KEY||process.env.API_SPORTS_KEY}={}){
 const cache=new Map(),pending=new Map(),failures=new Map();
 return async function getGames(date){
  if(!validDate(date))throw Error('Invalid NBA date');
  const season=inferSeason(date);
  const id=season+':'+date;
  const previous=cache.get(id);
  const ttl=previous?.result.games.some(g=>g.statusCode===2||(g.statusCode===1&&Math.abs(Date.parse(g.tipoff)-now())<3600000))?60000:900000;
  if(previous&&now()-previous.at<ttl)return previous.result;
  const failure=failures.get(id);
  if(failure&&now()-failure.at<300000)throw failure.error;
  if(pending.has(id))return pending.get(id);
  const work=(async()=>{
   const apiKey=key();
   if(!apiKey)throw Error('NBA API credential unavailable');
   const unique=new Map();
   for(const utcDate of utcDates(date)){
   const url=HOST+'/games?'+new URLSearchParams({league:'standard',season:String(season),date:utcDate});
   const response=await fetcher(url,{headers:{'x-apisports-key':apiKey,Accept:'application/json'},signal:AbortSignal.timeout(12000)});
   if(!response.ok)throw Error('NBA provider returned HTTP '+response.status);
   const data=await response.json();
   if(data?.errors?.plan){const error=new Error('NBA provider plan does not include the selected season. Enable current-season API-NBA access or configure an eligible NBA key.');error.code='NBA_PLAN_ACCESS';throw error;}
   if(!data||!Array.isArray(data.response)||
      (data.errors&&(Array.isArray(data.errors)?data.errors.length:Object.keys(data.errors).length)))throw Error('NBA provider response unavailable');
   // A schedule can genuinely be empty. Missing/invalid records must not become invented games.
   if(data.response.some(g=>g?.league!=null&&g.league!=='standard'||g?.season!=null&&positiveId(g.season)!==season))throw Error('NBA provider league or season mismatch; schedule incomplete');
   const normalized=data.response.map(normalizeGame);
   if(normalized.some(g=>!g))throw Error('NBA provider format unrecognized; schedule incomplete');
   for(const g of normalized){
    if(centralDate(g.tipoff)!==date)continue;
    const old=unique.get(g.id);
    if(old&&JSON.stringify(old)!==JSON.stringify(g))throw Error('NBA schedule contains conflicting game IDs');
    unique.set(g.id,g);
   }
   }
   const games=[...unique.values()].sort((a,b)=>Date.parse(a.tipoff)-Date.parse(b.tipoff));
   const result={league:'nba',season,date,checkedAt:new Date(now()).toISOString(),games,experimental:true};
   cache.set(id,{result,at:now()});
   return result;
  })();
  pending.set(id,work);
  try{return await work;}catch(error){failures.set(id,{at:now(),error});throw error;}finally{pending.delete(id);}
 };
}
module.exports={createNBAFeed,normalizeGame,validDate,inferSeason,centralDate,utcDates};
