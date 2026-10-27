(function(root){
 'use strict';
 const key=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
 const markets=new Set(['player_points','player_rebounds','player_assists','player_threes']);
 function project(history,quote,game,status,now=Date.now(),options={}){
  if(status==='Out')return {available:false,reason:'OUT'};
  if(!history||!game||!Number.isFinite(Date.parse(game.tipoff))||Date.parse(game.tipoff)<=now||String(history.gameId)!==String(game.id)||history.tipoff!==game.tipoff||
   !Number.isFinite(history.checkedAt)||history.checkedAt>now+60000||now-history.checkedAt>1800000||
   !Array.isArray(history.teams)||history.teams.length!==2||history.teams.some(t=>!Array.isArray(t.players))||
   !quote||!markets.has(quote.market)||!Number.isFinite(quote.line))return {available:false,reason:'—'};
  const wanted=key(quote.name);if(!wanted)return {available:false,reason:'—'};
  const matches=history.teams.flatMap(t=>t.players.map(p=>({...p,teamAvailable:t.available}))).filter(p=>key(p.name)===wanted);
  if(matches.length!==1||matches[0].available===false||!matches[0].teamAvailable||!Array.isArray(matches[0].results))return {available:false,reason:'—'};
  const results=matches[0].results;
  if(results.length>10||new Set(results.map(r=>String(r.gameId))).size!==results.length||results.some(r=>
   !/^\d{1,12}$/.test(String(r.gameId||''))||!Number.isFinite(Date.parse(r.tipoff))||Date.parse(r.tipoff)>=Math.min(now,Date.parse(game.tipoff))))return {available:false,reason:'—'};
  const ordered=[...results].sort((a,b)=>Date.parse(b.tipoff)-Date.parse(a.tipoff));
  const sample=ordered.filter(r=>Number.isInteger(r[quote.market])&&r[quote.market]>=0);
  const values=sample.map(r=>r[quote.market]);
  if(values.length<2)return {available:false,reason:'—'};
  const average=values.reduce((a,b)=>a+b,0)/values.length;
  // Minutes are observed playing time, not a confirmed starting assignment.
  const hasMinutes=sample.every(r=>Number.isFinite(r.minutes)&&r.minutes>0&&r.minutes<=60);
  const manual=options.minutes!==undefined&&options.minutes!==null;
  if(manual&&(!Number.isFinite(options.minutes)||options.minutes<1||options.minutes>48))
   return {available:false,reason:'Enter 1–48 minutes'};
  if(manual&&!hasMinutes)return {available:false,reason:'Minutes history unavailable'};
  let projection=average,projectedMinutes=null,minuteChange=null,method='recent average';
  if(hasMinutes){
   // Weight recent appearances more heavily; use the same weights for rate and minutes.
   const weights=sample.map((_,i)=>Math.pow(0.85,i));
   const totalWeight=weights.reduce((a,b)=>a+b,0);
   const weightedMinutes=sample.reduce((sum,r,i)=>sum+r.minutes*weights[i],0);
   const rate=sample.reduce((sum,r,i)=>sum+r[quote.market]*weights[i],0)/weightedMinutes;
   projectedMinutes=manual?options.minutes:Math.min(48,weightedMinutes/totalWeight);
   projection=rate*projectedMinutes;method=manual?'manual minutes':'recency and minutes';
   if(sample.length>=5){
    const recent=sample.slice(0,2).reduce((sum,r)=>sum+r.minutes,0)/2;
    const previous=sample.slice(2).reduce((sum,r)=>sum+r.minutes,0)/(sample.length-2);
    if(Math.abs(recent-previous)>=5)minuteChange={recent,previous,direction:recent>previous?'up':'down'};
   }
  }
  return {available:true,projection,average,projectedMinutes,minuteChange,method,games:values.length,
   above:values.filter(n=>n>quote.line).length,below:values.filter(n=>n<quote.line).length,equal:values.filter(n=>n===quote.line).length,
   thin:values.length<5};
 }
 const api={project};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.Unit501NBAPlayerModel=api;
})(typeof window!=='undefined'?window:globalThis);
