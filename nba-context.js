'use strict';
// NBA team form: game-level published scores BEFORE selected tipoff only.
// No football formulas, no odds, no predictions, and no postgame backfilling.
const {normalizeGame,inferSeason}=require('./nba-feed');
const HOST='https://v2.nba.api-sports.io';
const isId=n=>Number.isSafeInteger(n)&&n>0;
const round=n=>Math.round(n*10)/10;
function summarize(raw,teamId,selectedGame,season=inferSeason(selectedGame?.tipoff?.slice(0,10)||'')){
 if(!isId(Number(teamId))||!isId(Number(selectedGame?.id))||!Number.isFinite(Date.parse(selectedGame?.tipoff)))
  throw Error('Invalid NBA team/game identity');
 const cutoff=Date.parse(selectedGame.tipoff);
 const noEndBuffer=5*60*60*1000; // A game that tipped off shortly before this one may not yet have been final.
 const stage=selectedGame.stage;
 if(!isId(Number(stage)))return {available:false,reason:'Selected NBA stage is unavailable; regular-season history cannot be verified.',sample:0};
 const entries=new Map(),played=new Map(),conflicts=new Set();
 const calendarDay=iso=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(iso));
 const dayNumber=iso=>{const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(iso));const v=Object.fromEntries(parts.map(p=>[p.type,p.value]));return Date.UTC(+v.year,+v.month-1,+v.day)/86400000;};
 let unfinishedBefore=null,wrongSeason=0,invalid=0;

 for(const game of raw){
  const g=normalizeGame(game);
  if(!g){invalid++;continue;}
  if(game.league&&game.league!=='standard')continue;
  if((game.season!=null&&Number(game.season)!==season)||inferSeason(g.tipoff.slice(0,10))!==season){wrongSeason++;continue;}
  if(g.stage!==stage||g.id===Number(selectedGame.id)||Date.parse(g.tipoff)>=cutoff)continue;
  const asVisitor=g.awayId===Number(teamId),asHome=g.homeId===Number(teamId);
  if(asVisitor===asHome)continue;
  if([1,2,5].includes(g.statusCode)){
   if(!unfinishedBefore||Date.parse(g.tipoff)>Date.parse(unfinishedBefore))unfinishedBefore=g.tipoff;
   continue;
  }
  if(g.statusCode!==3)continue;
  if(g.endedAt ? Date.parse(g.endedAt)>=cutoff : Date.parse(g.tipoff)+noEndBuffer>=cutoff){
   if(!unfinishedBefore||Date.parse(g.tipoff)>Date.parse(unfinishedBefore))unfinishedBefore=g.tipoff;
   continue;
  }
  const record={id:g.id,tipoff:g.tipoff,opponent:asVisitor?g.home:g.away,opponentId:asVisitor?g.homeId:g.awayId,
   for:asVisitor?g.awayScore:g.homeScore,against:asVisitor?g.homeScore:g.awayScore,venue:asVisitor?'away':'home',arena:g.arena};
  const previous=played.get(g.id);
  if(previous&&JSON.stringify(previous)!==JSON.stringify(record)){conflicts.add(g.id);entries.delete(g.id);continue;}
  if(conflicts.has(g.id))continue;
  played.set(g.id,record);
  if(record.for===null||record.against===null)continue;
  const margin=record.for-record.against;
  entries.set(g.id,{...record,margin,result:margin>0?'W':margin<0?'L':'T'});
 }
 const prior=[...entries.values()].sort((a,b)=>Date.parse(a.tipoff)-Date.parse(b.tipoff));
 const summary=(items)=>{
  if(!items.length)return null;
  const mean=k=>round(items.reduce((sum,g)=>sum+g[k],0)/items.length);
  return {games:items.length,pointsFor:mean('for'),pointsAgainst:mean('against'),net:mean('margin'),
    wins:items.filter(g=>g.margin>0).length,losses:items.filter(g=>g.margin<0).length};
 };
 const completed=[...played.values()].filter(g=>!conflicts.has(g.id)).sort((a,b)=>Date.parse(a.tipoff)-Date.parse(b.tipoff));
 const previous=completed.at(-1);
 const uncertain=unfinishedBefore&&(!previous||Date.parse(unfinishedBefore)>=Date.parse(previous.tipoff));
 let rest={available:false,reason:uncertain?'A more recent game was not verified finished before tipoff.':'No earlier completed same-stage game is available.'};
 if(previous&&!uncertain&&!conflicts.size){
  const days=dayNumber(selectedGame.tipoff)-dayNumber(previous.tipoff);
  const seven=completed.filter(g=>cutoff-Date.parse(g.tipoff)<=7*86400000).length;
  const four=completed.filter(g=>dayNumber(selectedGame.tipoff)-dayNumber(g.tipoff)<=3).length;
  rest={available:true,previousTipoff:previous.tipoff,previousDate:calendarDay(previous.tipoff),gapHours:round((cutoff-Date.parse(previous.tipoff))/3600000),
   calendarDays:days,fullDaysOff:Math.max(0,days-1),backToBack:days===1,sameDay:days===0,gamesLast7Days:seven,threeInFour:four>=2,
   note:'Calendar days use Central Time; rest context does not measure travel or player minutes.'};
  const currentVenue=Number(teamId)===selectedGame.awayId?'away':'home';
  const preceding=[...completed].reverse();let consecutive=0;
  for(const item of preceding){if(item.venue!==currentVenue)break;consecutive++;}
  rest.schedule={previous:previous.venue,current:currentVenue,consecutive:consecutive+1,
   minimum:consecutive===completed.length,previousArena:previous.arena||null,currentArena:selectedGame.arena||null};
 }else if(conflicts.size)rest={available:false,reason:'Conflicting game records prevent a reliable rest comparison.'};
 return {available:prior.length>0,sample:prior.length,season:summary(prior),
   recent5:summary(prior.slice(-5)),recent10:summary(prior.slice(-10)),
   homeSplit:summary(prior.filter(g=>g.venue==='home')),awaySplit:summary(prior.filter(g=>g.venue==='away')),
   recentGames:prior.slice(-10).reverse(),rest,
   coverage:{received:raw.length,eligible:prior.length,conflictingGames:conflicts.size,wrongSeason,invalid,unverifiedGames:completed.filter(g=>g.for===null||g.against===null).length,complete:false,
    note:'Counts describe the returned history; a full league schedule has not been independently verified.'},
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
  const away=summarize(visitor,selectedGame.awayId,selectedGame,season);
  const home=summarize(host,selectedGame.homeId,selectedGame,season);
  return {gameId:selectedGame.id,season,stage:selectedGame.stage,tipoff:selectedGame.tipoff,
    available:away.available&&home.available,
    message:away.available&&home.available?'NBA matchup form, venue splits and rest context. Descriptive history; no score projections yet.':
      'At least one team has no completed games in this stage before tipoff. Estimates withheld.',
    away:{name:selectedGame.away,id:selectedGame.awayId,...away},
    home:{name:selectedGame.home,id:selectedGame.homeId,...home},
    checkedAt:new Date(now()).toISOString()};
 };
}
module.exports={createNBAContext,summarize};
