(function(root,factory){
 const api=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.Unit501ComebackHistory=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 // Observed opportunities only: no claim of complete season coverage or verified sportsbook returns.
 const STAKE=5;
 const THRESHOLD=20;
 function validScore(n){return Number.isSafeInteger(n)&&n>=0;}
 function observation(alert,observedAt,gameDate){
  if(!alert||!Number.isSafeInteger(alert.id)||alert.id<=0||
     !Number.isSafeInteger(alert.deficit)||alert.deficit<THRESHOLD||
     ![1,2].includes(alert.period)||
     !['away','home'].every(side=>typeof alert[side]==='string'&&alert[side].trim())||
     !validScore(alert.awayScore)||!validScore(alert.homeScore)||
     Math.abs(alert.awayScore-alert.homeScore)!==alert.deficit||
     !Number.isFinite(observedAt)||!/\d{4}-\d{2}-\d{2}/.test(gameDate||''))return null;
  const behind=alert.awayScore<alert.homeScore?alert.away:alert.home;
  const ahead=alert.awayScore<alert.homeScore?alert.home:alert.away;
  if(alert.trailing!==behind||alert.leading!==ahead)return null;
  return {id:alert.id,gameDate,observedAt,tipoff:typeof alert.tipoff==='string'&&Number.isFinite(Date.parse(alert.tipoff))?alert.tipoff:null,
   away:alert.away,home:alert.home,trailing:behind,leading:ahead,
   firstDeficit:alert.deficit,quarter:alert.period,clock:alert.clock||null,
   triggeredAway:alert.awayScore,triggeredHome:alert.homeScore,
   result:'pending',finalAway:null,finalHome:null,
   recordedOdds:null,oddsRecordedAt:null};
 }
 function add(records,alert,at,date){
  const current=Array.isArray(records)?records:[];
  const item=observation(alert,at,date);
  if(!item||current.some(r=>r.id===item.id))return {records:current,added:false};
  return {records:[...current,item].slice(-250),added:true};
 }
 function applyFinals(records,games){
  if(!Array.isArray(records)||!Array.isArray(games))return {records:records||[],changed:false};
  const lookup=new Map(games.filter(g=>g&&Number.isSafeInteger(g.id)).map(g=>[g.id,g]));
  let changed=false;
  const updated=records.map(record=>{
   if(record.result!=='pending')return record;
   const game=lookup.get(record.id);
   if(!game||game.status!=='Final'||game.away!==record.away||game.home!==record.home||
    !validScore(game.awayScore)||!validScore(game.homeScore)||game.awayScore===game.homeScore)return record;
   const won=(record.trailing===record.away)?game.awayScore>game.homeScore:game.homeScore>game.awayScore;
   changed=true;
   return {...record,result:won?'won':'lost',finalAway:game.awayScore,finalHome:game.homeScore};
  });
  return {records:updated,changed};
 }
 function parseOdds(raw){
  const text=String(raw??'').trim();
  if(!/^[+-]?\d{3,5}$/.test(text))return null;
  const n=Number(text);
  return Number.isSafeInteger(n)&&Math.abs(n)>=100&&Math.abs(n)<=10000?n:null;
 }
 function enterPrice(records,id,raw,at){
  const odds=parseOdds(raw);
  if(odds===null||!Array.isArray(records))return {records:records||[],changed:false};
  let changed=false;
  const updated=records.map(record=>{
   if(record.id!==id||record.result!=='pending'||record.recordedOdds!==null||
     at<record.observedAt||at-record.observedAt>600000)return record;
   changed=true;
   return {...record,recordedOdds:odds,oddsRecordedAt:at};
  });
  return {records:updated,changed};
 }
 function paperProfit(record){
  if(record.result==='pending'||parseOdds(record.recordedOdds)===null)return null;
  if(record.result==='lost')return -STAKE;
  const price=record.recordedOdds;
  return Math.round((price>0?STAKE*price/100:STAKE*100/-price)*100)/100;
 }
 function summary(records){
  const rows=Array.isArray(records)?records:[];
  const completed=rows.filter(r=>r.result==='won'||r.result==='lost');
  const recovered=completed.filter(r=>r.result==='won').length;
  const priced=completed.filter(r=>paperProfit(r)!==null);
  const pnl=priced.reduce((sum,r)=>sum+paperProfit(r),0);
  return {observed:rows.length,pending:rows.length-completed.length,graded:completed.length,recovered,
   recoveredPercent:completed.length?Math.round(recovered/completed.length*1000)/10:null,
   priced:priced.length,paperProfit:Math.round(pnl*100)/100,
   paperROI:priced.length?Math.round(pnl/(priced.length*STAKE)*1000)/10:null};
 }
 return Object.freeze({observation,add,applyFinals,enterPrice,parseOdds,paperProfit,summary,STAKE,THRESHOLD});
});