'use strict';
function createLiveWatch({publicFeed,now=Date.now}){
 return async()=>{
  const at=now(),parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(new Date(at)).map(p=>[p.type,p.value]));
  const today=parts.year+'-'+parts.month+'-'+parts.day,dates=[today];
  // Late games can still be in progress after Central midnight.
  if(Number(parts.hour)<6)dates.push(new Date(Date.parse(today+'T12:00:00Z')-86400000).toISOString().slice(0,10));
  const slates=await Promise.all(dates.map(date=>publicFeed.games(date)));
  const games=new Map();
  for(const slate of slates){
   const checked=Date.parse(slate.checkedAt);
   if(!Array.isArray(slate.games)||!Number.isFinite(checked)||checked>at+60000||at-checked>180000)throw Error('Stale live NBA scoreboard');
   for(const game of slate.games)games.set(String(game.id),game);
  }
  return {games:[...games.values()],checkedAt:new Date(Math.min(...slates.map(s=>Date.parse(s.checkedAt)))).toISOString(),source:'ESPN public NBA scoreboard'};
 };
}
module.exports={createLiveWatch};
