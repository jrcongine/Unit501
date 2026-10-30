/* Cross-sport UI primitives. Football and basketball share controls, not scoring assumptions. */
(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.Unit501SharedUI=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const TZ='America/Chicago';
 function dateCentral(date=new Date()){
   const parts=new Intl.DateTimeFormat('en-US',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
   const v=t=>parts.find(p=>p.type===t)?.value;
   return v('year')+'-'+v('month')+'-'+v('day');
 }
 function timeCentral(value){
   const ms=typeof value==='number'?value:Date.parse(value);
   if(!Number.isFinite(ms))return 'Time TBD';
   return new Intl.DateTimeFormat('en-US',{timeZone:TZ,weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(ms);
 }
 function matchup(away,home){return String(away)+' @ '+String(home);}
 function normalizedTeamName(value){
   return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
 }
 // ESPN standings and API-Sports fixtures use different numeric team ID namespaces.
 // Match only a unique team name in the same league and season; otherwise withhold.
 function seasonStanding(report,league,season,teamName){
   if(!report||report.league!==league||String(report.season)!==String(season)||
      !report.power?.available||!Array.isArray(report.power.teams)||!teamName)return null;
   const key=normalizedTeamName(teamName);
   if(!key)return null;
   const matches=report.power.teams.filter(team=>
     normalizedTeamName(team.name)===key||normalizedTeamName(team.providerName)===key);
   if(matches.length!==1)return null;
   const standing=matches[0];
   return /^\d+-\d+(?:-\d+)?$/.test(String(standing.record||''))?standing:null;
 }

 const recordCards=new Set(),recordReports=new Map();
 function currentStanding(report,league,season,name,date,now=Date.now()){
   const at=Date.parse(report?.power?.asOf);
   if(!/^\d{4}-\d{2}-\d{2}$/.test(String(date))||date<dateCentral(new Date(now))||!Number.isFinite(at)||at>now+60000||now-at>3600000)return null;
   return seasonStanding(report,league,season,name);
 }
 function updateGameRecords(report,league=report?.league,now=Date.now()){
   if(league)recordReports.set(league,report);
   for(const entry of recordCards){
     if(entry.card.isConnected===false){recordCards.delete(entry);continue;}
     const {scope,away,home,node}=entry,data=recordReports.get(scope.league);
     const a=currentStanding(data,scope.league,scope.season,away,scope.date,now),h=currentStanding(data,scope.league,scope.season,home,scope.date,now);
     node.textContent=a||h?'Current season · '+away+' '+(a?.record||'unavailable')+' · '+home+' '+(h?.record||'unavailable'):'';
     node.hidden=!(a||h);
     node.title=a||h?'ESPN standings · '+scope.season+' season · checked '+timeCentral(data.power.asOf):'';
   }
 }
 function selection(container,current,classname='game'){
   for(const other of container.querySelectorAll('.'+classname)){
     other.classList.remove('selected');
     other.setAttribute('aria-pressed','false');
   }
   current.classList.add('selected');
   current.setAttribute('aria-pressed','true');
 }
 function gameCard({away,home,detailText,seasonRecord=null,actionLabel='Open Game Lab →',onSelect,container,doc=(typeof document!=='undefined'?document:null),cardClass='card game'}){
   if(!doc||!container||typeof onSelect!=='function')throw Error('Game card requires document, container and selection callback');
   const card=doc.createElement('div');
   card.className=cardClass;
   const title=doc.createElement('b');title.className='game-title';title.textContent=matchup(away,home);
   const details=doc.createElement('p');details.textContent=String(detailText||'');
   const action=doc.createElement('span');action.className='open-game';action.textContent=actionLabel;
   action.setAttribute('aria-hidden','true');
   card.append(title,details,action);
   if(seasonRecord){
     const node=doc.createElement('small');node.className='game-records';node.hidden=true;card.append(node);
     recordCards.add({card,node,scope:seasonRecord,away,home});
   }
   card.setAttribute('role','button');
   card.setAttribute('tabindex','0');
   card.setAttribute('aria-pressed','false');
   card.setAttribute('aria-label','Open Game Lab for '+away+' at '+home);
   const activate=()=>{selection(container,card);onSelect();};
   card.addEventListener('click',activate);
   card.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();activate();}});
   return card;
 }
 function marketComparison(prediction,lines={},source='Entered lines'){
   if(!prediction?.available||![prediction.away,prediction.home].every(n=>Number.isFinite(n)&&n>=0))return null;
   const spreadGap=Number.isFinite(lines.awaySpread)?prediction.away-prediction.home+lines.awaySpread:null;
   const totalGap=Number.isFinite(lines.total)&&lines.total>0?prediction.away+prediction.home-lines.total:null;
   if(spreadGap===null&&totalGap===null)return null;
   const signed=n=>(n>=0?'+':'')+n.toFixed(1);
   const large=Math.abs(spreadGap??0)>=7||Math.abs(totalGap??0)>=10;
   const text=(large?'Large model/line difference · ':'Model/line comparison · ')+source+' · '+[
    spreadGap!==null?'Away margin gap '+signed(spreadGap)+' pts':null,
    totalGap!==null?'Total gap '+signed(totalGap)+' pts':null].filter(Boolean).join(' · ');
   return {spreadGap,totalGap,large,text};
 }
 function showMarketComparison(element,prediction,lines,source){
   if(!element)return;
   const comparison=marketComparison(prediction,lines,source);
   element.hidden=!comparison;element.textContent=comparison?.text||'';
   element.className=comparison?.large?'market-gap market-gap-large':'market-gap';
   element.title='Positive away margin gap means Unit 501 favors the away side more than the entered spread. Positive total gap means a higher model total. Review flags start at 7 spread points or 10 total points; these are display thresholds, not calibrated betting edges.';
 }
 function upsetOutlook(prediction,awaySpread){
   if(!prediction?.available||![prediction.away,prediction.home,awaySpread].every(Number.isFinite))return null;
   const winner=prediction.away>prediction.home?'away':prediction.home>prediction.away?'home':null;
   const underdog=awaySpread>0?'away':awaySpread<0?'home':null;
   return {winner,underdog,upset:!!underdog&&winner===underdog};
 }
 return Object.freeze({dateCentral,timeCentral,matchup,gameCard,selection,upsetOutlook,marketComparison,showMarketComparison,seasonStanding,currentStanding,updateGameRecords});
});
