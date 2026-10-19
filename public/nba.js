(function(){
 'use strict';
 const byId=id=>document.getElementById(id);
 const dateInput=byId('nba-date'),status=byId('nba-status'),games=byId('nba-games'),load=byId('nba-load');
 if(!dateInput||!games||!status||!load)return;
 function todayChicago(){
  const fields=new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  const pick=name=>fields.find(x=>x.type===name).value;
  return pick('year')+'-'+pick('month')+'-'+pick('day');
 }
 function node(tag,text,cls){
  const e=document.createElement(tag);
  if(text!==undefined&&text!==null)e.textContent=String(text);
  if(cls)e.className=cls;
  return e;
 }
 const when=stamp=>new Intl.DateTimeFormat('en-US',{
  timeZone:'America/Chicago',weekday:'short',month:'short',day:'numeric',
  hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(new Date(stamp));
 let request=0;
 async function refresh(){
  const date=dateInput.value;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)){
   status.textContent='Choose a valid game date.';return;
  }
  const serial=++request;load.disabled=true;games.replaceChildren();status.textContent='Loading NBA schedule…';
  try{
   const response=await fetch('/api/nba/games?date='+encodeURIComponent(date),{signal:AbortSignal.timeout(17000)});
   const data=await response.json();
   if(serial!==request)return;
   if(!response.ok||!Array.isArray(data.games))throw Error('NBA feed unavailable');
   if(!data.games.length){status.textContent='No NBA games returned for this date. Check official schedule or try another date.';return;}
   for(const game of data.games){
    const card=node('article',null,'nba-game');
    card.append(node('h3',game.away+' @ '+game.home));
    card.append(node('p',when(game.tipoff)));
    card.append(node('p',game.status));
    if(game.awayScore!==null&&game.homeScore!==null)
     card.append(node('p',game.away+' '+game.awayScore+' — '+game.home+' '+game.homeScore,'nba-score'));
    if(game.arena)card.append(node('p',game.arena,'war-muted'));
    games.append(card);
   }
   status.textContent=data.games.length+' NBA game(s) loaded · updated '+new Date(data.checkedAt).toLocaleTimeString()+
    '. Schedule/results only; NBA projections are not active.';
  }catch(error){
   if(serial!==request)return;
   games.replaceChildren();
   status.textContent='NBA games could not be loaded. The NBA API connection may not be enabled. No predictions were generated.';
  }finally{if(serial===request)load.disabled=false;}
 }
 dateInput.value=todayChicago();
 load.addEventListener('click',refresh);
 dateInput.addEventListener('change',refresh);
 // Intentionally no automatic background polling: avoid burning a shared API quota.
})();