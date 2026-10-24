(function(){
 'use strict';
 const byId=id=>document.getElementById(id);
 const shared=window.Unit501SharedUI;
 const dateInput=byId('nba-date'),status=byId('nba-status'),games=byId('nba-games'),load=byId('nba-load');
 const lab=byId('nba-lab'),players=byId('nba-player-lab');
 if(!dateInput||!games||!status||!load||!shared||!lab||!players)return;
 let request=0,contextRequest=0;
 const contextStatus=byId('nba-team-context-status'),comparison=byId('nba-team-comparison');
 const node=(tag,value,className)=>{
  const element=document.createElement(tag);
  element.textContent=String(value);
  if(className)element.className=className;
  return element;
 };
 function summaryLine(label,record){
  if(!record)return label+': no qualifying historical games';
  return label+': '+record.games+' games · '+record.pointsFor+' scored · '+
    record.pointsAgainst+' allowed · '+(record.net>0?'+':'')+record.net+' average margin';
 }
 async function loadContext(game){
  const token=++contextRequest;
  comparison.replaceChildren();
  contextStatus.textContent='Checking earlier NBA team scores…';
  try{
   const query=new URLSearchParams({date:dateInput.value,game:String(game.id)});
   const res=await fetch('/api/nba/context?'+query,{signal:AbortSignal.timeout(17000)});
   const data=await res.json();
   if(token!==contextRequest)return;
   if(!res.ok)throw Error('NBA history not available');
   if(!data.away||!data.home){
    contextStatus.textContent=data.reason||'NBA historical comparison not yet available for this game.';
    return;
   }
   for(const side of [data.away,data.home]){
    const card=node('section','', 'nba-team-history');
    card.append(node('h4',side.name),node('p',side.sampleLabel||'History unavailable','war-muted'));
    card.append(node('p',summaryLine('Season',side.season)));
    card.append(node('p',summaryLine('Last 10',side.recent10)));
    card.append(node('p',summaryLine('Last 5',side.recent5)));
    if(side.lastPlayedAt)card.append(node('p','Previous tipoff: '+shared.timeCentral(side.lastPlayedAt),'war-muted'));
    comparison.append(card);
   }
   contextStatus.textContent=data.message||'Historical scoring data loaded.';
  }catch{
   if(token!==contextRequest)return;
   comparison.replaceChildren();
   contextStatus.textContent='NBA team history unavailable. Check API-NBA access; no projections were generated.';
  }
 }
function choose(game){
   byId('nba-matchup').textContent=shared.matchup(game.away,game.home);
   byId('nba-game-context').textContent=shared.timeCentral(game.tipoff)+' | '+game.status+
     (game.awayScore!==null&&game.homeScore!==null?' | '+game.away+' '+game.awayScore+' – '+game.home+' '+game.homeScore:'');
   byId('nba-prediction').textContent='Unavailable: no validated NBA score model yet.';
   loadContext(game);
   lab.classList.remove('hidden');
   players.classList.remove('hidden');
   lab.scrollIntoView?.({behavior:'smooth',block:'start'});
 }
 async function refresh(){
  const date=dateInput.value;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)){status.textContent='Choose a valid NBA game date.';return;}
  ++contextRequest;
  const serial=++request;load.disabled=true;games.replaceChildren();lab.classList.add('hidden');players.classList.add('hidden');status.textContent='Loading NBA schedule…';
  try{
   const response=await fetch('/api/nba/games?date='+encodeURIComponent(date),{signal:AbortSignal.timeout(17000)});
   const data=await response.json();
   if(serial!==request)return;
   if(!response.ok||!Array.isArray(data.games))throw Error(data.code==='NBA_PLAN_ACCESS'?data.error:'NBA games could not be loaded. Check the NBA connection and try again.');
   if(!data.games.length){status.textContent='No NBA games returned for this date. Check official schedule or try another date.';return;}
   for(const game of data.games){
    const score=game.awayScore!==null&&game.homeScore!==null?
      ' | '+game.away+' '+game.awayScore+' – '+game.home+' '+game.homeScore:'';
    const card=shared.gameCard({
      away:game.away,home:game.home,container:games,
      detailText:shared.timeCentral(game.tipoff)+' | '+game.status+score,
      actionLabel:'Open NBA Game Lab →',cardClass:'card game nba-game',
      onSelect:()=>choose(game)
    });
    games.append(card);
   }
   status.textContent=data.games.length+' NBA game(s) loaded · updated '+new Date(data.checkedAt).toLocaleTimeString()+
    '. Schedule/results only; NBA projections are not active.';
  }catch(error){
   if(serial!==request)return;
   games.replaceChildren();
   status.textContent=error.message;
  }finally{if(serial===request)load.disabled=false;}
 }
 dateInput.value=shared.dateCentral();
 load.addEventListener('click',refresh);
 dateInput.addEventListener('change',refresh);
 byId('nba-clear').addEventListener('click',()=>{
   ++contextRequest;
   lab.classList.add('hidden');players.classList.add('hidden');
   for(const card of games.querySelectorAll('.game')){card.classList.remove('selected');card.setAttribute('aria-pressed','false');}
   games.scrollIntoView?.({behavior:'smooth',block:'start'});
 });
 // Monitoring is explicitly enabled and only runs while this page is visible.
 const alertToggle=byId('nba-alert-enable'),alertStatus=byId('nba-alert-status'),alertList=byId('nba-alert-list');
 const track=window.Unit501NBAAlerts.createTracker();
 let watching=false,watchTimer=null;
 byId('nba-alert-permission').addEventListener('click',async()=>{
  if(!('Notification' in window)){alertStatus.textContent='Browser notifications unavailable here; alerts still appear on this page.';return;}
  try{const permission=await Notification.requestPermission();alertStatus.textContent=permission==='granted'?'Browser notifications enabled. Turn on the watch to begin.':'Notifications not enabled; alerts still appear on this page.';}catch{alertStatus.textContent='Browser notifications unavailable; alerts still appear on this page.';}
 });
 async function watch(){
  if(!alertToggle.checked||watching||document.hidden)return;
  watching=true;
  try{
   const response=await fetch('/api/nba/games?date='+shared.dateCentral(),{signal:AbortSignal.timeout(17000)});
   const data=await response.json();
   if(!alertToggle.checked)return;
   if(!response.ok){alertToggle.checked=false;throw Error(data.error||'NBA data unavailable; watch stopped.');}
   for(const alert of track(data.games)){
    const message=alert.team+' down '+alert.deficit+' in Q'+alert.period+' · '+alert.score;
    alertList.prepend(node('p',message));
    if('Notification' in window&&Notification.permission==='granted'){
     try{new Notification('Unit 501: first-half deficit',{body:message,tag:'nba-'+alert.id+'-'+alert.team});}catch{/* Inline alert remains visible. */}
    }
   }
   alertStatus.textContent='Watching today · checked '+new Date(data.checkedAt).toLocaleTimeString()+'. One alert per trailing team per game. This is a score alert, not a comeback prediction.';
  }catch(error){alertStatus.textContent=error.message;}
  finally{watching=false;if(alertToggle.checked)watchTimer=setTimeout(watch,60000);}
 }
 alertToggle.addEventListener('change',()=>{
  clearTimeout(watchTimer);
  if(alertToggle.checked)watch();else alertStatus.textContent='Watch off.';
 });
 document.addEventListener('visibilitychange',()=>{
  clearTimeout(watchTimer);
  if(!document.hidden&&alertToggle.checked)watch();
 });
})();