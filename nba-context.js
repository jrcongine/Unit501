'use strict';
// NBA team form: game-level published scores BEFORE selected tipoff only.
// No football formulas, no odds, no predictions, and no postgame backfilling.
const {normalizeGame}=require('./nba-feed');
const HOST='https://v2.nba.api-sports.io';
const isId=n=>Number.isSafeInteger(n)&&n>0;
const round=n=>Math.round(n*10)/10;
function summarize(raw,teamId,selectedGame){
 if(!isId(Number(teamId))||!isId(Number(selectedGame?.id))||!Number.isFinite(Date.parse(selectedGame?.tipoff)))
  throw Error('Invalid NBA team/game identity');
 const cutoff=Date.parse(selectedGame.tipoff);
 const noEndBuffer=5*60*60*1000; // A game that tipped off shortly before this one may not yet have been final.
 const stage=selectedGame.stage;
 if(!isId(Number(stage)))return {available:false,reason:'Selected NBA stage is unavailable; regular-season history cannot be verified.',sample:0};
 const entries=new Map();
 for(const game of raw){
  const g=normalizeGame(game);
  if(!g||g.statusCode!==3||g.stage!==stage||g.id===selectedGame.id||Date.parse(g.tipoff)>=cutoff||g.awayScore===null||g.homeScore===null)continue;
  // Historical responses are fetched later; never leak a late-finishing game into an earlier pregame review.
  if(g.endedAt ? Date.parse(g.endedAt)>=cutoff : Date.parse(g.tipoff)+noEndBuffer>=cutoff)continue;
  const asVisitor=g.awayId===Number(teamId),asHome=g.homeId===Number(teamId);
  if(!asVisitor&&!asHome)continue;
  const own=asVisitor?g.awayScore:g.homeScore,opp=asVisitor?g.homeScore:g.awayScore;
  entries.set(g.id,{id:g.id,tipoff:g.tipoff,for:own,against:opp,margin:own-opp,venue:asVisitor?'away':'home',opponent:asVisitor?g.home:g.away});
 }
 const prior=[...entries.values()].sort((a,b)=>Date.parse(a.tipoff)-Date.parse(b.tipoff));
 const summary=(items)=>{
  if(!items.length)return null;
  const mean=k=>round(items.reduce((sum,g)=>sum+g[k],0)/items.length);
  return {games:items.length,pointsFor:mean('for'),pointsAgainst:mean('against'),net:mean('margin'),
    wins:items.filter(g=>g.margin>0).length,losses:items.filter(g=>g.margin<0).length};
 };
 const last=prior.at(-1);
 // Calendar-day gaps use the NBA schedule’s US Central display convention,
 // not elapsed 24-hour blocks (late tipoffs and DST would mislabel back-to-backs).
 const day=value=>{const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(value));
  const get=t=>parts.find(p=>p.type===t).value;return Date.UTC(Number(get('year')),Number(get('month'))-1,Number(get('day')));};
 const gap=last?Math.round((day(cutoff)-day(last.tipoff))/86400000):null;
 return {available:prior.length>0,sample:prior.length,season:summary(prior),
   home:summary(prior.filter(g=>g.venue==='home')),away:summary(prior.filter(g=>g.venue==='away')),
   recentResults:prior.slice(-10).reverse(),
   schedule: {hoursSincePreviousTipoff:last?round((cutoff-Date.parse(last.tipoff))/3600000):null,
     daysOff:gap===null?null:Math.max(0,gap-1),backToBack:gap===null?null:gap===1,
     gamesInPrevious7Days:prior.filter(g=>Date.parse(g.tipoff)>=cutoff-7*86400000).length,
     basis:'Completed same-stage games returned by provider; not verified physical recovery or complete schedule coverage.'},
   recent5:summary(prior.slice(-5)),recent10:summary(prior.slice(-10)),
   lastPlayedAt:prior.at(-1)?.tipoff||null,
   sampleLabel:prior.length===0?'No completed same-stage games before tipoff':
     prior.length<5?'Thin sample — early season':prior.length<10?'Developing sample':'10+ games available',
   note:'Only completed games from the selected NBA stage, strictly before this matchup. No inferred injuries, pace or odds.'};
}
function createNBAContext({fetcher=fetch,key=()=>process.env.NBA_API_SPORTS_KEY||process.env.API_SPORTS_KEY,now=Date.now}={}){
 const cache=new Map(),pending=new Map();
 async function teamGames(id,season){
  if(!isId(id)||!Number.isInteger(season)||season<2000||season>2100)throw Error('Invalid NBA team season');
  const ck=season+':'+id;
  const cached=cache.get(ck);
  if(cached&&now()-cached.at<3600000)return cached.games;
  if(pending.has(ck))return pending.get(ck);
  const task=(async()=>{
    const apiKey=key();
    if(!apiKey)throw Error('NBA API credential unavailable');
    const url=HOST+'/games?'+new URLSearchParams({league:'standard',season:String(season),team:String(id)});
    const resp=await fetcher(url,{headers:{'x-apisports-key':apiKey,Accept:'application/json'},signal:AbortSignal.timeout(12000)});
    if(!resp.ok)throw Error('NBA history unavailable');
    if(Number(resp.headers?.get?.('content-length')||0)>3000000)throw Error('NBA history response too large');
    const result=await resp.json();
    if(!result||!Array.isArray(result.response)||
      (result.errors&&(Array.isArray(result.errors)?result.errors.length:Object.keys(result.errors).length))||
      Number(result.paging?.total||1)>1)throw Error('NBA history incomplete');
    if(result.response.length>200)throw Error('NBA history response too large');
    cache.set(ck,{at:now(),games:result.response});
    if(cache.size>200)cache.delete(cache.keys().next().value);
    return result.response;
  })();
  pending.set(ck,task);
  try{return await task;}finally{pending.delete(ck);}
 }
 return async function context(selectedGame,season){
  if(!selectedGame||!isId(selectedGame.awayId)||!isId(selectedGame.homeId)||
    selectedGame.awayId===selectedGame.homeId||!isId(selectedGame.id)||
    !Number.isFinite(Date.parse(selectedGame.tipoff))||!Number.isInteger(season))
    throw Error('NBA matchup identifiers unavailable');
  if(!isId(selectedGame.stage))
    return {available:false,reason:'Selected game stage is not identified. Cannot safely compare team records.',away:null,home:null};
  const [visitor,host]=await Promise.all([teamGames(selectedGame.awayId,season),teamGames(selectedGame.homeId,season)]);
  const away=summarize(visitor,selectedGame.awayId,selectedGame);
  const home=summarize(host,selectedGame.homeId,selectedGame);
  return {gameId:selectedGame.id,season,stage:selectedGame.stage,tipoff:selectedGame.tipoff,
    available:away.available&&home.available,
    message:away.available&&home.available?'Historical NBA team scoring comparison; no projections yet.':
      'At least one team has no completed games in this stage before tipoff. Estimates withheld.',
    away:{name:selectedGame.away,id:selectedGame.awayId,...away},
    home:{name:selectedGame.home,id:selectedGame.homeId,...home},
    checkedAt:new Date(now()).toISOString()};
 };
}
module.exports={createNBAContext,summarize};
