(function(root){
 'use strict';
 const key=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
 const markets=new Set(['player_points','player_rebounds','player_assists','player_threes']);
 function project(history,quote,game,status,now=Date.now()){
  if(status==='Out')return {available:false,reason:'OUT'};
  if(!history||!game||!Number.isFinite(Date.parse(game.tipoff))||Date.parse(game.tipoff)<=now||String(history.gameId)!==String(game.id)||history.tipoff!==game.tipoff||
   !Number.isFinite(history.checkedAt)||history.checkedAt>now+60000||now-history.checkedAt>1800000||
   !Array.isArray(history.teams)||history.teams.length!==2||history.teams.some(t=>!t.available||!Array.isArray(t.players))||
   !quote||!markets.has(quote.market)||!Number.isFinite(quote.line))return {available:false,reason:'—'};
  const wanted=key(quote.name);if(!wanted)return {available:false,reason:'—'};
  const matches=history.teams.flatMap(t=>t.players).filter(p=>key(p.name)===wanted);
  if(matches.length!==1||!Array.isArray(matches[0].results))return {available:false,reason:'—'};
  const results=matches[0].results;
  if(results.length>5||new Set(results.map(r=>String(r.gameId))).size!==results.length||results.some(r=>
   !/^\d{1,12}$/.test(String(r.gameId||''))||!Number.isFinite(Date.parse(r.tipoff))||Date.parse(r.tipoff)>=Date.parse(game.tipoff)))return {available:false,reason:'—'};
  const values=results.map(r=>r[quote.market]).filter(n=>Number.isInteger(n)&&n>=0);
  if(values.length<2)return {available:false,reason:'—'};
  return {available:true,projection:values.reduce((a,b)=>a+b,0)/values.length,games:values.length,
   above:values.filter(n=>n>quote.line).length,below:values.filter(n=>n<quote.line).length,equal:values.filter(n=>n===quote.line).length,
   thin:values.length<5};
 }
 const api={project};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.Unit501NBAPlayerModel=api;
})(typeof window!=='undefined'?window:globalThis);
