'use strict';
// Quotes are accepted only for an exact team pair and verified tipoff.
const {gameLines,auditPlayerLines,MARKETS}=require('./nba-odds');
const SPORT='basketball_ncaab';
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
function matches(e,g){return e?.sport_key===SPORT&&norm(e.away_team)===norm(g.away)&&norm(e.home_team)===norm(g.home)&&norm(g.away)!==norm(g.home)&&Number.isFinite(Date.parse(e.commence_time))&&Math.abs(Date.parse(e.commence_time)-Date.parse(g.tipoff))<=15*60000;}
function createMarkets({fetcher=fetch,key=()=>process.env.ODDS_API_KEY,now=Date.now}={}){
 const cache=new Map();
 async function request(path,params={}){
  const cacheKey=path+JSON.stringify(params),old=cache.get(cacheKey);if(old&&now()-old.at<300000)return old.pending;
  const pending=(async()=>{let r;try{r=await fetcher('https://api.the-odds-api.com/v4/sports/'+SPORT+'/'+path+'?'+new URLSearchParams({...params,apiKey:key().trim()}),{signal:AbortSignal.timeout(12000)});}catch{throw Error('Sportsbook feed unavailable.');}
   require('./odds-monitor').observe(r);if(!r.ok){const body=await r.json().catch(()=>null);throw require('./odds-provider-error').errorForResponse(r.status,body);}return r.json();})();
  const item={at:now(),pending};cache.set(cacheKey,item);pending.catch(()=>{if(cache.get(cacheKey)===item)cache.delete(cacheKey);});if(cache.size>200)cache.delete(cache.keys().next().value);return pending;
 }
 return async function(game,kind){
  const base={gameId:game.id,tipoff:game.tipoff,bookmaker:'FanDuel',available:false,props:[]};
  if(!game.timeKnown||game.status!=='Scheduled'||Date.parse(game.tipoff)<=now())return {...base,message:'Pregame quotes require a confirmed upcoming tipoff.'};
  if(!key()?.trim())return {...base,message:'Sportsbook connection unavailable; enter lines manually.'};
  const events=await request(kind==='props'?'events':'odds',kind==='props'?{}:{bookmakers:'fanduel',markets:'h2h,spreads,totals',oddsFormat:'american'});
  if(!Array.isArray(events))throw Error('Sportsbook event list unavailable.');const found=events.filter(e=>matches(e,game));
  if(found.length!==1)return {...base,message:'No uniquely matched FanDuel game; enter lines manually.'};
  if(kind!=='props'){const lines=gameLines(found[0],now());return {...base,...lines,available:!!(lines.moneyline||lines.spread||lines.total),message:lines.moneyline||lines.spread||lines.total?'Fresh FanDuel game lines loaded.':'No fresh FanDuel game lines available.'};}
  const e=await request('events/'+encodeURIComponent(found[0].id)+'/odds',{bookmakers:'fanduel',markets:Object.keys(MARKETS).join(','),oddsFormat:'american'});
  if(e.id!==found[0].id||!matches(e,game))throw Error('Sportsbook matchup could not be verified.');
  const {props,audit}=auditPlayerLines(e,now());return {...base,props,audit,eventId:e.id,coverage:Object.entries(MARKETS).map(([market,label])=>({market,label,lines:props.filter(p=>p.market===market).length})),available:!!props.length,message:props.length?'Fresh FanDuel player lines loaded.':'No fresh FanDuel player lines returned for this game.'};
 };
}
module.exports={matches,createMarkets};
