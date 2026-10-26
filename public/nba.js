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
 let activeContext=null;
 const formWindow=byId('nba-form-window'),headToHead=byId('nba-head-to-head');
 const signed=value=>Number.isFinite(value)?(value>0?'+':'')+value.toFixed(1):'—';
 function renderProjection(){
  const output=byId('nba-prediction'),detail=byId('nba-prediction-detail');
  detail.textContent='';
  const alert=byId('nba-upset-pick');alert.hidden=true;alert.textContent='';
  const simulation=byId('nba-simulation'),simulationDetail=byId('nba-simulation-detail');simulation.textContent='';simulationDetail.textContent='';
  if(!activeContext){output.textContent='Estimate unavailable until matching team history loads.';return;}
  const {game,data}=activeContext;
  const result=window.Unit501NBAModel.project(game,data,formWindow.value);
  if(!result.available){output.textContent=result.reason;return;}
  output.textContent=game.away+' '+result.away.toFixed(1)+' · '+game.home+' '+result.home.toFixed(1)+' | Total '+result.total.toFixed(1)+' | '+game.home+' spread '+signed(result.homeSpread);
  const line=window.Unit501NBAMarkets?.spreadFor?.(game);
  const outlook=shared.upsetOutlook(result,line);
  if(outlook?.upset){
   alert.hidden=false;alert.className='automatic-upset-pick';
   alert.textContent='⚠ UPSET ALERT · '+(outlook.winner==='away'?game.away:game.home)+' projected to win outright as the spread underdog.';
  }
  // Stable seed avoids changing displayed results merely because a quote redraws.
  let seed=(Number(game.id)>>>0)||1;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const lines=window.Unit501NBAMarkets?.linesFor?.(game)||{};
  const sim=window.Unit501NBAModel.simulate(result,data,lines,10000,random);
  if(sim.available){
   const percent=n=>(n*100).toFixed(1)+'%';
   let message='10,000 simulations · '+game.away+' win '+percent(sim.awayWin)+' · '+game.home+' win '+percent(sim.homeWin)+' · tie '+percent(sim.tie);
   if(sim.spread)message+=' · '+game.away+' '+signed(sim.spread.line)+' cover '+percent(sim.spread.away)+' · '+game.home+' cover '+percent(sim.spread.home)+' · push '+percent(sim.spread.push);
   if(sim.total)message+=' · Over '+sim.total.line+' '+percent(sim.total.over)+' · Under '+percent(sim.total.under)+' · push '+percent(sim.total.push);
   simulation.textContent=message;
   simulationDetail.textContent='Experimental frequencies, not calibrated odds. Resamples each team’s last '+sim.sampleGames[0]+'/'+sim.sampleGames[1]+' completed games; does not account for injuries, player minutes or overtime.';
  }else simulation.textContent=sim.reason;
  detail.textContent=result.awayGames+'/'+result.homeGames+' games (away/home). '+(result.thin?'Small sample. ':'')+result.explanation;
 }
 function renderHeadToHead(){
  renderProjection();
  headToHead.replaceChildren();
  if(!activeContext)return;
  const {data,game}=activeContext;
  const scope=formWindow.value;
  const record=(side,away)=>scope==='venue'?(away?side.awaySplit:side.homeSplit):side[scope];
  const away=record(data.away,true),home=record(data.home,false);
  const title={season:'Season',recent10:'Last 10',recent5:'Last 5',venue:'Road team away / home team at home'}[scope]||'Season';
  const table=node('table','');table.className='nba-form-table';
  table.append(node('caption',title+' · completed games before this matchup'));
  const header=node('tr','');
  for(const label of ['Metric',game.away+' (away)',game.home+' (home)']){const th=node('th',label);th.scope='col';header.append(th);}
  const thead=node('thead','');thead.append(header);table.append(thead);
  const body=node('tbody','');
  for(const [label,field,format] of [
   ['Games','games',v=>String(v)],['Record',null,(v,r)=>r.wins+'–'+r.losses],
   ['Points scored / game','pointsFor',v=>v.toFixed(1)],['Points allowed / game','pointsAgainst',v=>v.toFixed(1)],
   ['Average margin','net',signed]
  ]){
   const row=node('tr',''),heading=node('th',label);heading.scope='row';row.append(heading);
   for(const r of [away,home])row.append(node('td',r?format(r[field],r):'—'));
   body.append(row);
  }
  table.append(body);headToHead.append(table);
  if(!away||!home)headToHead.append(node('p','One or both teams have no qualifying games in this view.','nba-sample-note'));
  else if(Math.min(away.games,home.games)<5)headToHead.append(node('p','Early sample: at least one side has fewer than five games in this view.','nba-sample-note'));
  const ar=data.away.rest,hr=data.home.rest;
  if(ar?.available&&hr?.available&&ar.fullDaysOff!==hr.fullDaysOff){
   const rested=ar.fullDaysOff>hr.fullDaysOff?game.away:game.home;
   headToHead.append(node('p','Rest difference: '+rested+' has '+Math.abs(ar.fullDaysOff-hr.fullDaysOff)+' more full day(s) off. No automatic score adjustment.','nba-rest-comparison'));
  }
 }
 function renderTeam(side){
  const card=node('section','', 'nba-team-history');
  card.append(node('h4',side.name),node('p',side.sampleLabel||'History unavailable','nba-sample-note'));
  const rest=side.rest;
  if(rest?.available){
   const label=rest.sameDay?'Same-day game':rest.backToBack?'Back to back':rest.fullDaysOff+' full day(s) off';
   card.append(node('p',label+(rest.threeInFour?' · Third game in four days':''),rest.backToBack||rest.sameDay?'nba-rest-flag':'nba-rest-normal'));
   card.append(node('p',rest.gamesLast7Days+' completed game(s) in the previous seven days · '+rest.gapHours+' hours between tipoffs','war-muted'));
  }else card.append(node('p','Rest unverified: '+(rest?.reason||'Earlier schedule unavailable.'),'war-muted'));
  if(side.lastPlayedAt)card.append(node('p','Previous scored game: '+shared.timeCentral(side.lastPlayedAt),'war-muted'));
  const form=node('div','', 'nba-form-strip');form.setAttribute('aria-label','Last five recorded results, newest first');
  for(const result of (side.recentGames||[]).slice(0,5)){
   const chip=node('span',result.result,'nba-form-chip nba-result-'+result.result);
   chip.title=result.opponent+': '+result.for+'–'+result.against;
   form.append(chip);
  }
  if(form.children.length)card.append(node('p','Recent form · newest first','war-muted'),form);
  card.append(node('p',summaryLine('At home',side.homeSplit)),node('p',summaryLine('On the road',side.awaySplit)));
  const history=node('details','');history.className='nba-recent-results';
  history.append(node('summary','Last '+(side.recentGames||[]).length+' recorded results'));
  const list=node('ol','');
  for(const result of side.recentGames||[]){
   list.append(node('li',result.result+' · '+shared.timeCentral(result.tipoff)+' · '+(result.venue==='away'?'@ ':'vs ')+result.opponent+' · '+result.for+'–'+result.against+' ('+signed(result.margin)+')'));
  }
  if(!list.children.length)history.append(node('p','No qualifying results available.'));
  else history.append(list);
  card.append(history);
  if(side.coverage?.conflictingGames)card.append(node('p',side.coverage.conflictingGames+' conflicting game record(s) excluded.','nba-sample-note'));
  return card;
 }
 formWindow.addEventListener('change',renderHeadToHead);
 async function loadContext(game){
  const token=++contextRequest;
  comparison.replaceChildren();headToHead.replaceChildren();activeContext=null;
  renderProjection();
  contextStatus.textContent='Checking earlier NBA team scores…';
  try{
   const query=new URLSearchParams({date:dateInput.value,game:String(game.id)});
   if(game.provider)query.set('provider',game.provider);
   const res=await fetch('/api/nba/context?'+query,{signal:AbortSignal.timeout(30000)});
   const data=await res.json();
   if(token!==contextRequest)return;
   if(!res.ok)throw Error('NBA history not available');
   if(!data.away||!data.home){
    contextStatus.textContent=data.reason||'NBA historical comparison not yet available for this game.';
    return;
   }
   activeContext={data,game};
   renderHeadToHead();
   for(const side of [data.away,data.home])comparison.append(renderTeam(side));
   contextStatus.textContent=(data.source?data.source+' · ':'')+(data.message||'Historical scoring data loaded.');
  }catch{
   if(token!==contextRequest)return;
   comparison.replaceChildren();headToHead.replaceChildren();activeContext=null;
   renderProjection();
   contextStatus.textContent='NBA team history unavailable from the selected source; no projections were generated.';
  }
 }
