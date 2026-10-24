'use strict';
// Deliberately conservative: match the same dated matchup and exact selection/line.
// Unknown dates, ambiguous matchups, different lines and props remain separate.
const clean=s=>String(s||'').toLowerCase().replace(/½/g,'.5').replace(/[^a-z0-9+ .-]/g,' ').replace(/\s+/g,' ').trim();
function selection(pick){
 return clean(String(pick||'').replace(/\([^)]*\)/g,'').replace(/\s+[+-]\d{3,4}(?:\s+at\s+.*)?$/i,'').replace(/^total\s+/i,''));
}
function dateOf(p){
 if(/^\d{4}-\d{2}-\d{2}$/.test(p.eventDate||''))return p.eventDate;
 if(p.eventAt&&Number.isFinite(Date.parse(p.eventAt)))return new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(p.eventAt));
 return null;
}
function consensus(sources){
 const groups=new Map();
 for(const source of sources){for(const p of source.picks||[]){
  const date=dateOf(p),pick=selection(p.pick);
  const teams=String(p.matchup||'').replace(/\(\d+\)/g,'').replace(/:\s*(total|spread|moneyline).*$/i,'').split(/\s+(?:vs\.?|at|@)\s+/i).map(clean).sort();
  if(!date||teams.length!==2||teams.some(t=>!t)||!pick)continue;
  const key=[p.league,date,...teams,pick].join('|');
  if(!groups.has(key))groups.set(key,{date,matchup:p.matchup,pick,members:new Map()});
  const group=groups.get(key),identity=source.source+':'+clean(p.author);
  if(!group.members.has(identity))group.members.set(identity,{source:source.name,author:p.author,pick:p.pick,url:p.url});
 }}
 return [...groups.values()].map(g=>({date:g.date,matchup:g.matchup,pick:g.pick,count:g.members.size,sources:[...g.members.values()]}))
  .filter(g=>g.count>=2).sort((a,b)=>b.count-a.count||a.matchup.localeCompare(b.matchup)).slice(0,3);
}
module.exports={consensus,selection};
