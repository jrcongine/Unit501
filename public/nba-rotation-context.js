(function(root){
 'use strict';
 const model=typeof module!=='undefined'&&module.exports?require('./nba-player-model'):root.Unit501NBAPlayerModel;
 const markets=new Set(['player_points','player_rebounds','player_assists','player_threes']);
 const key=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
 function compare(history,quote,report,game,now=Date.now(),options={}){
  const college=options.official===false,stamp=college?report?.checkedAt:report?.reportAt,maxAge=college?900000:7200000;
  if(!game||!quote||!history||!report||String(history.gameId)!==String(game.id)||history.tipoff!==game.tipoff||String(report.gameId)!==String(game.id)||report.tipoff!==game.tipoff||
   !Number.isFinite(stamp)||stamp>now+60000||now-stamp>maxAge||!Number.isFinite(history.checkedAt)||history.checkedAt>now+60000||now-history.checkedAt>1800000||
   !Number.isFinite(Date.parse(game.tipoff))||Date.parse(game.tipoff)<=now||!Array.isArray(history.teams)||history.teams.length!==2||!Array.isArray(report.teams)||report.teams.length!==2)return [];
  if(!markets.has(quote.market))return [];
  // Both adapters return away then home. Require the same named teams, too.
  const teamKey=s=>key(s).replace(/^losangeles/,'la');
  if(history.teams.some((t,i)=>!teamKey(t?.name)||teamKey(t.name)!==teamKey(college?report.teams[i]?.team:report.teams[i]?.name))||
   teamKey(history.teams[0].name)===teamKey(history.teams[1].name))return [];
  const cutoff=Math.min(now,Date.parse(game.tipoff));
  const records=rows=>{
   if(!Array.isArray(rows)||rows.length>10)return null;
   const map=new Map();
   for(const r of rows){
    const id=String(r?.gameId||''),at=Date.parse(r?.tipoff);
    if(!/^\d{1,12}$/.test(id)||!Number.isFinite(at)||at>=cutoff||map.has(id))return null;
    map.set(id,at);
   }
   return map;
  };
  const candidates=history.teams.flatMap((t,index)=>Array.isArray(t?.players)?t.players.map(player=>({...player,index,teamAvailable:t.available})):[]);
  const player=model?.matchPlayer(candidates,quote.name).player;
  if(!player||!player.teamAvailable)return [];
  const index=player.index,team=history.teams[index],official=report.teams[index];
  if(player.available===false||!Array.isArray(player.results)||!official?.available||!Array.isArray(official.players))return [];
  if(!records(player.results))return [];
  const out=[];
  for(const injury of official.players){
   if(String(injury.status||'').toLowerCase()!=='out')continue;
   const teammate=model.matchPlayer(team.players,injury.name).player;
   if(!teammate||teammate===model.matchPlayer(team.players,quote.name).player)continue;
   if(!model.matchPlayer(official.players,injury.name).player)continue;
   if(teammate.available===false||!Array.isArray(teammate.results)||!Array.isArray(teammate.inactive))continue;
   const active=records(teammate.results),inactive=records(teammate.inactive);
   if(!active||!inactive||[...active.keys()].some(id=>inactive.has(id))||
    teammate.results.some(r=>!Number.isFinite(r.minutes)||r.minutes<=0||r.minutes>60))continue;
   const groups={with:[],without:[]};const seen=new Set();let invalid=false;
   for(const result of player.results){
    const id=String(result.gameId),at=Date.parse(result.tipoff);
    if(seen.has(id)||!Number.isFinite(at)||at>=Math.min(now,Date.parse(game.tipoff))){invalid=true;break;}seen.add(id);
    if(!Number.isInteger(result[quote.market])||result[quote.market]<0||!Number.isFinite(result.minutes)||result.minutes<=0||result.minutes>60)continue;
    if((active.has(id)&&active.get(id)!==at)||(inactive.has(id)&&inactive.get(id)!==at)){invalid=true;break;}
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