function choose(game){
   window.Unit501NBAMarkets?.select(game,dateInput.value);
   byId('nba-matchup').textContent=shared.matchup(game.away,game.home);
   if(typeof document.dispatchEvent==='function'&&typeof CustomEvent==='function')document.dispatchEvent(new CustomEvent('unit501:matchup-selected',{detail:{league:'nba',away:game.away,home:game.home}}));
   byId('nba-game-context').textContent=shared.timeCentral(game.tipoff)+' | '+game.status+
     (game.awayScore!==null&&game.homeScore!==null?' | '+game.away+' '+game.awayScore+' – '+game.home+' '+game.homeScore:'');
   formWindow.value='recent5';
   byId('nba-prediction-detail').textContent='';
   loadContext(game);
   lab.classList.remove('hidden');
   players.classList.remove('hidden');
   lab.scrollIntoView?.({behavior:'smooth',block:'start'});
 }
 async function refresh(){
  const date=dateInput.value;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)){status.textContent='Choose a valid NBA game date.';return;}
  ++contextRequest;activeContext=null;window.Unit501NBAMarkets?.clear();
  const serial=++request;load.disabled=true;games.replaceChildren();lab.classList.add('hidden');players.classList.add('hidden');status.textContent='Loading NBA schedule…';
  try{
   const response=await fetch('/api/nba/games?date='+encodeURIComponent(date),{signal:AbortSignal.timeout(30000)});
   const data=await response.json();
   if(serial!==request)return;
   if(!response.ok||!Array.isArray(data.games))throw Error(data.code==='NBA_PLAN_ACCESS'?data.error:'NBA games could not be loaded. Check the NBA connection and try again.');
   if(!data.games.length){
    if(typeof document.dispatchEvent==='function'&&typeof CustomEvent==='function')document.dispatchEvent(new CustomEvent('unit501:slate-loaded',{detail:{league:'nba'}}));
    status.textContent='No NBA games returned for this date. Check official schedule or try another date.';return;}
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
   if(typeof document.dispatchEvent==='function'&&typeof CustomEvent==='function')document.dispatchEvent(new CustomEvent('unit501:slate-loaded',{detail:{league:'nba'}}));
   status.textContent=data.games.length+' NBA game(s) loaded · updated '+new Date(data.checkedAt).toLocaleTimeString()+
    '. '+(data.source||'NBA feed')+(data.fallback?' (fallback)':'')+' · Experimental team estimates available with sufficient history.';
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
   ++contextRequest;activeContext=null;window.Unit501NBAMarkets?.clear();
   lab.classList.add('hidden');players.classList.add('hidden');
   if(typeof document.dispatchEvent==='function'&&typeof Event==='function')document.dispatchEvent(new Event('unit501:nba-clear'));
   for(const card of games.querySelectorAll('.game')){card.classList.remove('selected');card.setAttribute('aria-pressed','false');}
   games.scrollIntoView?.({behavior:'smooth',block:'start'});
 });
 document.addEventListener('unit501:nba-lines-updated',renderProjection);
 // Withdraw pregame estimates at tipoff without another provider call.
 setInterval(renderProjection,30000);
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
   const response=await fetch('/api/nba/games?date='+shared.dateCentral(),{signal:AbortSignal.timeout(30000)});
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