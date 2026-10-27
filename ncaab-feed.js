'use strict';
// Men's college basketball public schedule and strictly pregame team form.
const ROOT='https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball';
const validDate=require('./nba-feed').validDate;
const number=v=>{const x=typeof v==='object'&&v!==null?v.value:v;return x!==null&&x!==undefined&&x!==''&&Number.isFinite(Number(x))&&Number(x)>=0?Number(x):null;};
function convert(e){
 if(!e||!/^\d{1,12}$/.test(String(e.id||''))||!Array.isArray(e.competitions)||e.competitions.length!==1)return null;
 const c=e.competitions[0],teams=c.competitors||[],away=teams.filter(t=>t.homeAway==='away'),home=teams.filter(t=>t.homeAway==='home');
 if(teams.length!==2||away.length!==1||home.length!==1)return null;
 const a=away[0],h=home[0],tipoff=c.date||e.date,type=c.status?.type||e.status?.type;
 const status=/POSTPONED/.test(type?.name||'')?'Postponed':/CANCEL/.test(type?.name||'')?'Canceled':type?.completed===true&&type.state==='post'?'Final':type?.state==='in'?'Live':type?.state==='pre'?'Scheduled':null;
 const stage=Number(e.seasonType?.type??e.season?.type),season=Number(e.season?.year);
 if(!status||![1,2,3].includes(stage)||!Number.isInteger(season)||!Number.isFinite(Date.parse(tipoff))||!/^\d{1,12}$/.test(String(a.team?.id||''))||!/^\d{1,12}$/.test(String(h.team?.id||''))||String(a.team.id)===String(h.team.id)||!a.team.displayName||!h.team.displayName)return null;
 return {id:String(e.id),awayId:String(a.team.id),homeId:String(h.team.id),away:a.team.displayName,home:h.team.displayName,tipoff,status,stage,season,
  timeKnown:(c.timeValid===true||e.timeValid===true)&&c.timeValid!==false&&e.timeValid!==false,neutral:c.neutralSite===true,venue:c.venue?.fullName||null,
  awayScore:status==='Final'||status==='Live'?number(a.score):null,homeScore:status==='Final'||status==='Live'?number(h.score):null};
}
function summarize(rows,id,selected,now=Date.now()){
 const cutoff=Math.min(Date.parse(selected.tipoff),now),entries=new Map(),conflicts=new Set();
 for(const row of rows){
  const g=convert(row);if(!g||g.season!==selected.season||g.stage!==2||g.status!=='Final'||g.id===selected.id||!g.timeKnown||Date.parse(g.tipoff)+5*3600000>=cutoff||g.awayScore===null||g.homeScore===null)continue;
  const away=g.awayId===id,home=g.homeId===id;if(away===home)continue;
  const item={id:g.id,tipoff:g.tipoff,opponent:away?g.home:g.away,opponentId:away?g.homeId:g.awayId,scored:away?g.awayScore:g.homeScore,allowed:away?g.homeScore:g.awayScore,venue:g.neutral?'neutral':away?'away':'home'};
  const old=entries.get(g.id);if(old&&JSON.stringify(old)!==JSON.stringify(item)){conflicts.add(g.id);entries.delete(g.id);continue;}
  if(!conflicts.has(g.id))entries.set(g.id,item);
 }
 const games=[...entries.values()].sort((a,b)=>Date.parse(b.tipoff)-Date.parse(a.tipoff));
 const summary=list=>list.length?{games:list.length,scored:list.reduce((s,g)=>s+g.scored,0)/list.length,allowed:list.reduce((s,g)=>s+g.allowed,0)/list.length,wins:list.filter(g=>g.scored>g.allowed).length,losses:list.filter(g=>g.scored<g.allowed).length}:null;
 return {games:games.length,season:summary(games),recent5:summary(games.slice(0,5)),recent10:summary(games.slice(0,10)),home:summary(games.filter(g=>g.venue==='home')),away:summary(games.filter(g=>g.venue==='away')),recentGames:games.slice(0,10),conflicts:conflicts.size};
}
function createNCAAB({fetcher=fetch,now=Date.now}={}){
 const cache=new Map();
 async function read(path,ttl){const old=cache.get(path);if(old&&now()-old.at<ttl)return old.pending;
  const entry={at:now()};entry.pending=(async()=>{const r=await fetcher(ROOT+path,{signal:AbortSignal.timeout(12000),redirect:'error'});if(!r.ok||Number(r.headers?.get?.('content-length')||0)>8000000)throw Error('College basketball source unavailable');const d=await r.json();if(!Array.isArray(d.events)||d.events.length>600)throw Error('College basketball response invalid');return d;})();cache.set(path,entry);if(cache.size>200)cache.delete(cache.keys().next().value);entry.pending.catch(()=>{if(cache.get(path)===entry)cache.delete(path);});return entry.pending;}
 async function games(date){
  if(!validDate(date))throw Error('Invalid date');
  const next=new Date(date+'T00:00:00Z');next.setUTCDate(next.getUTCDate()+1);const nextDate=next.toISOString().slice(0,10);
  const paths=[date,nextDate].map(d=>'/scoreboard?dates='+d.replace(/-/g,'')+'&groups=50&limit=500');
  const sources=await Promise.all(paths.map(p=>read(p,60000)));
  if(sources.some(s=>!s.leagues?.some(l=>l.slug==='mens-college-basketball'||l.abbreviation==='NCAAM')))throw Error('College basketball league unverified');
  const output=new Map(),day=at=>{const p=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(at)).map(x=>[x.type,x.value]));return p.year+'-'+p.month+'-'+p.day;};
  for(let i=0;i<sources.length;i++)for(const e of sources[i].events){const g=convert(e);if(!g||(!g.timeKnown?i!==0:day(g.tipoff)!==date))continue;
   const old=output.get(g.id);if(old&&JSON.stringify(old)!==JSON.stringify(g))throw Error('Conflicting college basketball game');output.set(g.id,g);}
  return {date,league:'ncaab',source:'ESPN men’s college basketball',games:[...output.values()].sort((a,b)=>Number(!a.timeKnown)-Number(!b.timeKnown)||Date.parse(a.tipoff)-Date.parse(b.tipoff))};
 }
 async function context(game){
  if(!game?.timeKnown||!Number.isFinite(Date.parse(game.tipoff))||game.stage!==2)throw Error('Verified regular-season tipoff required');
  const sides=await Promise.all([game.awayId,game.homeId].map(async id=>{
   const d=await read('/teams/'+id+'/schedule?season='+game.season+'&seasontype=2',300000);
   if(String(d.team?.id)!==id)throw Error('College basketball team identity unavailable');
   return {id,...summarize(d.events,id,game,now())};
  }));
  return {gameId:game.id,tipoff:game.tipoff,away:{name:game.away,...sides[0]},home:{name:game.home,...sides[1]},source:'ESPN completed men’s college games'};
 }
 return {games,context};
}
module.exports={convert,summarize,createNCAAB};
