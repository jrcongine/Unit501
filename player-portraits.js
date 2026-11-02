'use strict';
const leagues={nfl:'football/nfl',cfb:'football/college-football',nba:'basketball/nba',cbb:'basketball/mens-college-basketball'};
const key=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
function createPortraitLookup(fetcher=fetch,now=Date.now){
 const cache=new Map();
 async function read(path){
  const cached=cache.get(path);
  if(cached&&cached.until>now())return cached.request;
  const request=(async()=>{
   const r=await fetcher('https://site.api.espn.com/apis/site/v2/sports/'+path,{signal:AbortSignal.timeout(7500)});
   if(!r.ok)throw Error('Roster unavailable');
   return r.json();
  })();
  cache.set(path,{until:now()+3600000,request});
  if(cache.size>200)cache.delete(cache.keys().next().value);
  try{return await request;}catch(e){if(cache.get(path)?.request===request)cache.delete(path);throw e;}
 }
 return async function lookup(league,team,name){
  if(!Object.hasOwn(leagues,league)||!key(team)||!key(name)||team.length>120||name.length>100)return null;
  const root=leagues[league],directory=await read(root+'/teams?limit=1000');
  const teams=(directory.sports?.[0]?.leagues?.[0]?.teams||[]).map(r=>r.team).filter(t=>
   [t?.displayName,t?.shortDisplayName,t?.location].some(n=>key(n)===key(team)));
  if(teams.length!==1||!/^\d+$/.test(teams[0].id))return null;
  const roster=await read(root+'/teams/'+teams[0].id+'/roster');
  if(roster.team?.id&&String(roster.team.id)!==String(teams[0].id))return null;
  const matches=(roster.athletes||[]).flatMap(g=>Array.isArray(g.items)?g.items:[g]).filter(p=>
   [p.displayName,p.fullName].some(n=>key(n)===key(name)));
  if(matches.length!==1)return null;
  const athlete=matches[0],href=athlete.headshot?.href;
  if(!/^\d+$/.test(athlete.id)||typeof href!=='string')return null;
  let url;try{url=new URL(href);}catch{return null;}
  if(url.protocol!=='https:'||url.hostname!=='a.espncdn.com'||!url.pathname.startsWith('/i/headshots/')||!url.pathname.endsWith('/'+athlete.id+'.png'))return null;
  return {url:url.href};
 };
}
module.exports={createPortraitLookup};
