'use strict';
// Deliberately conservative: match the same dated matchup and exact selection/line.
// Unknown dates, ambiguous matchups and different lines remain separate.
const {eventIdentity,pitcherOuts}=require('./consensus-identity');
const clean=s=>String(s||'').toLowerCase().replace(/½/g,'.5').replace(/[^a-z0-9+ .-]/g,' ').replace(/\s+/g,' ').trim();
function selection(pick){
 return clean(String(pick||'').replace(/\([^)]*\)/g,'').replace(/\s+[+-]\d{3,4}(?:\s+at\s+.*)?$/i,'').replace(/^total\s+/i,''));
}
function consensus(sources){
 const groups=new Map();
 for(const source of sources){for(const p of source.picks||[]){
  const event=eventIdentity(p,source),date=event?.date,prop=pitcherOuts(p),pick=prop?.pick||selection(p.pick);
  const teams=prop?.teams||String(p.matchup||'').replace(/\(\d+\)/g,'').replace(/:\s*(total|spread|moneyline).*$/i,'').split(/\s+(?:vs\.?|at|@)\s+/i).map(clean).sort();
  if(!date||teams.length!==2||teams.some(t=>!t)||!pick)continue;
  if(!clean(p.author)||(prop&&!event?.time))continue;
  const key=[p.league,date,...teams,pick,prop?event.time:''].join('|');
  if(!groups.has(key))groups.set(key,{date,matchup:p.matchup,pick,members:new Map()});
  const group=groups.get(key),identity=source.source+':'+clean(p.author);
  if(!group.members.has(identity))group.members.set(identity,{source:source.name,author:p.author,pick:p.pick,url:p.url});
 }}
 return [...groups.values()].map(g=>({date:g.date,matchup:g.matchup,pick:g.pick,count:g.members.size,sources:[...g.members.values()]}))
  .filter(g=>g.count>=2).sort((a,b)=>b.count-a.count||a.matchup.localeCompare(b.matchup));
}
module.exports={consensus,selection};
