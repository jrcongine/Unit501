/* Read-only market direction display: FanDuel observed lines vs separate sampled bets/money. */
(function(root){
 'use strict';
 const signed=n=>Number.isFinite(n)?(n>0?'+':'')+n.toFixed(1):'—';
 const validPct=n=>Number.isFinite(n)&&n>=0&&n<=100;
 function movement(kind,observation,away,home){
  if(!['spread','total'].includes(kind))return null;
  if(!observation||![observation.firstLine,observation.line].every(Number.isFinite))
   return {label:kind==='spread'?'Spread':'Game total',text:'No verified FanDuel observations yet.',tone:'unknown'};
  const {firstLine,line}=observation,delta=Math.round((line-firstLine)*100)/100;
  const number=kind==='spread'?signed:n=>n.toFixed(1);
  const label=kind==='spread'?'Away spread':'Game total';
  if(!delta){
   if(observation.changes>0)return {label,text:'First observed '+number(firstLine)+' → '+number(line)+' · returned after '+observation.changes+' changes',tone:'flat'};
   if(!Number.isFinite(observation.firstAt)||!Number.isFinite(observation.lastAt)||observation.lastAt<=observation.firstAt)
    return {label,text:'First observed '+number(firstLine)+' · waiting for another observation',tone:'unknown'};
   return {label,text:'First observed '+number(firstLine)+' · unchanged across recorded updates',tone:'flat'};
  }
  const toward=kind==='spread'?(delta>0?home:away):(delta>0?'Over':'Under');
  const arrow=delta>0?'↑':'↓';
  return {label,text:number(firstLine)+' → '+number(line)+' ('+arrow+' '+Math.abs(delta).toFixed(1)+'; toward '+toward+')',tone:delta>0?'up':'down',toward};
 }
 function percentages(part,left,right,leftName,rightName){
  if(!part)return null;
  const lb=part[left+'Bets'],rb=part[right+'Bets'],lm=part[left+'Money'],rm=part[right+'Money'];
  if(![lb,rb].every(validPct)||Math.abs(lb+rb-100)>1)return null;
  const moneyValid=[lm,rm].every(validPct)&&Math.abs(lm+rm-100)<=1;
  const fmt=n=>Number(n.toFixed(1))+'%';
  return {bets:leftName+' '+fmt(lb)+' / '+rightName+' '+fmt(rb),
    money:moneyValid?leftName+' '+fmt(lm)+' / '+rightName+' '+fmt(rm):'Not supplied',
    leader:lb===rb?'Even':lb>rb?leftName:rightName};
 }
 function splits(report,game,now=Date.now()){
  if(!report?.available||!game||String(report.gameId)!==String(game.id)||
     String(report.league)!==String(game.league)||String(report.season)!==String(game.season)||
     report.kickoff!==game.kickoff||!Number.isFinite(report.fetchedAt)||
     report.fetchedAt>now+60000||now-report.fetchedAt>900000)
    return {available:false,reason:'Current sourced betting percentages unavailable.'};
  const spread=percentages(report.spread,'away','home',game.a,game.h);
  const total=percentages(report.total,'over','under','Over','Under');
  if(!spread&&!total)return {available:false,reason:'Spread and total betting percentages unavailable.'};
  return {available:true,spread,total,source:String(report.source||'Unspecified source'),
   url:typeof report.url==='string'&&/^https:\/\//.test(report.url)?report.url:null,
   sourceTimeVerified:Number.isFinite(report.sourceAt)&&report.sourceAt<=now&&now-report.sourceAt<=1800000};
 }
 const api={movement,splits};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 else root.Unit501MarketPulse=api;
})(typeof globalThis!=='undefined'?globalThis:this);
