(function(root){
 'use strict';
 const key=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
 // Name formatting may vary across report and sportsbook feeds. A missing suffix
 // is compatible only when the entire report contains one candidate; collisions
 // and conflicting statuses must never silently become an uninjured projection.
 const nameParts=value=>{const name=String(value||'').trim(),suffix=/\s+(Jr\.?|Sr\.?|II|III|IV|V)$/i.exec(name);return {base:key(suffix?name.slice(0,suffix.index):name),suffix:suffix?key(suffix[1]):''};};
 function matchPlayer(rows,name){
  const wanted=nameParts(name);
  if(!wanted.base||!Array.isArray(rows))return {matches:[],player:null};
  const matches=rows.filter(p=>nameParts(p?.name).base===wanted.base);
  const found=matches.length===1?nameParts(matches[0].name):null;
  const player=found&&(!wanted.suffix||!found.suffix||wanted.suffix===found.suffix)?matches[0]:null;
  return {matches,player};
 }
 function injuryStatus(report,quote,game,now=Date.now(),official=true){
  if(!report)return null;
  const stamp=official?report.reportAt:report.checkedAt,age=official?7200000:900000;
  if(!game||String(report.gameId)!==String(game.id)||report.tipoff!==game.tipoff||!Number.isFinite(stamp)||stamp>now+60000||now-stamp>age||
   !Array.isArray(report.teams)||report.teams.length!==2||report.teams.some(t=>!Array.isArray(t.players)))return 'Unverified';
  if(!nameParts(quote?.name).base)return 'Unverified';
  const {matches,player:p}=matchPlayer(report.teams.flatMap(t=>t.players.map(p=>({...p,teamAvailable:official?t.available===true:t.available!==false}))),quote.name);
  if(!matches.length)return null; // Absence from an injury list is not confirmed health.
  if(!p)return 'Unverified';
  if(!p.teamAvailable)return 'Unverified';
  const status=String(p.status||'').trim();
  return /^out$/i.test(status)?'Out':status||'Unverified';
 }
 function availabilityNote(status){
  if(!status)return 'Availability unconfirmed; estimate uses historical workload.';
  if(/^available$|^active$/i.test(status))return 'Listed available; starting role and minutes are not confirmed.';
  return 'Reported '+status+'; estimate assumes participation and does not price the chance of missing the game.';
 }
 const markets=new Set(['player_points','player_rebounds','player_assists','player_threes']);
 function project(history,quote,game,status,now=Date.now(),options={}){
  const regulationMinutes=options.regulationMinutes??48;
  if(![40,48].includes(regulationMinutes))return {available:false,reason:'Unsupported regulation minutes'};
  if(status==='Unverified')return {available:false,reason:'Player injury match unverified'};
  if(status==='Out')return {available:false,reason:'OUT'};
  if(!history)return {available:false,reason:'Player history unavailable'};
  if(!game||!Number.isFinite(Date.parse(game.tipoff))||Date.parse(game.tipoff)<=now||String(history.gameId)!==String(game.id)||history.tipoff!==game.tipoff||
   !Number.isFinite(history.checkedAt)||history.checkedAt>now+60000||now-history.checkedAt>1800000||
   !Array.isArray(history.teams)||history.teams.length!==2||history.teams.some(t=>!Array.isArray(t.players))||
   !quote||!markets.has(quote.market)||(!Number.isFinite(quote.line)&&!(options.allowUnpriced===true&&quote.line===null)))return {available:false,reason:'Verified history unavailable'};
  if(!nameParts(quote.name).base)return {available:false,reason:'Verified history unavailable'};
  const {matches,player:matched}=matchPlayer(history.teams.flatMap(t=>t.players.map(p=>({...p,teamAvailable:t.available}))),quote.name);
  if(matches.length===0)return {available:false,reason:'No matched player history'};
  if(!matched)return {available:false,reason:'Player match is ambiguous'};
  if(matches[0].available===false||!matches[0].teamAvailable||!Array.isArray(matches[0].results))return {available:false,reason:'Verified history unavailable'};
  if(matches[0].missing?.length||matches[0].coverage?.missing>0)return {available:false,reason:'Missing player games; participation unverified'};
  const results=matches[0].results;
  const inactive=matches[0].inactive??[];
  const playedIds=new Set(results.map(r=>String(r.gameId)));
  if(!Array.isArray(inactive)||new Set(inactive.map(r=>String(r?.gameId))).size!==inactive.length||inactive.some(r=>
   !/^\d{1,12}$/.test(String(r?.gameId||''))||!Number.isFinite(Date.parse(r.tipoff))||Date.parse(r.tipoff)>=Math.min(now,Date.parse(game.tipoff))||playedIds.has(String(r.gameId))))
   return {available:false,reason:'Conflicting or unverified participation history'};
  if(results.length>10||new Set(results.map(r=>String(r.gameId))).size!==results.length||results.some(r=>
   !/^\d{1,12}$/.test(String(r.gameId||''))||!Number.isFinite(Date.parse(r.tipoff))||Date.parse(r.tipoff)>=Math.min(now,Date.parse(game.tipoff))))return {available:false,reason:'Verified history unavailable'};
  const ordered=[...results].sort((a,b)=>Date.parse(b.tipoff)-Date.parse(a.tipoff));
  const sample=ordered.filter(r=>Number.isInteger(r[quote.market])&&r[quote.market]>=0);
  if(sample.length!==ordered.length)return {available:false,reason:'Incomplete market statistics'};
  const values=sample.map(r=>r[quote.market]);
  if(values.length<2)return {available:false,reason:'Fewer than 2 verified games'};
  const average=values.reduce((a,b)=>a+b,0)/values.length;
  const sorted=[...values].sort((a,b)=>a-b),middle=Math.floor(sorted.length/2),median=sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2;
  // Minutes are observed playing time, not a confirmed starting assignment.
  const hasMinutes=sample.every(r=>Number.isFinite(r.minutes)&&r.minutes>0&&r.minutes<=60);
  const manual=options.minutes!==undefined&&options.minutes!==null;
  if(manual&&(!Number.isFinite(options.minutes)||options.minutes<1||options.minutes>regulationMinutes))
   return {available:false,reason:'Enter 1–'+regulationMinutes+' minutes'};
  if(manual&&!hasMinutes)return {available:false,reason:'Minutes history unavailable'};
  let projection=average,baseline=average,projectedMinutes=null,minuteChange=null,method='recent average';
  if(hasMinutes){
   // Weight recent appearances more heavily; use the same weights for rate and minutes.
   const weights=sample.map((_,i)=>Math.pow(0.85,i));
   const totalWeight=weights.reduce((a,b)=>a+b,0);
   const weightedMinutes=sample.reduce((sum,r,i)=>sum+r.minutes*weights[i],0);
   const rate=sample.reduce((sum,r,i)=>sum+r[quote.market]*weights[i],0)/weightedMinutes;
   baseline=rate*Math.min(regulationMinutes,weightedMinutes/totalWeight);
   projectedMinutes=manual?options.minutes:Math.min(regulationMinutes,weightedMinutes/totalWeight);
   projection=rate*projectedMinutes;method=manual?'manual minutes':'recency and minutes';
   if(sample.length>=5){
    const recent=sample.slice(0,2).reduce((sum,r)=>sum+r.minutes,0)/2;
    const previous=sample.slice(2).reduce((sum,r)=>sum+r.minutes,0)/(sample.length-2);
    if(Math.abs(recent-previous)>=5)minuteChange={recent,previous,recentGames:2,previousGames:sample.length-2,direction:recent>previous?'up':'down'};
   }
  }
  return {available:true,projection,baseline,delta:projection-baseline,average,median,coverage:matches[0].coverage||null,projectedMinutes,minuteChange,method,games:values.length,
   recentValues:values.slice(0,5),
   above:Number.isFinite(quote.line)?values.filter(n=>n>quote.line).length:null,below:Number.isFinite(quote.line)?values.filter(n=>n<quote.line).length:null,equal:Number.isFinite(quote.line)?values.filter(n=>n===quote.line).length:null,
   thin:values.length<5};
 }
 function historicalCounts(history,quote,game,now=Date.now()){
  if(!history||!game||String(history.gameId)!==String(game.id)||history.tipoff!==game.tipoff||
     !Number.isFinite(history.checkedAt)||history.checkedAt>now+60000||now-history.checkedAt>1800000||
     history.teams?.length!==2||!markets.has(quote.market))return {};
  const candidates=history.teams.flatMap(team=>(team.players||[]).map(player=>({...player,team})));
  const {player}=matchPlayer(candidates,quote.name);
  if(!player?.team.available||!Array.isArray(player.results)||player.available===false&&!player.unverified?.length)return {};
  const excluded=new Set([...(player.inactive||[]),...(player.unverified||[]),...(player.missing||[])].map(r=>String(r.gameId??r.id??r)));
  const occurrences=new Map();
  for(const r of player.results){const id=String(r.gameId);occurrences.set(id,(occurrences.get(id)||0)+1);}
  const cutoff=Math.min(now,Date.parse(game.tipoff));
  const values=player.results.filter(r=>/^\d{1,12}$/.test(String(r.gameId))&&!excluded.has(String(r.gameId))&&
   occurrences.get(String(r.gameId))===1&&Date.parse(r.tipoff)<cutoff&&Number.isInteger(r[quote.market])&&r[quote.market]>=0)
   .sort((a,b)=>Date.parse(b.tipoff)-Date.parse(a.tipoff)).map(r=>r[quote.market]);
  if(!values.length)return {};
  const priced=Number.isFinite(quote.line);
  return {games:values.length,recentValues:values.slice(0,5),above:priced?values.filter(v=>v>quote.line).length:null,
   below:priced?values.filter(v=>v<quote.line).length:null,equal:priced?values.filter(v=>v===quote.line).length:null};
 }
 function catalogRows(quotes,history,game,now=Date.now()){
  const rows=(quotes||[]).filter(q=>Number.isFinite(q.updatedAt)&&q.updatedAt<=now+60000&&now-q.updatedAt<=1800000&&Date.parse(game?.tipoff)>now);
  if(!history||String(history.gameId)!==String(game?.id)||history.tipoff!==game.tipoff||!Number.isFinite(history.checkedAt)||history.checkedAt>now+60000||now-history.checkedAt>1800000||Date.parse(game.tipoff)<=now)return rows;
  const all=(history.teams||[]).flatMap(t=>(t.players||[]).map(p=>({...p,teamAvailable:t.available})));
  const labels={player_points:'Points',player_rebounds:'Rebounds',player_assists:'Assists',player_threes:'Threes'};
  for(const p of all){
   if(!p.teamAvailable||p.available===false||!Array.isArray(p.results)||!matchPlayer(all,p.name).player)continue;
   for(const [market,label] of Object.entries(labels)){
    if(!p.results.some(r=>Number.isInteger(r[market])&&r[market]>=0))continue;
    if(rows.some(q=>q.market===market&&matchPlayer([p],q.name).player))continue;
    rows.push({name:p.name,market,label,line:null,over:null,under:null,unpriced:true,updatedAt:history.checkedAt});
   }
  }
  return rows;
 }
 function withScenario(prediction,mode='off'){
  if(!prediction.available)return prediction;
  const helper=typeof module!=='undefined'&&module.exports?require('./star-power'):root.Unit501StarPower;
  const base=prediction.scenario?.baseline??prediction.projection;
  const scenario=helper?.adjust(base,mode);
  if(!scenario)return prediction;
  return {...prediction,projection:scenario.adjusted,scenario};
 }
 function minuteChangeText(prediction){
  const change=prediction?.available&&prediction.minuteChange;
  if(!change||![change.recent,change.previous].every(Number.isFinite))return null;
  return 'Recent minutes '+change.direction+' · '+change.previous.toFixed(1)+' → '+change.recent.toFixed(1)+' · last '+change.recentGames+' vs earlier '+change.previousGames+' games';
 }
 const api={historicalCounts,catalogRows,project,withScenario,minuteChangeText,injuryStatus,matchPlayer,availabilityNote};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.Unit501NBAPlayerModel=api;
})(typeof window!=='undefined'?window:globalThis);
