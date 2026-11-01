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
 function footballSeason(date){
   if(!/^\d{4}-(0[1-9]|1[0-2])-\d{2}$/.test(date||''))return null;
   return String(Number(date.slice(0,4))-(Number(date.slice(5,7))<=2?1:0));
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
   if(typeof document!=='undefined'&&typeof CustomEvent==='function')document.dispatchEvent(new CustomEvent('unit501:standings-updated',{detail:{league,report}}));
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
 function renderVenueDistance(element,result,doc=(typeof document!=='undefined'?document:null)){
   if(!element||!doc)return;
   element.replaceChildren();element.hidden=true;
   if(!result||!Number.isFinite(result.miles)||result.miles<0)return;
   const summary=doc.createElement('summary');
   summary.textContent='Venue distance · ~'+Math.round(result.miles).toLocaleString('en-US')+' miles'+(result.cityPrecision!==false?' (city estimate)':'');
   const detail=doc.createElement('p');
   detail.textContent=[(result.previous||result.previousCity)&&(result.current||result.currentCity)?(result.previous||result.previousCity)+' → '+(result.current||result.currentCity):null,'Straight-line distance between recorded game venues. Actual route, transport and travel time are unknown.'].filter(Boolean).join(' · ');
   element.append(summary,detail);element.className='venue-distance';element.hidden=false;
 }
 function matchupHeading(away,home,awayLogo,homeLogo,doc){
   const title=doc.createElement('b');title.className='game-title';
   const safe=url=>typeof url==='string'&&/^https:\/\/(?:[a-z0-9-]+\.)*(?:espncdn\.com|api-sports\.io|nba\.com)\/[^\s]*$/i.test(url);
   if(!safe(awayLogo)&&!safe(homeLogo)){title.textContent=matchup(away,home);return title;}
   for(const [index,name,url] of [[0,away,awayLogo],[1,home,homeLogo]]){
     if(index){const at=doc.createElement('span');at.textContent=' @ ';at.className='game-at';title.append(at);}
     const team=doc.createElement('span');team.className='game-team';
     if(safe(url)){const logo=doc.createElement('img');logo.className='game-team-logo';logo.src=url;logo.alt='';logo.width=24;logo.height=24;logo.loading='lazy';logo.referrerPolicy='no-referrer';logo.addEventListener('error',()=>{logo.hidden=true;});team.append(logo);}
     const label=doc.createElement('span');label.textContent=name;team.append(label);title.append(team);
   }
   return title;
 }
 function gameCard({away,home,awayLogo,homeLogo,detailText,seasonRecord=null,actionLabel='Open Game Lab →',onSelect,container,doc=(typeof document!=='undefined'?document:null),cardClass='card game'}){
   if(!doc||!container||typeof onSelect!=='function')throw Error('Game card requires document, container and selection callback');
   const card=doc.createElement('div');
   card.className=cardClass;
   const title=matchupHeading(away,home,awayLogo,homeLogo,doc);
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
 function upsetOutlook(prediction,awaySpread,simulation){
   if(!prediction?.available||![prediction.away,prediction.home,awaySpread].every(Number.isFinite))return null;
   const winner=prediction.away>prediction.home?'away':prediction.home>prediction.away?'home':null;
   const underdog=awaySpread>0?'away':awaySpread<0?'home':null;
   const margin=prediction.away-prediction.home;
   const awayWin=simulation?.awayWin??simulation?.win;
   const tie=simulation?.tie;
   const valid=Number.isFinite(awayWin)&&Number.isFinite(tie)&&awayWin>=0&&tie>=0&&awayWin+tie<=1+1e-12;
   // Raw frequencies retain ties as unresolved. Never invent overtime winners
   // or let conditional/calibrated probabilities silently change this gate.
   const dogWin=valid?(underdog==='away'?awayWin:Math.max(0,1-awayWin-tie)):null;
   const lean=!!underdog&&winner===underdog;
   const upset=lean&&Math.abs(margin)>=2&&dogWin!==null&&dogWin>=.55;
   return {winner,underdog,margin,lean,upset,dogWin,
     reason:'Review threshold: at least 2 projected points and 55% raw simulated wins; not a calibrated betting edge.'};
 }
 function historyFreshness(checkedAt,now=Date.now()){
   const at=typeof checkedAt==='number'?checkedAt:typeof checkedAt==='string'&&checkedAt.trim()?Date.parse(checkedAt):NaN;
   const expiresAt=at+3600001;
   return {fresh:Number.isFinite(at)&&at>0&&at<=now+60000&&now<expiresAt,at,expiresAt};
 }
 // The same four tiles as football. Call with null to withdraw stale results.
 function resultTiles(prefix,prediction,metrics={},doc=typeof document!=='undefined'?document:null){
   if(!prediction?.available)metrics={};
   const percent=n=>Number.isFinite(n)&&n>=0&&n<=1?(n*100).toFixed(1)+'%':'—';
   const score=prediction?.available&&[prediction.away,prediction.home].every(Number.isFinite)
     ?Math.round(prediction.away)+'–'+Math.round(prediction.home):'—';
   for(const [key,value]of Object.entries({score,cover:percent(metrics.cover),over:percent(metrics.over),win:percent(metrics.win)})){
     const element=doc?.getElementById(prefix+'-'+key);if(element)element.textContent=value;
   }
 }
 return Object.freeze({resultTiles,historyFreshness,dateCentral,footballSeason,timeCentral,matchup,matchupHeading,renderVenueDistance,gameCard,selection,upsetOutlook,marketComparison,showMarketComparison,seasonStanding,currentStanding,updateGameRecords});
});
