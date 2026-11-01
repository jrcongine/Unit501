'use strict';
const {gameQuotes}=require('./game-quotes');
const football=require('./odds-matching'),nba=require('./nba-odds'),college=require('./ncaab-markets');
const sports={...require('./fanduel').sports,nba:'basketball_nba',ncaab:'basketball_ncaab'};
const price=n=>Number.isSafeInteger(n)&&Math.abs(n)>=100;
function compareHook(event,now){
 const main=gameQuotes(event,now).spread;
 if(!main)return [];
 const book=event.bookmakers.find(b=>b.key==='fanduel');
 const markets=book.markets.filter(m=>m.key==='alternate_spreads');
 if(markets.length!==1)return [];
 const market=markets[0],at=Date.parse(market.last_update||book.last_update);
 if(!Number.isFinite(at)||at>now||now-at>=1800000||main.updatedAt>now||Math.abs(main.updatedAt-at)>300000||!Array.isArray(market.outcomes))return [];
 const result=[];
 for(const side of ['away','home']){
  const team=event[side+'_team'],other=event[(side==='away'?'home':'away')+'_team'];
  const line=main[side],better=line+0.5;
  const matches=(name,point)=>market.outcomes.filter(o=>o?.name===name&&o.point===point);
  const rows=matches(team,better),opposite=matches(other,-better);
  if(rows.length!==1||opposite.length!==1||!price(rows[0].price)||!price(opposite[0].price))continue;
  result.push({team,line,price:main[side+'Price'],better,alternatePrice:rows[0].price,updatedAt:Math.min(at,main.updatedAt)});
 }
 return result;
}
function createHook({fetcher=fetch,key=()=>process.env.ODDS_API_KEY,now=Date.now}={}){
 const cache=new Map();
 function read(path,params){
  const id=path+JSON.stringify(params),old=cache.get(id);
  if(old&&now()-old.at<60000)return old.pending;
  const pending=(async()=>{
   const r=await fetcher('https://api.the-odds-api.com/v4/sports/'+path+'?'+new URLSearchParams({...params,apiKey:key()}),{signal:AbortSignal.timeout(10000)});
   require('./odds-monitor').observe(r);
   if(!r.ok)throw Error('FanDuel quote request unavailable.');
   return r.json();
  })();
  const entry={at:now(),pending};cache.set(id,entry);
  pending.catch(()=>{if(cache.get(id)===entry)cache.delete(id);});
  if(cache.size>160)cache.delete(cache.keys().next().value);
  return pending;
 }
 return async function(q){
  const sport=sports[q.league],time=Date.parse(q.tipoff);
  if(!sport||!key()?.trim()||!Number.isFinite(time)||time<=now())return [];
  function matches(e){
   if(e?.sport_key!==sport||Date.parse(e.commence_time)<=now()||Math.abs(Date.parse(e.commence_time)-time)>900000)return false;
   if(q.league==='nba')return nba.matches(e,q);
   if(q.league==='ncaab')return college.matches(e,q);
   return football.matches(e,{...q,kickoff:time});
  }
  const events=await read(sport+'/events',{}),found=Array.isArray(events)?events.filter(matches):[];
  if(found.length!==1||typeof found[0].id!=='string'||!found[0].id)return [];
  const id=found[0].id;
  const e=await read(sport+'/events/'+encodeURIComponent(id)+'/odds',{bookmakers:'fanduel',markets:'spreads,alternate_spreads',oddsFormat:'american'});
  if(e?.id!==id||!matches(e)||time<=now())return [];
  return compareHook(q.league==='ncaab'?college.alignEvent(e,q):e,now());
 };
}
module.exports={compareHook,createHook};
