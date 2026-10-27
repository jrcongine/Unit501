(function(root){
 'use strict';
 const key=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
 function compare(history,quote,report,game,now=Date.now()){
  if(!game||!quote||!history||!report||String(history.gameId)!==String(game.id)||history.tipoff!==game.tipoff||String(report.gameId)!==String(game.id)||report.tipoff!==game.tipoff||
   !Number.isFinite(report.reportAt)||report.reportAt>now+60000||now-report.reportAt>7200000||!Number.isFinite(history.checkedAt)||history.checkedAt>now+60000||now-history.checkedAt>1800000||
   !Number.isFinite(Date.parse(game.tipoff))||Date.parse(game.tipoff)<=now||!Array.isArray(history.teams)||history.teams.length!==2||!Array.isArray(report.teams)||report.teams.length!==2)return [];
  const wanted=key(quote.name),matches=[];
  for(let i=0;i<2;i++)if(history.teams[i]?.available&&Array.isArray(history.teams[i].players))for(const p of history.teams[i].players)if(wanted&&key(p.name)===wanted)matches.push({player:p,index:i});
  if(matches.length!==1)return [];
  const {player,index}=matches[0],team=history.teams[index],official=report.teams[index];
  if(player.available===false||!Array.isArray(player.results)||!official?.available||!Array.isArray(official.players))return [];
  const out=[];
  for(const injury of official.players){
   if(String(injury.status||'').toLowerCase()!=='out')continue;
   const name=key(injury.name);if(!name||name===wanted)continue;
   const candidates=team.players.filter(p=>key(p.name)===name);
   if(candidates.length!==1||official.players.filter(p=>key(p.name)===name).length!==1)continue;
   const teammate=candidates[0];if(teammate.available===false||!Array.isArray(teammate.results)||!Array.isArray(teammate.inactive))continue;
   const active=new Set(teammate.results.map(x=>String(x.gameId))),inactive=new Set(teammate.inactive.map(x=>String(x.gameId)));
   if(active.size!==teammate.results.length||inactive.size!==teammate.inactive.length||[...active].some(id=>inactive.has(id)))continue;
   const groups={with:[],without:[]};const seen=new Set();let invalid=false;
   for(const result of player.results){
    const id=String(result.gameId),at=Date.parse(result.tipoff);
    if(seen.has(id)||!Number.isFinite(at)||at>=Math.min(now,Date.parse(game.tipoff))){invalid=true;break;}seen.add(id);
    if(!Number.isInteger(result[quote.market])||result[quote.market]<0||!Number.isFinite(result.minutes)||result.minutes<=0)continue;
    if(active.has(id))groups.with.push(result);else if(inactive.has(id))groups.without.push(result);
   }
   if(invalid||groups.with.length<2||groups.without.length<2)continue;
   const summary=items=>({games:items.length,value:items.reduce((a,r)=>a+r[quote.market],0)/items.length,minutes:items.reduce((a,r)=>a+r.minutes,0)/items.length});
   out.push({name:teammate.name,with:summary(groups.with),without:summary(groups.without)});
  }
  return out;
 }
 const api={compare};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.Unit501NBARotationContext=api;
})(typeof window!=='undefined'?window:globalThis);
