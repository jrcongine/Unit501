'use strict';
// Experimental NBA-only schedule feed. Never reuse the American-football provider.
const HOST='https://v2.nba.api-sports.io';
const STATES={1:'Scheduled',2:'Live',3:'Final',4:'Postponed',5:'Delayed',6:'Canceled'};
function validDate(date){
 if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date))return false;
 const parsed=new Date(date+'T00:00:00.000Z');
 return !Number.isNaN(parsed.valueOf())&&parsed.toISOString().slice(0,10)===date;
}
function inferSeason(date){
 const [year,month]=date.split('-').map(Number);
 return month<7?year-1:year;
}
function numberOrNull(value){
 if(value===null||value===undefined||value==='')return null;
 const n=Number(value);
 return Number.isFinite(n)&&n>=0?n:null;
}
function normalizeGame(game){
 if(!game||typeof game!=='object')return null;
 const id=Number(game.id);
 const visitors=game.teams?.visitors;
 const home=game.teams?.home;
 const start=game.date?.start;
 const status=Number(game.status?.short);
 if(!Number.isSafeInteger(id)||id<=0||
    !visitors||!home||
    typeof visitors.name!=='string'||!visitors.name.trim()||
    typeof home.name!=='string'||!home.name.trim()||
    typeof start!=='string'||!Number.isFinite(Date.parse(start)))return null;
 if(!Object.hasOwn(STATES,status))return null;
 return {
  id,away:visitors.name.trim().slice(0,100),home:home.name.trim().slice(0,100),
  tipoff:start,status:STATES[status],statusCode:status,
  awayScore:status===2||status===3?numberOrNull(game.scores?.visitors?.points):null,
  homeScore:status===2||status===3?numberOrNull(game.scores?.home?.points):null,
  arena:typeof game.arena?.name==='string'?game.arena.name.slice(0,100):null
 };
}
function createNBAFeed({fetcher=fetch,now=Date.now,key=()=>process.env.NBA_API_SPORTS_KEY||process.env.API_SPORTS_KEY}={}){
 const cache=new Map(),pending=new Map();
 return async function getGames(date){
  if(!validDate(date))throw Error('Invalid NBA date');
  const season=inferSeason(date);
  const id=season+':'+date;
  if(cache.has(id)&&now()-cache.get(id).at<300000)return cache.get(id).result;
  if(pending.has(id))return pending.get(id);
  const work=(async()=>{
   const apiKey=key();
   if(!apiKey)throw Error('NBA API credential unavailable');
   const url=HOST+'/games?'+new URLSearchParams({league:'standard',season:String(season),date});
   const response=await fetcher(url,{headers:{'x-apisports-key':apiKey,Accept:'application/json'},signal:AbortSignal.timeout(12000)});
   if(!response.ok)throw Error('NBA provider returned HTTP '+response.status);
   const data=await response.json();
   if(!data||!Array.isArray(data.response)||
      (data.errors&&(Array.isArray(data.errors)?data.errors.length:Object.keys(data.errors).length)))throw Error('NBA provider response unavailable');
   // A schedule can genuinely be empty. Missing/invalid records must not become invented games.
   const games=data.response.map(normalizeGame).filter(Boolean).sort((a,b)=>Date.parse(a.tipoff)-Date.parse(b.tipoff));
   if(data.response.length&&games.length===0)throw Error('NBA provider format unrecognized');
   const result={league:'nba',season,date,checkedAt:new Date(now()).toISOString(),games,experimental:true};
   cache.set(id,{result,at:now()});
   return result;
  })();
  pending.set(id,work);
  try{return await work;}finally{pending.delete(id);}
 };
}
module.exports={createNBAFeed,normalizeGame,validDate,inferSeason};
