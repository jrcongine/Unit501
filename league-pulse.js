'use strict';
// Original UNIT 501 league pulse. ESPN supplies public standings and article-link metadata.
// No articles are republished; usage/licensing must be reviewed before commercial release.
// Display-only: these scores NEVER feed prediction, odds or player availability logic.
const fbs=require('./fbs-2026.json');
const ROOT='https://site.web.api.espn.com/apis/v2/sports/';
const NEWS='https://site.api.espn.com/apis/site/v2/sports/';
const LEAGUES=Object.freeze({
 nfl:{name:'NFL',sport:'football/nfl',teams:32,scale:16},
 ncaaf:{name:'College football · FBS',sport:'football/college-football',teams:fbs.teams.length,scale:30},
 nba:{name:'NBA',sport:'basketball/nba',teams:30,scale:18},
 ncaab:{name:'College basketball',sport:'basketball/mens-college-basketball',poll:true},
 mlb:{name:'MLB',sport:'baseball/mlb',teams:30,scale:3},
 nhl:{name:'NHL',sport:'hockey/nhl',teams:32,scale:2.5}
});
const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const fbsNames=new Map(fbs.teams.flatMap(team=>team.aliases.map(alias=>[normalize(alias),team.name])));
function seasonYear(league,when){
 const d=new Date(when),year=d.getUTCFullYear(),month=d.getUTCMonth();
 if(league==='nba'||league==='nhl'||league==='ncaab')return month>=6?year+1:year;
 if(league==='nfl'||league==='ncaaf')return month<2?year-1:year;
 return month<2?year-1:year;
}
function stat(entries,name){
 const matching=(entries||[]).filter(s=>s?.name===name);
 const x=matching[0]?.value;
 return typeof x==='number'&&Number.isFinite(x)?x:null;
}
function textStat(entries,name){
 const matching=(entries||[]).filter(s=>s?.name===name);
 return matching[0]?.displayValue||'';
}
function getEntries(data){
 const found=[];
 function visit(node,depth){
  if(!node||typeof node!=='object'||depth>6)return;
  if(Array.isArray(node.standings?.entries))found.push(...node.standings.entries);
  if(Array.isArray(node.children))for(const child of node.children)visit(child,depth+1);
 }
 visit(data,0);
 return found;
}
function buildPowerBoard(raw,league,year,at){
 const config=Object.hasOwn(LEAGUES,league)?LEAGUES[league]:null;if(!config||!raw||typeof raw!=='object')return null;
 if(raw.season?.year!=null&&Number(raw.season.year)!==Number(year))return null;
 const entries=getEntries(raw);
 if(entries.length<config.teams)return null;
 const teams=new Map(),seenNames=new Set();
 for(const entry of entries){
  const t=entry?.team,stats=entry?.stats;
  if(!t||!Array.isArray(stats)||!String(t.id||'').trim())continue;
  const name=String(t.displayName||t.name||'').trim();
  const key=league==='ncaaf'?fbsNames.get(normalize(name)):name;
  if(!key||!normalize(key))continue;
  const id=String(t.id);
  const overall=/^(\d+)-(\d+)(?:-(\d+))?$/.exec(String(textStat(stats,'overall')));
  const wins=stat(stats,'wins');
  const reportedLosses=stat(stats,'losses');
  const losses=reportedLosses!==null?reportedLosses:
    league==='ncaaf'&&overall&&Number(overall[1])===wins?Number(overall[2]):null;
  const ot=league==='nhl'?(stat(stats,'otLosses')??stat(stats,'overtimeLosses')??0):0;
  const ties=league==='nfl'?(stat(stats,'ties')??0):0;
  const played=wins+losses+ot+ties;
  const pointsFor=stat(stats,'pointsFor'),pointsAgainst=stat(stats,'pointsAgainst');
  const diff=stat(stats,'pointDifferential');
  const officialGames=stat(stats,'gamesPlayed');
  if(!Number.isInteger(wins)||!Number.isInteger(losses)||wins<0||losses<0||
    !Number.isInteger(ot)||ot<0||!Number.isInteger(ties)||ties<0||
    !Number.isInteger(played)||played<1||played>190||
    (officialGames!==null&&Math.abs(officialGames-played)>0)||
    !Number.isFinite(pointsFor)||!Number.isFinite(pointsAgainst)||
    !Number.isFinite(diff)||Math.abs((pointsFor-pointsAgainst)-diff)>1.001)continue;
  // For teams appearing in multiple standings groups, the same season record must agree.
  const previous=teams.get(id);
  if(previous){
   if(previous.name!==key||previous.games!==played||previous.diff!==diff||
      previous.wins!==wins||previous.losses!==losses||previous.record!==
        (league==='nhl'?wins+'-'+losses+'-'+ot:wins+'-'+losses+(ties?'-'+ties:''))||
      previous.pointsFor!==pointsFor||previous.pointsAgainst!==pointsAgainst)return null;
   continue;
  }
  if(seenNames.has(normalize(key)))return null;
  seenNames.add(normalize(key));
  const quality=league==='nhl'?(2*wins+ot)/(2*played):(wins+ties*0.5)/played;
  const margin=diff/played;
  const score=Math.round(Math.max(0,Math.min(100,100*(.55*quality+.45*(.5+Math.max(-1,Math.min(1,margin/config.scale))*.5))))*10)/10;
  const streak=stat(stats,'streak')??0;
  const trend=played<3?'flat':streak>=2?'up':streak<=-2?'down':'flat';
  const trendLabel=trend==='up'?'Ascending':trend==='down'?'Declining':'Steady';
  const record=league==='nhl'?wins+'-'+losses+'-'+ot:wins+'-'+losses+(ties?'-'+ties:'');
  teams.set(id,{id,name:key,providerName:name,record,games:played,wins,losses,margin:+margin.toFixed(2),
    score,trend,trendLabel,streak:Number.isInteger(streak)?streak:0,
    streakLabel:String(textStat(stats,'streak')).slice(0,10),diff,pointsFor,pointsAgainst});
 }
 if(teams.size!==config.teams)return null;
 const sorted=[...teams.values()].sort((a,b)=>b.score-a.score||b.margin-a.margin||b.wins-a.wins||a.name.localeCompare(b.name));
 sorted.forEach((t,i)=>{t.rank=i+1;});
 return {league,season:year,asOf:new Date(at).toISOString(),available:true,source:'ESPN',
  provider:'ESPN standings',metric:'UNIT 501 Power Index · 55% season results + 45% scoring margin; relative to league-specific scale',
  trendNote:'↑/↓/→ show current win/loss streak momentum (2+ games), not changes in ranking position.',
  basis:league==='mlb'?'Regular-season standings; does not include postseason results.':'Current season standings; display only, not a betting projection.',
  count:sorted.length,top:sorted.slice(0,10),middle:sorted.slice(10,-10),bottom:sorted.slice(-10),
  teams:sorted};
}
function buildCollegePoll(raw,year,now){
 const polls=(raw?.rankings||[]).filter(r=>r.type==='ap'&&Number(r.season?.year)===Number(year));
 if(polls.length!==1)return null;
 const poll=polls[0],at=Date.parse(poll.date),ranks=poll.ranks;
 if(!Number.isFinite(at)||at>now||now-at>45*86400000||!Array.isArray(ranks)||ranks.length<25||ranks.length>30)return null;
 const teams=[],seen=new Set();
 for(const r of ranks){
  const id=String(r.team?.id||''),name=r.team?.displayName||[r.team?.location,r.team?.name].filter(Boolean).join(' ');
  if(!/^\d{1,7}$/.test(id)||seen.has(id)||!name||!Number.isInteger(r.current)||r.current<1||r.current>25||!Number.isFinite(r.points)||r.points<0)return null;
  seen.add(id);teams.push({id,name,rank:r.current,points:r.points});
 }
 teams.sort((a,b)=>a.rank-b.rank);
 if(teams[0].rank!==1||teams.at(-1).rank!==25)return null;
 for(let i=1;i<teams.length;i++)if(teams[i].rank!==i+1&&!(teams[i].rank===teams[i-1].rank&&teams[i].points===teams[i-1].points))return null;
 return {available:true,kind:'poll',league:'ncaab',season:year,seasonLabel:poll.season.displayName||String(year),asOf:new Date(at).toISOString(),provider:'AP poll via ESPN',metric:'AP Top 25',count:teams.length,teams,
  basis:'Published AP Top 25 ('+String(poll.occurrence?.displayValue||'current poll')+'). Poll votes, not a UNIT 501 power index or a betting projection.'};
}
function articleLink(value){
 try{
  const u=new URL(value);
  if(!['https:','http:'].includes(u.protocol)||!/(^|\.)espn\.com$/.test(u.hostname))return null;
  u.protocol='https:';return u.href;
 }catch{return null;}
}
function parseHeadlines(data,league,now){
 if(!Object.hasOwn(LEAGUES,league)||!Array.isArray(data?.articles))return [];
 const seen=new Set(),articles=[];
 for(const item of data.articles){
  const title=String(item?.headline||'').replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim();
  const publishedAt=Date.parse(item?.published||'');
  const link=articleLink(item?.links?.web?.href);
  if(!title||title.length>240||!Number.isFinite(publishedAt)||!link||publishedAt>now+300000||now-publishedAt>7*86400000)continue;
  if(seen.has(link))continue;seen.add(link);
  const category=/injur|ankle|hamstring|knee|concussion|questionable|out for|sidelined/i.test(title)?'Injury report':
    /coach|fired|hot seat|front office|general manager/i.test(title)?'Coaching':
    /trade|signs|extension|contract|transfers|portal/i.test(title)?'Roster move':'League update';
  articles.push({title,url:link,source:'ESPN',publishedAt:new Date(publishedAt).toISOString(),category,
    premium:item?.premium===true});
 }
 return articles.sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt)).slice(0,8);
}
function createLeaguePulse({request,collegeSchedule,now=Date.now,ttl=15*60000}={}){
 const fetchJSON=request||(async url=>{
  const response=await fetch(url,{signal:AbortSignal.timeout(12000),headers:{Accept:'application/json'}});
  if(!response.ok)throw Error('Public source unavailable');
  const len=Number(response.headers?.get('content-length')||0);
  if(len>5*1024*1024)throw Error('Public response too large');
  return response.json();
 });
 const cache=new Map();
 async function resource(key,url,format,age,fetcher=fetchJSON,retryDelay=Math.min(60000,age)){
  const last=cache.get(key),current=now();
  if(last&&current-last.at<age)return last.pending;
  const item={at:current};
  item.pending=Promise.resolve().then(()=>fetcher(url)).then(data=>format(data,current)).catch(()=>{
   // Public sources retry after one minute; the metered college schedule
   // waits its full cache interval. Never relabel an old snapshot as current.
   item.at=now()-age+retryDelay;
   return null;
  });
  cache.set(key,item);
  if(cache.size>30)cache.delete(cache.keys().next().value);
  return item.pending;
 }
 return async function pulse(league){
  const config=Object.hasOwn(LEAGUES,league)?LEAGUES[league]:null;
  if(!config)return null;
  const year=seasonYear(league,now());
  const standingsURL=config.poll?NEWS+config.sport+'/rankings?season='+year:ROOT+config.sport+'/standings?season='+year+(league==='ncaaf'?'&level=2':'');
  const headlinesURL=NEWS+config.sport+'/news?limit=18';
  const [power,news]=await Promise.all([
   resource('power:'+league+':'+year,standingsURL,(data,when)=>config.poll?buildCollegePoll(data,year,when):buildPowerBoard(data,league,year,when),ttl),
   resource('news:'+league,headlinesURL,(data,when)=>parseHeadlines(data,league,when),Math.min(ttl,10*60000))
  ]);
  let board=power;
  if(league==='ncaaf'&&power?.available){
   const result=typeof collegeSchedule==='function'&&String(year)===fbs.season?await resource('college-results:'+year,String(year),data=>{
    if(!Array.isArray(data?.response)||(data.errors&&Object.keys(data.errors).length)||Number(data.paging?.total||1)>1)throw Error('Incomplete season results');
    return data;
   },ttl,()=>collegeSchedule(year),ttl):null;
   const adjusted=result?require('./college-strength').buildCollegeStrength(power,result,now()):
    {available:false,reason:'Schedule-adjusted results are unavailable; the record/scoring-margin index is unadjusted.'};
   board=adjusted.available?adjusted.board:{...power,scheduleAdjustment:{applied:false,reason:adjusted.reason},
    basis:'Unadjusted record/scoring-margin index; schedule strength is not verified. Display only, not a betting projection.'};
  }
  return {league,name:config.name,season:year,checkedAt:new Date(now()).toISOString(),
   power:board||{available:false,message:'League-wide verified standings are unavailable. No overall ranking was invented.'},
   headlines:{available:Array.isArray(news)&&news.length>0,items:Array.isArray(news)?news:[],
    source:'ESPN',message:Array.isArray(news)&&news.length?'Article headlines and original links only. Read the source before acting on reports.':'Current league headlines could not be verified.'}};
 };
}
module.exports={LEAGUES,seasonYear,buildPowerBoard,buildCollegePoll,parseHeadlines,createLeaguePulse};
