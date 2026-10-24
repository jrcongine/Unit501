'use strict';
// Public ESPN NBA source, with its own identifiers and end-year season convention.
const {normalizeGame,validDate,inferSeason}=require('./nba-feed');
const {summarize}=require('./nba-context');
const ROOT='https://site.api.espn.com/apis/site/v2/sports/basketball/nba';
const day=at=>{const p=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(at)).map(p=>[p.type,p.value]));return p.year+'-'+p.month+'-'+p.day;};
const score=value=>{const v=typeof value==='object'&&value!==null?value.value:value;if(v===null||v===undefined||v==='')return null;const n=Number(v);return Number.isInteger(n)&&n>=0?n:null;};
function convert(event,season,defaultStage=null){
 if(Number(event?.season?.year)!==season+1||!Array.isArray(event.competitions)||event.competitions.length!==1)return null;
 const c=event.competitions[0],rows=c.competitors||[];
 const away=rows.filter(t=>t.homeAway==='away'),home=rows.filter(t=>t.homeAway==='home');
 if(rows.length!==2||away.length!==1||home.length!==1)return null;
 const a=away[0],h=home[0],status=c.status||event.status,type=status?.type;
 const stage=Number(event.season.type??defaultStage);
 const code=/POSTPONED/.test(type?.name||'')?4:/CANCELED|CANCELLED/.test(type?.name||'')?6:/DELAYED/.test(type?.name||'')?5:
  type?.completed===true&&type.state==='post'&&/FINAL/.test(type.name)?3:type?.state==='in'?2:type?.state==='pre'?1:null;
 if(!code||![1,2,3].includes(stage)||!Number.isSafeInteger(Number(a.team?.id))||Number(a.team.id)<=0||!Number.isSafeInteger(Number(h.team?.id))||Number(h.team.id)<=0||Number(a.team.id)===Number(h.team.id))return null;
 const raw={id:Number(event.id),league:'standard',season,stage,date:{start:c.date||event.date},status:{short:code},
  teams:{visitors:{id:Number(a.team.id),name:a.team.displayName},home:{id:Number(h.team.id),name:h.team.displayName}},
  scores:{visitors:{points:code===2||code===3?score(a.score):null},home:{points:code===2||code===3?score(h.score):null}},
  periods:{current:Number(status.period),halftime:/HALFTIME/.test(type?.name||'')},arena:{name:c.venue?.fullName}};
 return normalizeGame(raw)?raw:null;
}
function createPublicNBA({fetcher=fetch,now=Date.now}={}){
 const cache=new Map();
 async function read(path,ttl){
  const old=cache.get(path);if(old&&now()-old.at<ttl)return old.pending;
  const pending=(async()=>{const r=await fetcher(ROOT+path,{signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('Public NBA source unavailable.');const data=await r.json();if(!Array.isArray(data?.events)||data.events.length>300)throw Error('Public NBA event list was invalid.');return data;})();
  cache.set(path,{at:now(),pending});pending.catch(()=>{if(cache.get(path)?.pending===pending)cache.delete(path);});if(cache.size>200)cache.delete(cache.keys().next().value);return pending;
 }
 async function games(date){
  if(!validDate(date))throw Error('Invalid NBA date.');
  const season=inferSeason(date),data=await read('/scoreboard?dates='+date.replace(/-/g,'')+'&limit=1000',60000);
  if(!data.leagues?.some(l=>l.slug==='nba'||l.abbreviation==='NBA'))throw Error('Public source league could not be verified.');
  const raw=data.events.map(e=>convert(e,season)).filter(Boolean),all=raw.map(normalizeGame).filter(g=>day(g.tipoff)===date),unique=new Map();
  for(const g of all){if(unique.has(g.id)&&JSON.stringify(unique.get(g.id))!==JSON.stringify(g))throw Error('Public NBA schedule contains conflicting game IDs.');unique.set(g.id,g);}
  if(data.events.length&&!raw.length)throw Error('Public NBA game format or season could not be verified.');
  return {league:'nba',season,date,checkedAt:new Date(now()).toISOString(),provider:'espn',source:'ESPN public NBA feed',experimental:true,
   games:[...unique.values()].map(g=>({...g,provider:'espn',source:'ESPN public NBA feed'})).sort((a,b)=>Date.parse(a.tipoff)-Date.parse(b.tipoff))};
 }
 async function context(game,season){
  if(game?.provider!=='espn'||!Number.isInteger(season)||![1,2,3].includes(game.stage))throw Error('Public NBA game identity required.');
  const sides=await Promise.all([game.awayId,game.homeId].map(async id=>{
   if(!Number.isSafeInteger(id)||id<=0)throw Error('Public NBA team identity required.');
   const data=await read('/teams/'+id+'/schedule?season='+(season+1)+'&seasontype='+game.stage,300000);
   if(Number(data.team?.id)!==id||Number(data.season?.year)!==season+1||Number(data.season?.type)!==game.stage)throw Error('Public NBA team season could not be verified.');
   const raw=data.events.map(e=>convert(e,season,game.stage)).filter(Boolean);
   if(data.events.length&&!raw.length)throw Error('Public NBA history format could not be verified.');
   return {id,...summarize(raw,id,game,season)};
  }));
  return {gameId:game.id,tipoff:game.tipoff,season,stage:game.stage,provider:'espn',source:'ESPN public NBA feed',
   available:sides.every(s=>s.available),away:{...sides[0],name:game.away},home:{...sides[1],name:game.home},checkedAt:new Date(now()).toISOString(),
   message:'Public NBA history: same-stage games before tipoff only. Small or missing samples remain labeled; no score projections.'};
 }
 return {games,context};
}
function createNBASources({primaryGames,primaryContext,publicFeed,now=Date.now}){
 let retryAt=0;
 return {
  async games(date){
   if(!validDate(date))throw Error('Invalid NBA date.');
   if(now()>=retryAt){try{const slate=await primaryGames(date);return {...slate,provider:'api-nba',source:'API-NBA',games:slate.games.map(g=>({...g,provider:'api-nba'}))};}catch(error){retryAt=now()+(error.code==='NBA_PLAN_ACCESS'?3600000:300000);}}
   try{return {...await publicFeed.games(date),fallback:true,fallbackReason:'Configured NBA feed unavailable; using the public NBA source.'};}
   catch{throw Error('Both configured and public NBA schedules are unavailable. Try again shortly.');}
  },
  context(game,season){if(game.provider==='espn')return publicFeed.context(game,season);if(game.provider==='api-nba')return primaryContext(game,season);throw Error('NBA provider identity is missing. Reload the slate.');}
 };
}
module.exports={createPublicNBA,createNBASources,convert};
