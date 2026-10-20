/* User-requested timing scenarios; assumptions, not fitted effects. */
(function(root){
 'use strict';
 const version='spotlight-v1';
 function windowFor(game){
  if(String(game?.league)!=='1'||!Number.isFinite(game?.kickoff))return 'none';
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',weekday:'short',hour:'2-digit',hourCycle:'h23'}).formatToParts(new Date(game.kickoff));
  const day=parts.find(p=>p.type==='weekday').value,hour=Number(parts.find(p=>p.type==='hour').value);
  if(['Sun','Mon'].includes(day)&&hour>=19)return 'spotlight';
  if(day==='Sun'&&hour>=12&&hour<16)return 'early';
  return 'none';
 }
 function role(history){
  const recent=[...history].sort((a,b)=>b.gameDate-a.gameDate).slice(0,3);
  if(recent.length<3)return null;
  const qualifies=(key,min)=>recent.every(g=>Number.isFinite(g[key]))&&recent.reduce((s,g)=>s+g[key],0)/3>=min;
  if(qualifies('attempts',28))return 'QB';
  if(qualifies('carries',14))return 'RB';
  if(qualifies('targets',7))return 'WR';
  return null;
 }
 function player({game,market,value,starRole,enabled=false,workload=100,weatherFactor=1,blocked=false}){
  const window=windowFor(game),base={value,baseline:value,delta:0,applied:false,window,version,starRole};
  const match={QB:['passYds',20],WR:['recYds',12.5],RB:['rushYds',17.5]}[starRole];
  if(!enabled||blocked||!match||market!==match[0]||window==='none'||!Number.isFinite(value)||value<=0||!Number.isFinite(workload)||workload<=0||workload>100||!Number.isFinite(weatherFactor)||weatherFactor<0||weatherFactor>1)return base;
  const next=Math.max(0,value+match[1]*(window==='early'?-.5:1)*workload/100*weatherFactor);
  return {...base,value:next,delta:next-value,applied:true};
 }
 function team({game,away,home,awaySpread,enabled=false}){
  const base={away,home,applied:false,version,marginReduction:0};
  if(!enabled||windowFor(game)!=='early'||![away,home,awaySpread].every(Number.isFinite)||away<0||home<0||awaySpread===0)return base;
  // Only reduce a margin when the score model agrees with the market favorite.
  if((home-away)*awaySpread<=0)return base;
  const reduction=Math.min(Math.abs(home-away)*.15,2),transfer=reduction/2*Math.sign(home-away);
  return {...base,away:away+transfer,home:home-transfer,applied:true,marginReduction:reduction};
 }
 const api={version,windowFor,role,player,team};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.Unit501Spotlight=api;
})(typeof globalThis!=='undefined'?globalThis:this);
