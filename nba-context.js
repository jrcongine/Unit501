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
 const stage=selectedGame.stage;
 if(!isId(Number(stage)))return {available:false,reason:'Selected NBA stage is unavailable; regular-season history cannot be verified.',sample:0};
 const entries=new Map();
 for(const game of raw){
  const g=normalizeGame(game);
  if(!g||g.statusCode!==3||g.stage!==stage||g.id===selectedGame.id||Date.parse(g.tipoff)>=cutoff||g.awayScore===null||g.homeScore===null)continue;
  const asVisitor=g.awayId===Number(teamId),asHome=g.homeId===Number(teamId);
  if(!asVisitor&&!asHome)continue;
  const own=asVisitor?g.awayScore:g.homeScore,opp=asVisitor?g.homeScore:g.awayScore;
  entries.set(g.id,{id:g.id,tipoff:g.tipoff,for:own,against:opp,margin:own-opp,venue:asVisitor?'away':'home'});
 }
 const prior=[...entries.values()].sort((a,b)=>Date.parse(a.tipoff)-Date.parse(b.tipoff));
 const summary=(items)=>{
  if(!items.length)return null;
  const mean=k=>round(items.reduce((sum,g)=>sum+g[k],0)/items.length);
  return {games:items.length,pointsFor:mean('for'),pointsAgainst:mean('against'),net:mean('margin'),
    wins:items.filter(g=>g.margin>0).length,losses:items.filter(g=>g.margin<0).length};
 };
 return {available:prior.length>0,sample:prior.length,season:summary(prior),
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
  if(cached&&now()-cached.at<300000)return cached.games;
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
