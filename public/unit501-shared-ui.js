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

 function selection(container,current,classname='game'){
   for(const other of container.querySelectorAll('.'+classname)){
     other.classList.remove('selected');
     other.setAttribute('aria-pressed','false');
   }
   current.classList.add('selected');
   current.setAttribute('aria-pressed','true');
 }
 function gameCard({away,home,detailText,actionLabel='Open Game Lab →',onSelect,container,doc=(typeof document!=='undefined'?document:null),cardClass='card game'}){
   if(!doc||!container||typeof onSelect!=='function')throw Error('Game card requires document, container and selection callback');
   const card=doc.createElement('div');
   card.className=cardClass;
   const title=doc.createElement('b');title.className='game-title';title.textContent=matchup(away,home);
   const details=doc.createElement('p');details.textContent=String(detailText||'');
   const action=doc.createElement('span');action.className='open-game';action.textContent=actionLabel;
   action.setAttribute('aria-hidden','true');
   card.append(title,details,action);
   card.setAttribute('role','button');
   card.setAttribute('tabindex','0');
   card.setAttribute('aria-pressed','false');
   card.setAttribute('aria-label','Open Game Lab for '+away+' at '+home);
   const activate=()=>{selection(container,card);onSelect();};
   card.addEventListener('click',activate);
   card.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();activate();}});
   return card;
 }
 function upsetOutlook(prediction,awaySpread){
   if(!prediction?.available||![prediction.away,prediction.home,awaySpread].every(Number.isFinite))return null;
   const winner=prediction.away>prediction.home?'away':prediction.home>prediction.away?'home':null;
   const underdog=awaySpread>0?'away':awaySpread<0?'home':null;
   return {winner,underdog,upset:!!underdog&&winner===underdog};
 }
 return Object.freeze({dateCentral,timeCentral,matchup,gameCard,selection,upsetOutlook,seasonStanding});
});
