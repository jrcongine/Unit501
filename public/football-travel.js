(function(root){
 'use strict';
 function miles(a,b){
  const valid=v=>v&&Number.isFinite(v.latitude)&&Math.abs(v.latitude)<=90&&Number.isFinite(v.longitude)&&Math.abs(v.longitude)<=180;
  if(!valid(a)||!valid(b))return null;
  const rad=n=>n*Math.PI/180,lat=rad(b.latitude-a.latitude),lon=rad(b.longitude-a.longitude);
  const h=Math.sin(lat/2)**2+Math.cos(rad(a.latitude))*Math.cos(rad(b.latitude))*Math.sin(lon/2)**2;
  return Math.round(3958.7613*2*Math.asin(Math.sqrt(Math.min(1,Math.max(0,h)))));
 }
 // Calendar rest uses Central dates; elapsed hours still reflect DST changes.
 function schedule(games,kickoff){
  if(!Number.isFinite(kickoff))return {available:false};
  const prior=(Array.isArray(games)?games:[]).filter(g=>Number.isFinite(g?.kickoff)&&g.kickoff>0&&g.kickoff<kickoff).sort((a,b)=>b.kickoff-a.kickoff);
  if(!prior.length)return {available:false};
  const day=at=>{const p=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(at)).map(p=>[p.type,p.value]));return Date.UTC(+p.year,+p.month-1,+p.day);};
  const daysBetween=Math.round((day(kickoff)-day(prior[0].kickoff))/86400000);
  return {available:true,fullDaysOff:Math.max(0,daysBetween-1),daysBetween,
   gapHours:Math.round((kickoff-prior[0].kickoff)/3600000*10)/10,
   shortWeek:daysBetween<7,
   gamesLast14Days:new Set(prior.filter(g=>kickoff-g.kickoff<=14*86400000).map(g=>g.kickoff)).size};
 }
 function create(fetcher=fetch,now=Date.now){
  const cache=new Map();
  function venue(q){
   const key=JSON.stringify(q),old=cache.get(key);if(old&&now()-old.at<3600000)return old.pending;
   const entry={at:now()};entry.pending=(async()=>{
    const r=await fetcher('/api/game-venue?'+new URLSearchParams(q),{signal:AbortSignal.timeout(30000)});
    if(!r.ok)throw Error('Venue unavailable');const v=await r.json();
    if(!v.available||miles(v,v)===null)throw Error('Venue unavailable');return v;
   })();cache.set(key,entry);if(cache.size>150)cache.delete(cache.keys().next().value);
   entry.pending.catch(()=>{if(cache.get(key)===entry)cache.delete(key);});return entry.pending;
  }
  async function estimate(game,team,last){
   if(!game||!last||!['away','home'].includes(last.side)||!last.opponent||!Number.isFinite(last.kickoff)||last.kickoff>=game.kickoff)return null;
   const common={league:game.league,season:game.season};
   const current={...common,kickoff:game.kickoff,away:game.a,home:game.h};
   const previous={...common,kickoff:last.kickoff,away:last.side==='away'?team:last.opponent,home:last.side==='home'?team:last.opponent};
   try{const [a,b]=await Promise.all([venue(previous),venue(current)]);const distance=miles(a,b);if(distance===null)return null;
    return {miles:distance,previous:a.name,current:b.name,cityPrecision:a.locationPrecision==='city'||b.locationPrecision==='city'};
   }catch{return null;}
  }
  return {estimate};
 }
 const api={miles,create,schedule};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.Unit501FootballTravel=api;
})(typeof window!=='undefined'?window:globalThis);
