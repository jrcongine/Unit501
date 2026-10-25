'use strict';
// UNIT 501 experimental *results-based* NFL power index.
// This is informational context only: never enters projections, betting odds, or player props.
const SEVEN_DAYS=7*86400000;
const FINAL=new Set(['FT','AOT','FINAL']);
const clamp=(x,min,max)=>Math.min(max,Math.max(min,x));
const mean=values=>values.reduce((total,value)=>total+value,0)/values.length;
const isInt=x=>Number.isInteger(x)&&x>=0&&x<=100;
function completedGames(games,season,cutoff){
 const finished=[],ids=new Set();
 for(const g of games){
  if(String(g?.league?.id)!=='1'||String(g?.league?.season)!==String(season)||
    g?.game?.stage!=='Regular Season')continue;
  const at=Number(g.game?.date?.timestamp)*1000;
  if(!Number.isFinite(at)||at<=0||at>=cutoff||
    !FINAL.has(String(g.game?.status?.short||'').toUpperCase()))continue;
  const away=g.teams?.away||g.teams?.visitors,home=g.teams?.home;
  const as=g.scores?.away?.total,hs=g.scores?.home?.total,id=String(g.game?.id||'');
  if(!id||ids.has(id)||!away?.id||!home?.id||!away?.name||!home?.name||
    String(away.id)===String(home.id)||!isInt(as)||!isInt(hs))return null;
  ids.add(id);
  finished.push({id,at,away:{id:String(away.id),name:away.name,score:as},
    home:{id:String(home.id),name:home.name,score:hs}});
 }
 return finished;
}
function rateTeams(games){
 const teams=new Map();
 for(const g of games){
  for(const side of ['away','home']){
   const t=g[side],other=g[side==='away'?'home':'away'];
   if(!teams.has(t.id))teams.set(t.id,{id:t.id,name:t.name,games:[]});
   const team=teams.get(t.id);
   if(team.name!==t.name)return null;
   team.games.push({at:g.at,margin:t.score-other.score,
    scored:t.score,allowed:other.score,opponent:other.id});
  }
 }
 if(teams.size!==32||[...teams.values()].some(t=>t.games.length<1||t.games.length>17)||
    new Set([...teams.values()].map(t=>t.name)).size!==32)return null;
 const raw=new Map([...teams.values()].map(t=>[t.id,mean(t.games.map(g=>g.margin))]));
 const scores=[...teams.values()].map(t=>{
  const history=t.games.sort((a,b)=>a.at-b.at),n=history.length;
  const margin=raw.get(t.id);
  const recent=mean(history.slice(-3).map(g=>g.margin));
  const opponents=mean(history.map(g=>raw.get(g.opponent)));
  // Schedule strength rewards performance vs stronger opponents.
  // Last-three-game margin adds a measured recent-form component.
  const adjusted=margin+.30*opponents+.25*(recent-margin);
  const rating=adjusted*(n/(n+3)); // Early-season shrinkage toward league average.
  const score=clamp(50+2.5*rating,0,100);
  const wins=history.filter(g=>g.margin>0).length;
  const ties=history.filter(g=>g.margin===0).length;
  const record=wins+'-'+(n-wins-ties)+(ties?'-'+ties:'');
  return {id:t.id,name:t.name,games:n,record,score:Math.round(score*10)/10,
    _rating:rating,_margin:margin};
 });
 scores.sort((a,b)=>b._rating-a._rating||b._margin-a._margin||
   a.name.localeCompare(b.name));
 return scores.map(({_rating,_margin,...r},i)=>({...r,rank:i+1}));
}
function createPowerRankings(api,opts={}){
 const now=opts.now||Date.now,ttl=opts.ttlMs??15*60000;
 let cached=null,pending=null;
 const unavailable=(season,reason)=>({available:false,season:String(season),message:reason});
 return async function nflPower(season){
  const stamp=now(),current=new Date(stamp).getUTCFullYear();
  const valid=[String(current)];
  if(new Date(stamp).getUTCMonth()<3)valid.push(String(current-1));
  if(!/^\d{4}$/.test(String(season))||!valid.includes(String(season)))
    return unavailable(season,'Power rankings are available for the current NFL season only.');
  if(cached&&cached.season===String(season)&&stamp-cached.at<ttl)return cached.value;
  if(pending&&pending.season===String(season))return pending.promise;
  const job=Promise.resolve().then(async()=>{
   const data=await api('/games?league=1&season='+season);
   if(!Array.isArray(data?.response)||data.paging?.total>1||
       (data.errors&&Object.keys(data.errors).length))
     throw Error('Full NFL schedule was not available from the data provider.');
   const finished=completedGames(data.response,season,stamp);
   if(!finished)throw Error('A completed NFL game had inconsistent scores or team identities.');
   const currentRanks=rateTeams(finished);
   if(!currentRanks)throw Error('All 32 teams need verified completed regular-season scores.');
   const prior=completedGames(data.response,season,stamp-SEVEN_DAYS);
   const previous=prior?rateTeams(prior):null;
   const beforeRanks=new Map((previous||[]).map(t=>[t.id,t.rank]));
   const ranks=currentRanks.map(t=>{
    const prev=beforeRanks.get(t.id);
    const delta=prev===undefined?null:prev-t.rank;
    return {...t,previousRank:prev??null,movement:delta,
      direction:delta===null?'unknown':delta>=2?'up':delta<=-2?'down':'steady',
      tier:t.rank<=10?'top':t.rank<=22?'middle':'bottom'};
   });
   return {available:true,season:String(season),asOf:new Date(stamp).toISOString(),
     comparisonAt:previous?new Date(stamp-SEVEN_DAYS).toISOString():null,
     method:'Results-based index: scoring margin, opponent scoring strength, recent three-game form, and early-season sample smoothing. Rankings are informational, not predictions. Injuries and depth changes are not included.',
     counts:{teams:32,games:finished.length},teams:ranks};
  }).catch(err=>unavailable(season,err.message||'NFL power rankings are temporarily unavailable.'));
  pending={season:String(season),promise:job};
  try{
   const value=await job;
   cached={season:String(season),at:now(),value};
   return value;
  }finally{
   if(pending?.promise===job)pending=null;
  }
 };
}
module.exports={createPowerRankings,completedGames,rateTeams};
