(function(){
 'use strict';
 const byId=id=>document.getElementById(id);
 const shared=window.Unit501SharedUI;
 const dateInput=byId('nba-date'),status=byId('nba-status'),games=byId('nba-games'),load=byId('nba-load');
 const lab=byId('nba-lab'),players=byId('nba-player-lab');
 if(!dateInput||!games||!status||!load||!shared||!lab||!players)return;
 let request=0,contextRequest=0,injuryRequest=0,injuryGame=null,injuryReport=null;
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
 let activeContext=null,contextTimer=null,contextGame=null;
 const formWindow=byId('nba-form-window'),headToHead=byId('nba-head-to-head');
 const signed=value=>Number.isFinite(value)?(value>0?'+':'')+value.toFixed(1):'—';
 function renderProjection(){
  shared.resultTiles('nba',null);
  shared.showMarketComparison(byId('nba-market-gap'),null);
  const output=byId('nba-prediction'),detail=byId('nba-prediction-detail');
  detail.textContent='';
  const alert=byId('nba-upset-pick');alert.hidden=true;alert.textContent='';
  const simulation=byId('nba-simulation'),simulationDetail=byId('nba-simulation-detail');simulation.textContent='';simulationDetail.textContent='';
  if(!activeContext){output.textContent='Estimate unavailable until matching team history loads.';return;}
  const {game,data}=activeContext;
  if(!shared.historyFreshness(data.checkedAt).fresh){output.textContent='Team history is stale or its update time is unverified. Refresh team history.';contextStatus.textContent=output.textContent;return;}
  const baseline=window.Unit501NBAModel.project(game,data,formWindow.value);
  const result=window.Unit501BasketballInjuryModel.apply(baseline,game,data,window.Unit501NBAMarkets?.historyFor?.(game),injuryReport,formWindow.value);
  if(!result.available){output.textContent=result.reason;return;}
  output.textContent=game.away+' '+result.away.toFixed(1)+' · '+game.home+' '+result.home.toFixed(1)+' | Total '+result.total.toFixed(1)+' | '+game.home+' spread '+signed(result.homeSpread);
  const line=window.Unit501NBAMarkets?.spreadFor?.(game);
  // Stable seed avoids changing displayed results merely because a quote redraws.
  let seed=(Number(game.id)>>>0)||1;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const lines=window.Unit501NBAMarkets?.linesFor?.(game)||{};
  shared.showMarketComparison(byId('nba-market-gap'),result,lines,'FanDuel');
  const sim=window.Unit501NBAModel.simulate(result,data,lines,10000,random);
  const outlook=shared.upsetOutlook(result,line,sim.available?sim:null);
  if(outlook?.lean){
   alert.hidden=false;alert.className=outlook.upset?'automatic-upset-pick':'';alert.title=outlook.reason;
   alert.textContent=(outlook.upset?'⚠ UPSET REVIEW · ':'Model lean only · ')+(outlook.winner==='away'?game.away:game.home)+
    (outlook.upset?' meets the score-margin and simulation thresholds.':' projected ahead; upset review threshold not met.');
  }
  shared.resultTiles('nba',result,sim.available?{cover:sim.spread?.away,over:sim.total?.over,win:sim.awayWin}:{});
  if(sim.available){
   const percent=n=>(n*100).toFixed(1)+'%';
   let message='10,000 simulations · '+game.away+' win '+percent(sim.awayWin)+' · '+game.home+' win '+percent(sim.homeWin)+' · tie '+percent(sim.tie);
   if(sim.spread)message+=' · '+game.away+' '+signed(sim.spread.line)+' cover '+percent(sim.spread.away)+' · '+game.home+' cover '+percent(sim.spread.home)+' · push '+percent(sim.spread.push);
   if(sim.total)message+=' · Over '+sim.total.line+' '+percent(sim.total.over)+' · Under '+percent(sim.total.under)+' · push '+percent(sim.total.push);
   const calibrated=window.Unit501NBAWinCalibration?.apply(game,result,sim);
   if(calibrated)message+=' · Historically calibrated win estimate: '+game.away+' '+window.Unit501NBAWinCalibration.percent(calibrated.away)+' / '+game.home+' '+window.Unit501NBAWinCalibration.percent(calibrated.home);
   simulation.textContent=message;
   simulationDetail.textContent='Experimental frequencies, not calibrated odds. Resamples each team’s last '+sim.sampleGames[0]+'/'+sim.sampleGames[1]+' completed games around the displayed score, including any supported historical absence adjustment; player minutes and overtime are not modeled.';
   if(calibrated)simulationDetail.textContent+=' The separate calibrated estimate was tested unchanged on 1,151 games from 2025–26; it applies only to the regular-season Season baseline with no applied injury adjustment. It is not a sportsbook price or a guarantee.';
  }else simulation.textContent=sim.reason;
  detail.textContent=result.awayGames+'/'+result.homeGames+' games (away/home). '+(result.thin?'Small sample. ':'')+result.explanation+' '+window.Unit501BasketballInjuryModel.describe(result);
 }
 byId('nba-sim').addEventListener('click',renderProjection);
 function renderHeadToHead(){
  renderProjection();
  headToHead.replaceChildren();
  if(!activeContext)return;
  if(!shared.historyFreshness(activeContext.data.checkedAt).fresh){comparison.replaceChildren();return;}
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
   card.append(node('p',rest.gamesLast7Days+' completed game(s) in the previous seven days','war-muted'));
   if(rest.schedule){
    const schedule=rest.schedule,venue=value=>value==='away'?'road':'home';
    card.append(node('p','Schedule: '+venue(schedule.previous)+' → '+venue(schedule.current)+
     (schedule.consecutive>1?' · '+(schedule.minimum?'at least ':'')+schedule.consecutive+' consecutive '+venue(schedule.current)+' games':''),'nba-rest-normal'));
    if(schedule.previousArena&&schedule.currentArena)card.append(node('p',schedule.previousArena===schedule.currentArena?
     'Same listed arena as the previous game.':'Previous arena: '+schedule.previousArena+' · Next: '+schedule.currentArena,'war-muted'));
   }
  }else card.append(node('p','Rest unverified: '+(rest?.reason||'Earlier schedule unavailable.'),'war-muted'));
  if(side.lastPlayedAt)card.append(node('p','Previous scored game: '+shared.timeCentral(side.lastPlayedAt),'war-muted'));
  const form=node('div','', 'nba-form-strip');form.setAttribute('aria-label','Last five recorded results, newest first');
  for(const result of (side.recentGames||[]).slice(0,5)){
   const outcome=['W','L','T'].includes(result.result)?result.result:'—';
   const chip=node('span',outcome,'nba-form-chip nba-result-'+outcome);
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
  if(side.coverage?.unverifiedGames||side.coverage?.invalid)card.append(node('p','History incomplete · '+(side.coverage.unverifiedGames||0)+' completed game(s) with unverified scores · '+(side.coverage.invalid||0)+' malformed record(s). Estimates withheld.','nba-sample-note'));
  if(side.coverage?.conflictingGames)card.append(node('p',side.coverage.conflictingGames+' conflicting game record(s) excluded.','nba-sample-note'));
  return card;
 }
 formWindow.addEventListener('change',renderHeadToHead);
 async function loadContext(game){
  const token=++contextRequest;contextGame=game;clearTimeout(contextTimer);
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
   const freshness=shared.historyFreshness(data.checkedAt);
   if(!freshness.fresh){renderHeadToHead();return;}
   const expiry=Math.min(freshness.expiresAt,Date.parse(game.tipoff)>Date.now()?Date.parse(game.tipoff):Infinity);
   contextTimer=setTimeout(()=>{if(token===contextRequest)renderHeadToHead();},Math.max(1,expiry-Date.now()));
   renderHeadToHead();
   const cards=[renderTeam(data.away),renderTeam(data.home)];for(const card of cards)comparison.append(card);
   contextStatus.textContent=(data.source?data.source+' · ':'')+(data.message||'Historical scoring data loaded.')+' · Checked '+shared.timeCentral(freshness.at);
   if(game.statusCode===1&&Date.parse(game.tipoff)>Date.now()){
    fetch('/api/nba/travel?'+query,{signal:AbortSignal.timeout(30000)}).then(r=>r.ok?r.json():null).then(travel=>{
     if(token!==contextRequest||!travel||String(travel.gameId)!==String(game.id)||travel.tipoff!==game.tipoff)return;
     for(const [i,side] of [travel.away,travel.home].entries())if(side?.available){
      const distance=node('details','');shared.renderVenueDistance(distance,side);if(!distance.hidden)cards[i].append(distance);
     }
    }).catch(()=>{});
   }
  }catch{
   if(token!==contextRequest)return;
   comparison.replaceChildren();headToHead.replaceChildren();activeContext=null;
   renderProjection();
   contextStatus.textContent='NBA team history unavailable from the selected source; no projections were generated.';
  }
 }
 byId('nba-refresh-context').addEventListener('click',()=>{if(contextGame)return loadContext(contextGame);});
 function clearInjuries(message='Select a game to check injuries.'){
  ++injuryRequest;injuryReport=null;window.Unit501NBAMarkets?.setInjuries?.(injuryGame,null);byId('nba-injuries-list').replaceChildren();byId('nba-injuries-status').textContent=message;renderProjection();
 }
 function showInjuries(report){
  const list=byId('nba-injuries-list');list.replaceChildren();
  for(const team of report.teams){
   const card=node('section','', 'nba-team-history');card.append(node('h4',team.name));
   if(!team.available)card.append(node('p',team.message||'Report not submitted or unavailable.','nba-sample-note'));
   if(team.available&&!team.players.length)card.append(node('p','No players listed in this report.'));
   for(const player of team.players){
    const line=node('p',player.name+' · '+player.status,player.status==='Out'?'nba-injury-out':'');card.append(line);
   }
   list.append(card);
  }
  byId('nba-injuries-status').textContent='Official NBA report · '+new Date(report.reportAt).toLocaleString('en-US',{timeZone:'America/Chicago',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})+' CT · Updates every 15 minutes while this page is visible.';
 }
 async function loadInjuries(game){
  clearInjuries('Checking official NBA injury report…');injuryGame=game;
  if(!game||game.statusCode!==1||!Number.isFinite(Date.parse(game.tipoff))||Date.parse(game.tipoff)<=Date.now()){
   byId('nba-injuries-status').textContent='Injury reports available for scheduled pregame matchups.';return;
  }
  const serial=injuryRequest;
  try{
   const query=new URLSearchParams({date:dateInput.value,game:String(game.id)});if(game.provider)query.set('provider',game.provider);
   const response=await fetch('/api/nba/injuries?'+query,{signal:AbortSignal.timeout(30000)}),data=await response.json();
   if(serial!==injuryRequest||injuryGame!==game)return;
   const at=Number(data.reportAt);
   if(!response.ok||String(data.gameId)!==String(game.id)||data.tipoff!==game.tipoff||!Number.isFinite(at)||at>Date.now()+60000||Date.now()-at>7200000||
     !Array.isArray(data.teams)||data.teams.length!==2||data.teams.some(t=>!t||typeof t.name!=='string'||typeof t.available!=='boolean'||!Array.isArray(t.players)||
      t.players.some(p=>typeof p.name!=='string'||!['Out','Doubtful','Questionable','Probable','Available','Unverified'].includes(p.status))))throw Error('Report unavailable');
   injuryReport=data;showInjuries(data);renderProjection();window.Unit501NBAMarkets?.setInjuries?.(game,data);
  }catch{
   if(serial!==injuryRequest||injuryGame!==game)return;
   byId('nba-injuries-list').replaceChildren();byId('nba-injuries-status').textContent='Official report unavailable for this matchup. Open the NBA report to check.';
  }
 }
 byId('nba-injuries-refresh').addEventListener('click',()=>{if(injuryGame)loadInjuries(injuryGame);});
 // Refresh only the selected pregame matchup while the page is visible.
 setInterval(()=>{if(!document.hidden&&injuryGame&&injuryGame.statusCode===1&&Date.parse(injuryGame.tipoff)>Date.now())loadInjuries(injuryGame);},15*60000);
function choose(game){
  window.Unit501Hook?.select(game.status==='Scheduled'?{league:'nba',away:game.away,home:game.home,kickoff:Date.parse(game.tipoff)}:null);
   window.Unit501NBAMarkets?.select(game,dateInput.value);
   byId('nba-matchup').textContent=shared.matchup(game.away,game.home);
   const tip=new Date(game.tipoff);
   if(Number.isFinite(tip.valueOf())){
    const season=tip.getUTCFullYear()-(tip.getUTCMonth()<6?1:0);
    if(season>=2000&&season<=2100)byId('nba-official-injuries').href='https://official.nba.com/nba-injury-report-'+season+'-'+String((season+1)%100).padStart(2,'0')+'-season/';
   }
   if(typeof document.dispatchEvent==='function'&&typeof CustomEvent==='function')document.dispatchEvent(new CustomEvent('unit501:matchup-selected',{detail:{league:'nba',away:game.away,home:game.home}}));
   byId('nba-game-context').textContent=shared.timeCentral(game.tipoff)+' | '+game.status+
     (game.awayScore!==null&&game.homeScore!==null?' | '+game.away+' '+game.awayScore+' – '+game.home+' '+game.homeScore:'');
   formWindow.value='season';
   byId('nba-prediction-detail').textContent='';
   loadContext(game);
   loadInjuries(game);
   lab.classList.remove('hidden');
   players.classList.remove('hidden');
   lab.scrollIntoView?.({behavior:'smooth',block:'start'});
 }
 async function refresh(){
  const date=dateInput.value;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)){status.textContent='Choose a valid NBA game date.';return;}
  ++contextRequest;activeContext=null;contextGame=null;clearTimeout(contextTimer);injuryGame=null;clearInjuries();window.Unit501NBAMarkets?.clear();
  window.Unit501Hook?.select(null);
  window.Unit501Worth?.clear();
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
      away:game.away,home:game.home,awayLogo:game.awayLogo,homeLogo:game.homeLogo,container:games,seasonRecord:{league:'nba',season:Number(data.season)+1,date},
      detailText:shared.timeCentral(game.tipoff)+' | '+game.status+score,
      actionLabel:'Open Game Lab →',cardClass:'card game nba-game',
      onSelect:()=>choose(game)
    });
    games.append(card);
   }
   window.Unit501Worth?.load('nba',data.games.map((g,i)=>({away:g.away,home:g.home,id:g.id,kickoff:Date.parse(g.tipoff),scheduled:g.status==='Scheduled',card:games.children[i]})));
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
   ++contextRequest;activeContext=null;contextGame=null;clearTimeout(contextTimer);injuryGame=null;clearInjuries();window.Unit501NBAMarkets?.clear();
   lab.classList.add('hidden');players.classList.add('hidden');
   if(typeof document.dispatchEvent==='function'&&typeof Event==='function')document.dispatchEvent(new Event('unit501:nba-clear'));
   for(const card of games.querySelectorAll('.game')){card.classList.remove('selected');card.setAttribute('aria-pressed','false');}
   games.scrollIntoView?.({behavior:'smooth',block:'start'});
 });
 document.addEventListener('unit501:nba-lines-updated',renderProjection);
 // Withdraw pregame estimates at tipoff without another provider call.
 setInterval(()=>{
  renderProjection();
  if(injuryReport&&(Date.now()-injuryReport.reportAt>7200000||Date.parse(injuryGame?.tipoff)<=Date.now()))clearInjuries('Report expired. Refresh injuries or open the official report.');
 },30000);
 // Monitoring is explicitly enabled and can continue in an open background tab.
 const alertToggle=byId('nba-alert-enable'),alertStatus=byId('nba-alert-status'),alertList=byId('nba-alert-list');
 const track=window.Unit501NBAAlerts.createTracker();
 let watching=false,watchTimer=null,watchGeneration=0;
 byId('nba-alert-permission').addEventListener('click',async()=>{
  if(!('Notification' in window)){alertStatus.textContent='Browser notifications unavailable here; alerts still appear on this page.';return;}
  try{const permission=await Notification.requestPermission();alertStatus.textContent=permission==='granted'?'Browser notifications enabled. Turn on the watch to begin.':'Notifications not enabled; alerts still appear on this page.';}catch{alertStatus.textContent='Browser notifications unavailable; alerts still appear on this page.';}
 });
 async function watch(){
  if(!alertToggle.checked||watching)return;
  watching=true;
  const generation=watchGeneration;
  try{
   const response=await fetch('/api/nba/live-watch',{signal:AbortSignal.timeout(30000)});
   const data=await response.json();
   if(!alertToggle.checked||generation!==watchGeneration)return;
   if(!response.ok){
    if(response.status===401||response.status===403){alertToggle.checked=false;alertStatus.textContent='Sign in again to resume the watch.';return;}
    throw Error((data.error||'NBA scores unavailable.')+' Watch will retry.');
   }
   const checked=Date.parse(data.checkedAt);
   if(!Array.isArray(data.games)||!Number.isFinite(checked)||checked>Date.now()+60000||Date.now()-checked>180000)throw Error('Live scores are stale or unavailable; alert watch will retry.');
   for(const alert of track(data.games)){
    const message=alert.team+' down '+alert.deficit+' in Q'+alert.period+' · '+alert.score;
    alertList.prepend(node('p',message));
    if('Notification' in window&&Notification.permission==='granted'){
     try{new Notification('Unit 501: first-half deficit',{body:message,tag:'nba-'+alert.id+'-'+alert.team});}catch{/* Inline alert remains visible. */}
    }
   }
   alertStatus.textContent='Watching today · checked '+new Date(data.checkedAt).toLocaleTimeString()+'. Keep this tab open; browser throttling may delay checks. One alert per trailing team per game.';
  }catch(error){if(alertToggle.checked&&generation===watchGeneration)alertStatus.textContent=error.message;}
  finally{
   watching=false;
   if(alertToggle.checked){
    clearTimeout(watchTimer);
    watchTimer=setTimeout(watch,generation===watchGeneration?60000:0);
   }
  }
 }
 alertToggle.addEventListener('change',()=>{
  ++watchGeneration;
  clearTimeout(watchTimer);
  if(alertToggle.checked)watch();else alertStatus.textContent='Watch off.';
 });
 document.addEventListener('visibilitychange',()=>{
  if(!document.hidden&&alertToggle.checked&&!watching){clearTimeout(watchTimer);watch();}
 });
})();
