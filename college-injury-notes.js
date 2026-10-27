'use strict';
// Display-only third-party notes; never feed these into automatic injury scoring.
const {fbsName}=require('./team-identity');
const ROOT='https://kickoffstatus.com';
const nameKey=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const slug=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const decode=s=>String(s||'').replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n))).replace(/&#x([\da-f]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16))).replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&apos;|&#39;/gi,"'").replace(/&lt;/gi,'<').replace(/&gt;/gi,'>');
const text=s=>decode(String(s||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim());
function parseNotes(html,game,season,now){
 if(typeof html!=='string'||html.length>1000000)throw Error('Invalid notes page');
 const away=fbsName(game.teams.away,season),home=fbsName(game.teams.home,season),kickoff=Number(game.game.date.timestamp)*1000;
 if(!away||!home||!Number.isFinite(kickoff))throw Error('Game identity unavailable');
 let matches=[];
 for(const m of html.matchAll(/<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){
  try{const x=JSON.parse(m[1]);if(x['@type']==='SportsEvent'&&nameKey(x.awayTeam?.name)===nameKey(away)&&nameKey(x.homeTeam?.name)===nameKey(home)&&Date.parse(x.startDate)===kickoff)matches.push(x);}catch{}
 }
 if(matches.length!==1)throw Error('Notes matchup not verified');
 const checked=Date.parse(/class=["']upd-time["'][^>]*>[\s\S]*?<time\s+datetime=["']([^"']+)/i.exec(html)?.[1]||'');
 if(!Number.isFinite(checked)||checked>now+60000||now-checked>48*3600000)throw Error('Notes update time unavailable or stale');
 const section=/<section\b[^>]*\bid=["']unofficial["'][^>]*>([\s\S]*?)<\/section>/i.exec(html)?.[1];
 if(!section)return {updatedAt:checked,away:[],home:[]};
 const tbody=/<tbody[^>]*>([\s\S]*?)<\/tbody>/i.exec(section)?.[1];if(!tbody)throw Error('Notes table unavailable');
 const result={updatedAt:checked,away:[],home:[]};
 for(const tr of tbody.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)){
  const cells=[...tr[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(m=>m[1]);
  if(cells.length!==5)throw Error('Unexpected notes row');
  const player=text(cells[0].replace(/<div\b[\s\S]*$/i,'')),team=text(/<div\b[^>]*>([\s\S]*?)<\/div>/i.exec(cells[0])?.[1]);
  const position=text(cells[1]),status=text(cells[2]),note=text(cells[3]);
  const date=text(/<div\b[^>]*>([\s\S]*?)<\/div>/i.exec(cells[4])?.[1]);
  const side=nameKey(team)===nameKey(away)?'away':nameKey(team)===nameKey(home)?'home':null;
  if(!side||!player||player.length>100||!/^[A-Z]{1,4}$/.test(position)||!/^(out|questionable|doubtful|probable)$/i.test(status)||!/^\d{4}-\d{2}-\d{2}$/.test(date)||Date.parse(date+'T00:00:00Z')>now)throw Error('Unverified notes row');
  result[side].push({name:player,position,status,note:note.slice(0,240),date});
 }
 return result;
}
function createCollegeInjuryNotes(api,now=Date.now,fetcher=fetch){
 const cache=new Map();
 return async(q,teams)=>{
  if(q.league!=='2'||!/^\d{1,10}$/.test(q.game||''))return;
  try{
   const response=await api('/games?id='+q.game),g=response.response?.length===1?response.response[0]:null;
   const kickoff=Number(g?.game?.date?.timestamp)*1000;
   if(response.errors&&Object.keys(response.errors).length||String(g?.league?.id)!==q.league||String(g?.league?.season)!==q.season||String(g?.teams?.away?.id)!==q.away||String(g?.teams?.home?.id)!==q.home||!Number.isFinite(kickoff)||kickoff<=now()||kickoff>now()+7*86400000)return;
   const away=fbsName(g.teams.away,q.season),home=fbsName(g.teams.home,q.season);if(!away||!home)return;
   const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(kickoff).map(p=>[p.type,p.value]));
   const url=ROOT+'/games/'+parts.year+'-'+parts.month+'-'+parts.day+'-'+slug(away)+'-at-'+slug(home)+'/';
   let entry=cache.get(url);if(!entry||now()-entry.at>=15*60000){
    entry={at:now(),pending:(async()=>{const r=await fetcher(url,{signal:AbortSignal.timeout(8000),redirect:'error'});if(!r.ok||Number(r.headers?.get?.('content-length')||0)>1000000)throw Error('Notes unavailable');return r.text();})()};cache.set(url,entry);entry.pending.catch(()=>{if(cache.get(url)===entry)cache.delete(url);});
   }
   const data=parseNotes(await entry.pending,g,q.season,now());
   for(const t of teams){const side=String(t.id)===q.away?'away':String(t.id)===q.home?'home':null;if(side)t.unofficialNotes={rows:data[side],updatedAt:data.updatedAt,checkedAt:now(),gameId:q.game,kickoff,url};}
  }catch{/* Unverified or missing public notes never clear a player's status. */}
 };
}
module.exports={parseNotes,createCollegeInjuryNotes};
