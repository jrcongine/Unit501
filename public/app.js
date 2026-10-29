
const $ = id => document.getElementById(id);
const games = $('games');
let selected = null;
let scoringContext = null;
let forecastContext = null;
let latestForecast = null;
let gameQuotes = null;
const footballTravel=window.Unit501FootballTravel?.create();
function renderHomeAdvantage(venue=null) {
  const display=$('home-advantage-display');
  if(!display)return;
  if(venue&&Number.isFinite(venue.appliedMargin)){
    display.textContent=`Home advantage applied: +${venue.appliedMargin.toFixed(2)} points to home margin.`;
  }else if($('venueMode').value==='neutral'){
    display.textContent='Home advantage: +0.0 points (neutral site).';
  }else if($('homeFieldMode').value==='manual'){
    const points=Number($('homeContext').value);
    display.textContent=`Manual home advantage: +${points.toFixed(1)} points${$('venueMode').value==='auto'?' if home venue verified':''} (run simulation to confirm).`;
  }else if($('variableHomeField').checked&&selected?.league==='1'){
    display.textContent='Experimental NFL team-specific home advantage enabled; run simulation to see points applied.';
  }else{
    display.textContent=`Standard home advantage: +3.0 points to home margin${$('venueMode').value==='auto'?' if home venue verified':''} (run simulation to confirm).`;
  }
}
function invalidateSimulation(message) {
  latestForecast=null;
  $('outright-pick').classList.remove('automatic-upset-pick');
  window.Unit501Availability?.scoring?.(null);
  previewAutomaticInjuries();
  $('availability-score-status').textContent='';
  for (const id of ['score','cover','over','win','outright-pick','underdog-outlook','win-both','upset-history']) $(id).textContent = '—';
  if (message) $('note').textContent = message;
  renderHomeAdvantage();
  document.dispatchEvent(new Event('unit501:simulation-invalidated'));
}
for (const id of ['spread','total','awayRating','homeRating',
  'awayOffenseLoss','awayDefenseLoss','homeOffenseLoss','homeDefenseLoss']) {
  $(id).addEventListener('input', () => invalidateSimulation('Inputs changed. Run the simulation again.'));
}
$('venueMode').addEventListener('change', () => {
  invalidateSimulation('Game location changed. Run the simulation again.');
  
});
$('gameMode').addEventListener('change',()=>invalidateSimulation('Game mode changed. Run the simulation again.'));
$('variableHomeField').addEventListener('change',()=>invalidateSimulation('Home-field estimate setting changed. Run the simulation again.'));
$('homeContext').addEventListener('input',()=>invalidateSimulation('Matchup-context assumption changed. Run the simulation again.'));
$('homeFieldMode').addEventListener('change',()=>{
  const manual=$('homeFieldMode').value==='manual';
  $('homeContext').disabled=!manual;
  $('homeFieldReason').disabled=!manual;
  $('home-advantage-override').open=manual;
  invalidateSimulation('Home advantage mode changed. Run the simulation again.');
});
$('homeFieldReason').addEventListener('input',()=>invalidateSimulation('Override reason changed. Run the simulation again.'));
const injuryFields=['awayOffenseLoss','awayDefenseLoss','homeOffenseLoss','homeDefenseLoss'];
function injuryModeChanged(){
  const automatic=$('autoInjuries').checked;
  for(const id of injuryFields){$(id).disabled=automatic;$(id).value='0';}
  $('auto-injury-status').textContent=automatic?
    'Auto injuries ON — applied when you run the prediction.':
    'Manual mode — enter injury points below.';
  previewAutomaticInjuries();
  invalidateSimulation('Injury scoring mode changed. Run the simulation again.');
}
function renderAutomaticInjuries(result,applied=false){
  if(!result)return;
  window.Unit501Availability?.scoring?.(result,applied);
  for(const [id,key] of [['awayOffenseLoss','awayOffense'],['awayDefenseLoss','awayDefense'],['homeOffenseLoss','homeOffense'],['homeDefenseLoss','homeDefense']]){
    $(id).value=result.ready?String(result.injury[key]):'';$(id).placeholder=result.ready?'0':'Pending';
  }
  const who=result.applied.map(p=>{const designation=p.status==='Injured reserve'?'IR':'OUT';return p.category==='quarterback'?`${p.name} — ${designation} — ${applied?'factored in':'ready for next simulation'} → ${p.replacement}: ${p.points>0?'+':''}${p.points.toFixed(1)} pts`:`${p.name} — ${designation} — ${applied?'factored in':'ready for next simulation'} (${p.role}): ${p.category==='offense'?'-':'+'}${p.points.toFixed(2)} pts`;});
  const hasAbsence=window.Unit501Availability?.snapshot()?.teams?.some(t=>(t.official?.rows||[]).some(p=>String(p.status).toLowerCase()==='out')||(t.official?.unresolved||[]).some(p=>String(p.status).toLowerCase()==='out')||(t.roster?.rows||[]).some(p=>/\binjured reserve\b/i.test(p.group||'')));
  $('auto-injury-status').textContent=who.length?(applied?'Applied: ':'Ready: ')+who.join(' · '):!result.ready?'Injury data incomplete—no adjustment yet.':hasAbsence?'Unavailable players listed; no supported point change.':'No confirmed injury adjustment.';
  const list=$('injury-adjustment-reasons');list.replaceChildren();
  for(const reason of result.withheld){const row=document.createElement('li');row.textContent=reason;list.append(row);}
  $('injury-adjustment-details').hidden=!result.withheld.length;
}
function previewAutomaticInjuries(){
  if(!$('autoInjuries').checked||!selected||!window.Unit501AutoInjury)return;
  renderAutomaticInjuries(Unit501AutoInjury.evaluate(window.Unit501Availability?.snapshot(),selected,window.Unit501Lineups?.evaluate(),Date.now(),scoringContext?.game===selected?scoringContext.data:null));
}
$('autoInjuries').addEventListener('change',injuryModeChanged);
injuryModeChanged();
function describeMatchup(game){
  const divisions=[
    ['Bills','Dolphins','Patriots','Jets'],['Ravens','Bengals','Browns','Steelers'],
    ['Texans','Colts','Jaguars','Titans'],['Broncos','Chiefs','Raiders','Chargers'],
    ['Cowboys','Giants','Eagles','Commanders'],['Bears','Lions','Packers','Vikings'],
    ['Falcons','Panthers','Saints','Buccaneers'],['Cardinals','Rams','49ers','Seahawks']];
  const division=game.league==='1'&&divisions.some(d=>d.some(n=>game.a?.endsWith(n))&&d.some(n=>game.h?.endsWith(n)));
  const hour=Number(new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',hour:'numeric',hourCycle:'h23'}).format(new Date(game.kickoff)));
  $('matchup-context-status').textContent=[division?'Division rivalry detected.':'',hour>=19?'Evening kickoff detected (broadcast slot unverified).':'','Context only: no automatic extra points. NFL standard: 3 points; college: 3, at a verified home venue.'].filter(Boolean).join(' ');
}
let homeFieldProfiles=null,homeFieldTask=null;
async function loadHomeField(game){
  $('home-field-status').textContent='Loading historical home-field estimates…';
  $('home-field-rankings').replaceChildren();
  if(game.league!=='1'){$('home-field-status').textContent='Team-specific home-field estimates are currently NFL only.';return;}
  try{
    if(!homeFieldTask)homeFieldTask=fetch('/home-field-profiles.json').then(async r=>{if(!r.ok)throw Error();return r.json();}).catch(e=>{homeFieldTask=null;throw e;});
    const profile=await homeFieldTask;if(selected!==game)return;
    if(profile.league!=='1'||String(profile.season)!==String(game.season)||!(profile.before<=game.kickoff)||profile.teams?.length!==32)throw Error();
    homeFieldProfiles=profile;const home=profile.teams.find(t=>String(t.id)===String(game.homeId));
    $('home-field-status').textContent=home?`${home.name}: historical rank ${home.rank}/32, +${home.margin.toFixed(2)} home-margin points (${home.homeGames} home / ${home.awayGames} away games). Experimental; switched off by default. ${profile.validation?.reason||''}`:'Selected home team estimate unavailable.';
    const table=document.createElement('table');const header=document.createElement('tr');for(const label of ['Rank','Team','Home margin','Home / away games']){const th=document.createElement('th');th.textContent=label;header.append(th);}table.append(header);
    for(const t of profile.teams){const row=document.createElement('tr');for(const value of [t.rank,t.name,'+'+t.margin.toFixed(2),t.homeGames+' / '+t.awayGames]){const td=document.createElement('td');td.textContent=value;row.append(td);}table.append(row);}
    $('home-field-rankings').append(table);
  }catch{if(selected===game)$('home-field-status').textContent='Historical home-field estimate unavailable for this matchup. Standard venue assumption remains available.';}
}
$('weatherEnabled').addEventListener('change', () => invalidateSimulation('Weather setting changed. Run the simulation again.'));
// Spread/total market data: bookmaker quote movement and sampled bet shares stay separate.
let pulseObservations=null,pulseSplits=null,pulseSplitsSequence=0,pulseManual=false;
function pulseCard(parent,label,headline,detail,tone='flat'){
  const card=document.createElement('div');
  card.className='market-pulse-card market-pulse-'+tone;
  const heading=document.createElement('div');heading.className='market-pulse-label';heading.textContent=label;
  const value=document.createElement('div');value.className='market-pulse-value';value.textContent=headline;
  const foot=document.createElement('div');foot.className='market-pulse-detail';foot.textContent=detail;
  card.append(heading,value,foot);parent.append(card);
}
function renderMarketPulse(){
  if(!selected)return;
  const movement=$('market-movement'),bets=$('market-bets'),status=$('market-pulse-status');
  movement.replaceChildren();bets.replaceChildren();
  const game=selected;
  for(const [kind,label] of [['spread',game.a+' spread'],['total','Game total']]){
    const observed=pulseObservations?.game===game?pulseObservations[kind]:null;
    const display=window.Unit501MarketPulse?.movement(kind,observed,game.a,game.h);
    pulseCard(movement,label,
      pulseManual?'Manual line entered — movement paused':display?.text||'No observed FanDuel line yet.',
      window.Unit501LineWatch?.detail(observed)||'Shared line history unavailable.',
      pulseManual?'flat':display?.tone||'flat');
  }
  for(const [key,label] of [['awayMoneyline',game.a+' moneyline'],['homeMoneyline',game.h+' moneyline']]){
    const observed=pulseObservations?.game===game?pulseObservations[key]:null;
    if(observed&&!pulseManual)pulseCard(movement,label,window.Unit501LineWatch.describe(observed),window.Unit501LineWatch.detail(observed));
  }
  const snapshot=window.Unit501MarketPulse?.splits(pulseSplits?.game===game?pulseSplits.data:null,game);
  for(const [kind,title] of [['spread','Spread: teams'],['total','Total: Over / Under']]){
    const side=snapshot?.available?snapshot[kind]:null;
    pulseCard(bets,title,side?'Bets: '+side.bets:'Bet shares unavailable',
      side?'Money: '+side.money+' · More reported bets: '+side.leader:
      'No valid, game-matched bet percentages. Cannot infer public or sharp betting from the line.',
      side?'flat':'unknown');
  }
  if(snapshot?.available){
    status.textContent='Sample: '+snapshot.source+
      ' · '+(snapshot.sourceTimeVerified?'source timestamp verified':'source update time unverified')+
      '. FanDuel movement and sampled bets are different books. Money % is not proof of sharp action.';
  }else{
    status.textContent=(pulseSplits?.game===game&&pulseSplits.message)||'Checking independently sourced betting percentages…';
  }
}
async function loadMarketSplits(){
  if(!selected)return;
  const game=selected,task=++pulseSplitsSequence;
  pulseSplits=null;renderMarketPulse();
  try{
    const params=new URLSearchParams({game:String(game.id),league:game.league,season:game.season,
      kickoff:String(game.kickoff),away:game.a,home:game.h});
    const response=await fetch('/api/betting-splits?'+params,{signal:AbortSignal.timeout(12000)});
    if(!response.ok)throw Error('Bet-share feed unavailable');
    const data=await response.json();
    if(task!==pulseSplitsSequence||selected!==game)return;
    pulseSplits={game,data,message:data?.message||'No matching betting percentages available.'};
  }catch{
    if(task!==pulseSplitsSequence||selected!==game)return;
    pulseSplits={game,data:null,message:'Betting splits unavailable — FanDuel line tracking still works.'};
  }
  renderMarketPulse();
}
$('refresh-market-pulse').addEventListener('click',()=>{
  if(!selected)return;
  loadFanDuel();
  loadMarketSplits();
});

let slateSequence = 0;
let oddsSequence = 0;
let lineEdits = 0;
const oddsStatus = document.createElement('p');
oddsStatus.setAttribute('aria-live', 'polite');
const refreshOdds = document.createElement('button');
refreshOdds.textContent = 'Refresh FanDuel lines';
refreshOdds.type = 'button';
refreshOdds.id = 'refresh-odds';
$('matchup').after(oddsStatus, refreshOdds);
for (const id of ['spread', 'total']) $(id).addEventListener('input', () => {
  lineEdits++;
  gameQuotes=null;
  oddsStatus.textContent = 'Manual lines — refresh FanDuel lines to replace them.';
  pulseManual=true;
  renderMarketPulse();
});
async function loadFanDuel() {
  if (!selected) return;
  const game = selected;
  const task = ++oddsSequence;
  gameQuotes=null;
  document.dispatchEvent(new Event('unit501:odds-updated'));
  const edits = lineEdits;
  pulseObservations=null;
  if($('line-tracking-status'))$('line-tracking-status').textContent='';
  renderMarketPulse();
  refreshOdds.disabled = true;
  oddsStatus.textContent = 'Loading FanDuel spread and total…';
  invalidateSimulation('Refreshing lines…');
  try {
    const params = new URLSearchParams({ away: game.a, home: game.h,
      league: $('league').value, kickoff: game.kickoff });
    const response = await fetch('/api/fanduel?' + params, {signal:AbortSignal.timeout(20000)});
    const data = await response.json();
    if (task !== oddsSequence || selected !== game || edits !== lineEdits) return;
    if (!response.ok || data.error) throw new Error(data.error || 'FanDuel feed unavailable.');
    if($('line-tracking-status'))$('line-tracking-status').textContent=data.tracking?.message||'Shared tracking status unavailable.';
    if (!data.available) { oddsStatus.textContent = data.message; return; }
    gameQuotes={game,data};
    pulseManual=false;
    pulseObservations={game,spread:null,total:null};
    const messages = [];
    for (const [id, key, stamp] of [['spread', 'awaySpread', 'spreadUpdated'], ['total', 'total', 'totalUpdated']]) {
      if (Number.isFinite(data[key])) {
        $(id).value = data[key];
        const time = new Date(data[stamp]).toLocaleTimeString('en-US', {timeZone:'America/Chicago', hour:'numeric', minute:'2-digit'});
        const observed=window.Unit501LineWatch?.fromServer(data.history?.[id],data[key],typeof data[stamp]==='number'?data[stamp]:Date.parse(data[stamp]));
        if(pulseObservations?.game===game)pulseObservations[id]=observed;
        const movement=observed?.changed?` • since first observed ${observed.firstLine} (${observed.delta>0?'+':''}${observed.delta.toFixed(1)})`:'';
        messages.push(`${id === 'spread' ? game.a + ' spread' : 'Total'} ${data[key]} (updated ${time} CT)${movement}`);
      } else {
        $(id).value = '';
        messages.push(`${id} unavailable — enter manually`);
      }
    }
    for(const [name,side] of [['awayMoneyline','away'],['homeMoneyline','home']]){
      pulseObservations[name]=window.Unit501LineWatch?.fromServer(data.history?.[name],data.moneyline?.[side],data.moneyline?.updatedAt);
    }
    if($('line-tracking-status'))$('line-tracking-status').textContent=data.tracking?.message||'Shared tracking status unavailable.';
    oddsStatus.textContent = 'FanDuel • ' + messages.join(' • ') + '. Feed cached up to 5 minutes.';
    renderMarketPulse();
    $('note').textContent = 'Review the lines and ratings, then run the simulation.';
    document.dispatchEvent(new Event('unit501:odds-updated'));
  } catch (error) {
    if (task === oddsSequence && selected === game && edits === lineEdits)
      oddsStatus.textContent = error.message + ' Enter lines manually.';
  } finally {
    if (task === oddsSequence) refreshOdds.disabled = false;
  }
}
refreshOdds.addEventListener('click', loadFanDuel);
const teamContext = document.createElement('section');
teamContext.id = 'team-context';
teamContext.style.cssText = 'margin:18px 0;padding:14px;border:1px solid #354057;border-radius:12px';
refreshOdds.after(teamContext);
const weatherPanel = document.createElement('section');
weatherPanel.id = 'game-weather';
teamContext.before(weatherPanel);
function weatherCondition(code, at) {
  if(!Number.isInteger(code))return {icon:'🌡️',label:'Forecast'};
  const hour=Number(new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',hour:'numeric',hourCycle:'h23'}).format(new Date(at)));
  if(code===0)return {icon:hour>=7&&hour<19?'☀️':'🌙',label:'Clear'};
  if(code===1)return {icon:hour>=7&&hour<19?'🌤️':'☁️',label:'Mostly clear'};
  if(code===2)return {icon:'⛅',label:'Partly cloudy'};
  if(code===3)return {icon:'☁️',label:'Cloudy'};
  if([45,48].includes(code))return {icon:'🌫️',label:'Fog'};
  if([51,53,55,56,57].includes(code))return {icon:'🌦️',label:'Drizzle'};
  if([61,63,65,66,67,80,81,82].includes(code))return {icon:'🌧️',label:'Rain'};
  if([71,73,75,77,85,86].includes(code))return {icon:'❄️',label:'Snow'};
  if([95,96,99].includes(code))return {icon:'⛈️',label:'Thunderstorms'};
  return {icon:'🌡️',label:'Forecast'};
}
let weatherWatch = null;
let weatherTimer;
function weatherFresh(game) {
  const data = forecastContext?.game === game && forecastContext.data;
  return data?.available && Number.isFinite(data.fetchedAt) && data.fetchedAt <= Date.now() && Date.now() - data.fetchedAt < 900000;
}
function watchWeather() {
  clearTimeout(weatherTimer);
  const watch = weatherWatch;
  if (!watch || selected !== watch.game || Date.now() >= watch.game.kickoff) return;
  if (!document.hidden && !watch.pending && !weatherFresh(watch.game) && Date.now() - watch.lastAttempt >= 300000) {
    loadVenueForecast(watch.game, watch.conditions, watch.roof);
  }
  weatherTimer = setTimeout(watchWeather, 60000);
}
document.addEventListener('visibilitychange', watchWeather);
async function loadVenueForecast(game, conditions, roof) {
  if (forecastContext?.game !== game) forecastContext={game,data:null,settled:false};
  let venue = game.weatherVenue || window.Unit501Venues?.resolve(game);
  let venueMessage='';
  if(!venue){
    conditions.textContent='Looking up matchup stadium…';
    try{
      const query=new URLSearchParams({league:game.league,season:game.season,kickoff:game.kickoff,home:game.h,away:game.a});
      const response=await fetch('/api/game-venue?'+query,{signal:AbortSignal.timeout(35000)});
      const result=await response.json();
      if(selected!==game||!conditions.isConnected)return;
      if(response.ok&&result.available){
        venue=result;game.weatherVenue=result;
        if(!game.venueName)game.venueName=result.name;
      }else venueMessage=result.message||result.error||'Venue lookup unavailable.';
    }catch{venueMessage='Venue feed could not be reached. Try selecting the matchup again.';}
  }
  if(selected!==game || !conditions.isConnected)return;
  if(venue){
    const label=weatherPanel.children[1];
    if(label)label.textContent=venue.name+(venue.locationPrecision==='city'?' • '+venue.city+', '+venue.state+' (city-area forecast)':'');
  }
  if(venue?.roof==='indoor'){
    forecastContext={game,data:{roof:'indoor',kickoff:game.kickoff},settled:true};
    conditions.textContent='Indoor venue: no outdoor weather adjustment.';roof.textContent='Enclosed playing conditions.';
    document.dispatchEvent(new CustomEvent('unit501:weather-updated'));return;
  }
  const location = venue && [venue.latitude, venue.longitude];
  if (!location) {
    conditions.textContent =
      'Forecast unavailable: '+(venueMessage||'Matchup stadium could not be located.')+' No weather adjustment applied.';
    forecastContext={game,data:null,settled:true};
    document.dispatchEvent(new Event('unit501:weather-updated'));
    return;
  }

  if (Date.now() >= game.kickoff || game.kickoff - Date.now() > 15 * 86400000) {
    conditions.textContent = 'Forecast available for upcoming games within 15 days of kickoff.';
    forecastContext={game,data:null,settled:true};
    document.dispatchEvent(new Event('unit501:weather-updated'));
    return;
  }
  if (!weatherWatch || weatherWatch.game !== game) weatherWatch = {game, conditions, roof, lastAttempt:0, pending:false};
  const watch = weatherWatch;
  if (watch.pending) return;
  watch.pending = true;
  watch.lastAttempt = Date.now();
  const previous = weatherFresh(game) ? forecastContext.data : null;
  const exposure = venue.roof === 'outdoor' ? 'outdoor' : 'unknown';
  roof.textContent = venue.roof === 'retractable'
    ? 'Retractable roof — game-day status unverified. Forecast is context only; no weather scoring adjustment.'
    : venue.roof === 'covered'
      ? 'Covered field with open sides — field-level weather exposure unverified. Forecast is context only; no weather scoring adjustment.'
      : 'Open-air playing field. Stadium-area forecast may differ from field conditions.';
  if (!previous) {
    if (forecastContext?.data?.available) invalidateSimulation('Weather forecast expired. Refreshing weather; run the simulation again.');
    forecastContext = {game, data:{roof:exposure,available:false,kickoff:game.kickoff}};
    document.dispatchEvent(new CustomEvent('unit501:weather-updated'));
    conditions.textContent = 'Loading forecast near kickoff…';
    watch.source?.replaceChildren();
  }

  try {
    const params = new URLSearchParams({
      latitude: String(location[0]),
      longitude: String(location[1]),
      kickoff: String(game.kickoff)
    });

    const response = await fetch('/api/weather?' + params, {
      signal: AbortSignal.timeout(20000)
    });
    const data = await response.json();

    if (selected !== game || !conditions.isConnected) return;

    if (!response.ok || data.error) {
      throw new Error(data.error || 'Weather unavailable.');
    }

    if (!data.available) {
      if (previous) invalidateSimulation('Weather forecast unavailable. Run the simulation again.');
      forecastContext = {game,data:{roof:exposure,available:false,kickoff:game.kickoff}};
      document.dispatchEvent(new CustomEvent('unit501:weather-updated'));
      watch.source?.replaceChildren();
      conditions.textContent = data.message || 'Forecast unavailable.';
      return;
    }

    forecastContext = {game,data:{...data,roof:exposure,kickoff:game.kickoff}};
    if (!previous || ['windMph','forecastTime','temperatureF','gustMph','precipitationChance','precipitationMm'].some(key => previous[key] !== data[key]) || JSON.stringify(previous.gameHours) !== JSON.stringify(data.gameHours)) {
      invalidateSimulation('Weather forecast updated. Run the simulation to use it.');
    }

    document.dispatchEvent(new CustomEvent('unit501:weather-updated'));
    const fmt=(value,unit='')=>Number.isFinite(value)?`${Math.round(value)}${unit}`:'—';
    const time=new Date(data.forecastTime).toLocaleTimeString('en-US',{timeZone:'America/Chicago',hour:'numeric',minute:'2-digit'});
    const condition=weatherCondition(data.weatherCode,data.forecastTime);
    const main=document.createElement('div');
    main.className='weather-now';
    const icon=document.createElement('span');
    icon.className='weather-big-icon';
    icon.textContent=condition.icon;
    icon.setAttribute('aria-hidden','true');
    const temp=document.createElement('strong');
    temp.className='weather-temp';
    temp.textContent=fmt(data.temperatureF,'°');
    const description=document.createElement('div');
    description.className='weather-now-description';
    const label=document.createElement('strong');
    label.textContent=condition.label;
    const when=document.createElement('span');
    when.textContent=`Kickoff · ${time} CT`;
    description.append(label,when);
    main.append(icon,temp,description);
    const metrics=document.createElement('div');
    metrics.className='weather-metrics';
    for(const [name,value] of [
      ['Wind',fmt(data.windMph,' mph')],
      ['Gusts',fmt(data.gustMph,' mph')],
      ['Rain chance',fmt(data.precipitationChance,'%')]
    ]){
      const item=document.createElement('div');
      const title=document.createElement('span');
      title.textContent=name;
      const number=document.createElement('strong');
      number.textContent=value;
      item.append(title,number);
      metrics.append(item);
    }
    conditions.replaceChildren(main,metrics);
    const hoursContainer=weatherPanel.querySelector('#game-weather-hours');
    // Always include the kickoff forecast, even for games starting between whole hours.
    const laterHours=Array.isArray(data.gameHours)?data.gameHours:[];
    const hours=[{...data,forecastTime:data.forecastTime},...laterHours.filter(hour=>hour.forecastTime!==data.forecastTime)].slice(0,4);
    hoursContainer.replaceChildren();
    if(hours.length){
      const heading=document.createElement('div');
      heading.className='weather-hours-title';
      heading.textContent='Kickoff through game time';
      const row=document.createElement('div');
      row.className='weather-hour-row';
      for(const [index,hour] of hours.entries()){
        const card=document.createElement('div');
        card.className='weather-hour-card';
        const hourTime=document.createElement('span');
        hourTime.textContent=(index===0?'Kickoff · ':'')+new Date(index===0?game.kickoff:hour.forecastTime).toLocaleTimeString('en-US',{timeZone:'America/Chicago',hour:'numeric'});
        const emoji=document.createElement('span');
        emoji.className='weather-hour-icon';
        emoji.textContent=weatherCondition(hour.weatherCode,hour.forecastTime).icon;
        emoji.setAttribute('aria-hidden','true');
        const degree=document.createElement('strong');
        degree.textContent=fmt(hour.temperatureF,'°');
        const extras=document.createElement('span');
        extras.textContent=`Wind ${fmt(hour.windMph,' mph')} · Rain ${fmt(hour.precipitationChance,'%')}`;
        card.append(hourTime,emoji,degree,extras);
        row.append(card);
      }
      hoursContainer.append(heading,row);
      hoursContainer.hidden=false;
    } else hoursContainer.hidden=true;
    const impact=weatherPanel.querySelector('#game-weather-impact');
    const forecast={...data,roof:exposure,kickoff:game.kickoff};
    const result=window.Unit501WeatherModel?.effect(game,forecast,'score',$('weatherEnabled').checked,Date.now());
    impact.textContent=!$('weatherEnabled').checked?'Model weather adjustment: Off':
      result?.applied?`Model weather adjustment: −${((1-result.factor)*100).toFixed(1)}% to both scores (experimental)`:
      result?.reason?.includes('unverified')?'Model weather adjustment: Not applied (roof unverified)':
      'Model weather adjustment: None (experimental)';
    const source=watch.source||document.createElement('p');
    source.className='weather-source';
    source.replaceChildren();
    const link=document.createElement('a');
    link.href='https://open-meteo.com/';
    link.textContent='Open-Meteo forecast';
    const fetchedTime=new Date(data.fetchedAt).toLocaleString('en-US',{timeZone:'America/Chicago',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
    source.append(link,` · Updated ${fetchedTime} CT · Cached up to 15 minutes. Stadium-area forecast; field conditions may vary. Forecast model adjustments are experimental, not backtested.`);
    if(!watch.source)roof.after(source);
    watch.source=source;
  } catch {
    if (selected === game && conditions.isConnected) {
      conditions.textContent =
        'Weather could not be loaded. Automatic retry while this tab is visible.';
    }
  } finally {
    watch.pending = false;
    if (selected===game && forecastContext?.game===game) {
      forecastContext.settled=true;
      document.dispatchEvent(new Event('unit501:weather-updated'));
    }
    if (weatherWatch === watch) watchWeather();
  }
}
document.addEventListener('unit501:selection-changed', () => {
  clearTimeout(weatherTimer);
  weatherWatch = null;
  forecastContext = null;
  weatherPanel.replaceChildren();
  weatherPanel.hidden = !selected;
  if (!selected) return;

  const heading = document.createElement('h3');
  heading.textContent = 'Weather & venue';
  heading.style.marginTop = '0';

  const venue = document.createElement('p');
  venue.textContent = [
    selected.venueName,
    selected.venueCity
  ].filter(Boolean).join(' • ') || 'Venue unavailable from the game feed.';

  const conditions = document.createElement('div');
  conditions.id = 'game-weather-status';
  conditions.textContent = 'Loading kickoff forecast…';
  const hours=document.createElement('div');
  hours.id='game-weather-hours';
  hours.hidden=true;
  const impact=document.createElement('p');
  impact.id='game-weather-impact';
  impact.textContent='';
  const more=document.createElement('details');
  more.className='weather-more';
  const moreTitle=document.createElement('summary');
  moreTitle.textContent='Forecast details & source';
  more.append(moreTitle);
  const roof = document.createElement('p');
  roof.id = 'game-roof-status';
  const stadium = window.Unit501Venues?.resolve(selected);
  const isIndoor = stadium?.roof === 'indoor';
  roof.textContent = isIndoor ? 'Fixed dome — indoor playing conditions.' : 'Roof type and game-day roof status not verified.';
  if (isIndoor) {
    forecastContext = {game:selected,data:{roof:'indoor',kickoff:selected.kickoff},settled:true};
    conditions.textContent = 'Outside wind and precipitation do not directly affect play inside this enclosed stadium.';
  }

  more.append(roof);
  weatherPanel.append(heading, venue, conditions, hours, impact, more);
  if (!isIndoor) loadVenueForecast(selected, conditions, roof);
});
let contextSequence = 0;
let contextTimer;
function contextMessage(message) {
  teamContext.replaceChildren();
  const title = document.createElement('h3');
  title.textContent = 'Offense & defense';
  title.style.marginTop = '0';
  const text = document.createElement('p');
  text.setAttribute('role','status');
  text.textContent = message;
  teamContext.append(title,text);
}
function showTeamContext(data, game, {loading=false,warning=''} = {}) {
  const nextModel=Unit501TeamModel.project(data,game);
  const nextSignature = JSON.stringify([data.before, data.coverage?.pointsFor, data.coverage?.pointsAgainst,
    data.teams.map(t => [t.id,t.games,t.metrics.pointsFor,t.metrics.pointsAgainst,t.opponents,t.homeVenues,t.opponentScheduleVerified]),
    nextModel.modelVersion,nextModel.away,nextModel.home,nextModel.calibration,nextModel.probabilityCalibration]);
  if (scoringContext?.signature !== nextSignature) {
    scoringContext = {game,data,signature:nextSignature};
    invalidateSimulation('Scoring stats updated. Run the simulation to use them.');
  }
  scoringContext = {game,data,signature:nextSignature};
  document.dispatchEvent(new Event('unit501:team-context-updated'));
  contextMessage(`${data.season} ${data.scope} • completed games before this matchup.`);
  if (warning) {
    const alert = document.createElement('p');
    alert.setAttribute('role','status');
    alert.style.cssText='color:#ffc184;font-weight:600';
    alert.textContent=warning;
    teamContext.append(alert);
  }
  const verifiedYardage=data.verifiedYardage?.coverage===32?data.verifiedYardage:null;
  if(verifiedYardage){
    const source=document.createElement('p');
    source.style.cssText='color:#83e2ba;font-weight:600';
    source.textContent='League rushing/passing ranks available for all 32 teams (nflverse weekly regular-season totals, verified against the completed game schedule). Display-only: does not change score or player projections. Data: ';
    const credit=document.createElement('a');
    credit.href='https://github.com/nflverse/nflverse-data/releases/tag/stats_team';
    credit.target='_blank';credit.rel='noopener noreferrer';
    credit.textContent='nflverse team stats';
    const license=document.createElement('a');
    license.href='https://creativecommons.org/licenses/by/4.0/';
    license.target='_blank';license.rel='noopener noreferrer';
    license.textContent='CC BY 4.0';
    source.append(credit,' (',license,'; aggregated by UNIT 501).');
    teamContext.append(source);
  }
  const unavailable = [game.awayId,game.homeId]
    .map(id=>data.teams.find(t=>t.id===id))
    .filter(t=>t?.games && t.metrics?.rushFor?.games===0 && t.metrics?.passFor?.games===0);
  if (!verifiedYardage && (loading || unavailable.length || data.detailCoverage?.limited)) {
    const info=document.createElement('p');
    info.style.color='#ffc184';
    const reasons=[];
    if (loading) reasons.push('Checking detailed rushing/passing box scores; missing yardage is not zero.');
    else if (!verifiedYardage && unavailable.length) reasons.push('No usable rushing/passing totals were returned for '+unavailable.map(t=>t.name).join(' and ')+' in checked box scores. These are missing records, not zero-yard games.');
    if (data.detailCoverage?.limited && !verifiedYardage) reasons.push('Only '+data.detailCoverage.requested+' of '+data.detailCoverage.eligible+' eligible games are sampled to protect the paid football API. Full-league yardage ranks may remain unavailable.');
    info.textContent=reasons.join(' ');
    teamContext.append(info);
  }
  // Recent results and rest are descriptive, based only on returned completed games.
  const formGrid=document.createElement('div');formGrid.className='football-form-grid';
  const restByTeam=new Map();
  for(const [id,name] of [[game.awayId,game.a],[game.homeId,game.h]]){
    const team=data.teams.find(t=>String(t.id)===String(id));
    const games=(team?.recentGames||[]).filter(g=>Number.isFinite(g.kickoff)&&g.kickoff<game.kickoff).sort((a,b)=>b.kickoff-a.kickoff);
    const card=document.createElement('section');card.className='football-form-card';
    const heading=document.createElement('h4');heading.textContent=name;card.append(heading);
    // Full-season W-L comes from verified league standings, never the sampled recent games.
    const seasonRecord=document.createElement('span');seasonRecord.className='football-season-record';
    seasonRecord.textContent=' · Season W–L unavailable';heading.append(seasonRecord);
    const pulseLeague=game.league==='1'?'nfl':'ncaaf';
    fetch('/api/league-pulse?league='+pulseLeague,{signal:AbortSignal.timeout(12000)})
      .then(r=>r.ok?r.json():null).then(result=>{
        if(selected!==game||!heading.isConnected)return;
        const standing=result?.power?.available&&Array.isArray(result.power.teams)
          ?result.power.teams.find(t=>String(t.id)===String(id)):null;
        if(standing&&/^\d+-\d+(?:-\d+)?$/.test(String(standing.record||''))){
          seasonRecord.textContent=' ('+standing.record+')';
        }
      }).catch(()=>{});

    const rest=document.createElement('p');
    const schedule=window.Unit501FootballTravel?.schedule(games,game.kickoff);
    restByTeam.set(String(id),schedule);
    if(schedule?.available){
      rest.textContent=schedule.fullDaysOff+' full '+(schedule.fullDaysOff===1?'day':'days')+' off'+(schedule.shortWeek?' · Short week':'');
      if(schedule.shortWeek)rest.className='football-short-week';
      const workload=document.createElement('p');workload.textContent=(schedule.gapHours/24).toLocaleString('en-US',{maximumFractionDigits:1})+' days between kickoffs · '+schedule.gamesLast14Days+' '+(schedule.gamesLast14Days===1?'game':'games')+' in previous 14 days';card.append(workload);
    }
    else rest.textContent='Rest unavailable: no previous completed game returned.';
    card.append(rest);
    const form=document.createElement('div');form.className='football-form-results';
    for(const g of games.slice(0,5)){if(!Number.isFinite(g.scored)||!Number.isFinite(g.allowed))continue;const badge=document.createElement('span');const value=g.scored>g.allowed?'W':g.scored<g.allowed?'L':'T';badge.className='football-form-'+value.toLowerCase();badge.textContent=value;badge.title=g.opponent+' · '+g.scored+'–'+g.allowed;form.append(badge);}card.append(form);
    const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Last '+Math.min(games.length,5)+' recorded results';details.append(summary);
    for(const g of games.slice(0,5)){const line=document.createElement('p');const when=new Date(g.kickoff).toLocaleDateString('en-US',{timeZone:'America/Chicago',month:'short',day:'numeric'});line.textContent=when+' · '+(g.side==='away'?'at ':'vs ')+g.opponent+' · '+(g.scored===null||g.allowed===null?'Score unavailable':g.scored+'–'+g.allowed);details.append(line);}card.append(details);
    const travel=document.createElement('p');travel.textContent=games.length?'Checking distance between game venues…':'Previous game venue unavailable.';card.append(travel);formGrid.append(card);
    if(games.length&&window.Unit501FootballTravel){
      footballTravel.estimate(game,name,games[0]).then(result=>{
        if(selected!==game||!card.isConnected)return;
        travel.textContent=result?`About ${result.miles} miles straight-line from last game venue to this venue${result.cityPrecision?' (city estimate)':''}${result.previous&&result.current?' · '+result.previous+' → '+result.current:''}. Actual route and travel method unknown.`:'Distance between game venues unavailable.';
      });
    }
  }
  const formTitle=document.createElement('h3');formTitle.textContent='Recent form & rest';teamContext.append(formTitle,formGrid);
  const awayRest=restByTeam.get(String(game.awayId)),homeRest=restByTeam.get(String(game.homeId));
  const restComparison=document.createElement('p');restComparison.className='football-rest-comparison';
  if(awayRest?.available&&homeRest?.available){
    const difference=awayRest.fullDaysOff-homeRest.fullDaysOff;
    restComparison.textContent=difference===0?'Rest comparison: both teams have '+awayRest.fullDaysOff+' full day(s) off.':'Rest comparison: '+(difference>0?game.a:game.h)+' has '+Math.abs(difference)+' more full day(s) off.';
    restComparison.textContent+=' Based on recorded games; no automatic score adjustment.';
  }else restComparison.textContent='Rest comparison unavailable: previous completed games are needed for both teams.';
  teamContext.append(restComparison);
  const formNote=document.createElement('p');formNote.textContent='Based on returned completed games; full schedule coverage is not independently verified. Rest does not include travel or player availability.';teamContext.append(formNote);
  const grid = document.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:14px';
  for (const [id,name] of [[game.awayId,game.a],[game.homeId,game.h]]) {
    const team = data.teams.find(team => team.id === id);
    const column = document.createElement('div');
    const heading = document.createElement('h4');
    heading.textContent = name;
    column.append(heading);
    if (!team || !team.games) {
      const missing = document.createElement('p');
      missing.textContent = 'No completed season games available.';
      column.append(missing);
    } else {
      const count = document.createElement('p');
      count.textContent = `${team.games} completed ${team.games === 1 ? 'game' : 'games'}${team.games < 4 ? ' • Small early-season sample' : ''}`;
      column.append(count);
      for (const [key,label] of data.metrics) {
        const metric = team.metrics[key];
        const verifiedMetric=verifiedYardage?.teams?.[String(team.id)]?.[key]||null;
        const displayMetric=verifiedMetric||metric;
        const row = document.createElement('div');
        row.style.cssText = 'padding:10px 0;border-top:1px solid #293142';
        const title = document.createElement('div');
        title.textContent = label;
        const value = document.createElement('strong');
        value.textContent = displayMetric.average === null
          ? (loading && !key.startsWith('points') ? 'Checking box scores…' : 'Unavailable')
          : `${displayMetric.average.toFixed(1)} ${key.startsWith('points') ? 'pts' : 'yds'}/game`;
        const rank = document.createElement('span');
        const coverage = data.coverage?.[key];
        rank.textContent = displayMetric.rank === null
          ? (data.scope.includes('FBS rankings') && !team.fbsName ? ' • Outside FBS ranking pool'
            : data.detailCoverage?.limited && !key.startsWith('points') ? ' • National rank unavailable (limited coverage)'
            : coverage ? ` • Rank unavailable (${coverage.complete}/${coverage.expected} teams complete)` : ' • Rank unavailable')
          : ` • #${displayMetric.rank} of ${displayMetric.pool}${verifiedMetric ? ' (nflverse)' : team.fbsName ? ' FBS' : ''}`;
        if (displayMetric.rank !== null) rank.style.color = displayMetric.rank <= Math.ceil(displayMetric.pool / 4) ? '#83e2ba' : displayMetric.rank > Math.floor(displayMetric.pool * .75) ? '#ffc184' : '#c5cede';
        row.append(title,value,rank);
        if (!verifiedMetric && metric.games !== team.games) {
          const coverage = document.createElement('div');
          coverage.style.cssText = 'font-size:.85em;color:#ffc184';
          coverage.textContent = `${metric.games}/${team.games} games have this stat • ${loading && !key.startsWith('points') ? 'box scores still loading' : 'incomplete average'}`;
          row.append(coverage);
        }
        column.append(row);
      }
    }
    grid.append(column);
  }
  const note = document.createElement('p');
  note.style.cssText = 'font-size:.85em;color:#aeb9c9';
  note.textContent = (data.detailCoverage?.limited ? `API conservation: detailed paid rushing/passing box scores sampled from ${data.detailCoverage.requested} of ${data.detailCoverage.eligible} eligible games. ${verifiedYardage?'League yardage ranks come separately from validated nflverse weekly team stats (CC BY 4.0), not the paid sample.':'National yardage ranks may remain unavailable.'} Scoring rankings and score forecasts use completed-game scores. ` : '') + data.explanation + ' Passing uses team box-score totals. Scoring allowed includes all opponent points, including defense/special teams. Rankings show raw averages. Game predictions combine offense and opposing defense deviations from one league scoring average, with small-sample smoothing. Schedule strength adjusts predicted scores only when both teams have complete opponent scoring coverage; otherwise the baseline is retained. Rushing and passing ranks are context only. Player projections use their separate model.';
  teamContext.append(grid,note);
  for(const [id,name]of [[game.awayId,game.a],[game.homeId,game.h]]){
    const team=data.teams.find(t=>t.id===id),pace=team?.pace;
    if(pace?.games||pace?.playGames){const line=document.createElement('p');line.textContent=`${name} pace: ${pace.games?(pace.drives/pace.games).toFixed(1)+' recorded drives/game ('+pace.games+'/'+team.games+' games)':'drive counts unavailable'}; ${pace.playGames?(pace.plays/pace.playGames).toFixed(1)+' plays/game ('+pace.playGames+'/'+team.games+' games)':'play counts unavailable'}. Recorded drives are a possession proxy, including end-of-half drives and overtime when present.`;teamContext.append(line);}
  }
  if(data.paceValidation){const check=data.paceValidation,line=document.createElement('p');line.textContent=`Pace model check: ${check.evaluatedGames} later games.${Number.isInteger(check.warmupGames)?` ${check.warmupGames} warm-up predictions; ${check.skipped} games lacked eligible scoring or complete drive coverage.`:''} ${check.evaluatedGames?`Score error ${check.scoreError.toFixed(1)} vs current ${check.baselineScoreError.toFixed(1)}; total error ${check.totalError.toFixed(1)} vs current ${check.baselineTotalError.toFixed(1)}. `:''}${check.accepted?'Drive-based scoring enabled.':'Current scoring retained; the pace candidate has not passed both improvement gates.'} ${check.explanation}`;teamContext.append(line);}
  const validation=data.validation;
  if(validation){
    const section=document.createElement('section');section.className='model-performance';
    const heading=document.createElement('h3');heading.textContent='Model Performance';
    section.append(heading);
    const grid=document.createElement('div');grid.className='model-performance-grid';
    const stats=[
      ['Games tested',validation.games],
      ['Avg. team score error',validation.scoreMAE],
      ['Avg. margin error',validation.marginMAE],
      ['Avg. total error',validation.totalMAE]
    ];
    for(const [label,value] of stats){
      const tile=document.createElement('div');tile.className='model-performance-stat';
      const number=document.createElement('strong');
      number.textContent=Number.isFinite(value)?(label==='Games tested'?String(value):value.toFixed(1)):'—';
      const name=document.createElement('span');name.textContent=label;
      tile.append(number,name);grid.append(tile);
    }
    section.append(grid);
    if(Number.isFinite(validation.totalBias)){
      const bias=document.createElement('p');bias.textContent='Total prediction bias: '+(validation.totalBias>=0?'+':'')+validation.totalBias.toFixed(1)+' points';section.append(bias);
    }
    teamContext.append(section);
  }
}
function loadTeamContext(game) {
  clearTimeout(contextTimer);
  const task = ++contextSequence;
  const params = new URLSearchParams({league:$('league').value, season:$('date').value.slice(0,4),
    before:game.kickoff,away:game.awayId,home:game.homeId});
  let polls = 0;
  let lastProgress = '', lastChanged = Date.now();
  contextMessage('Loading pregame scoring stats… Detailed box-score downloads are capped to save API requests.');
  async function poll() {
    try {
      const response = await fetch('/api/rankings?' + params, {signal:AbortSignal.timeout(20000)});
      const result = await response.json();
      if (task !== contextSequence || selected !== game) return;
      if (result.state === 'error' && result.data) {
        showTeamContext(result.data, game, {warning:'Rankings could not finish: '+result.message+' Select the game again in a minute to retry.'});
        return;
      }
      if (!response.ok || result.error || result.state === 'error') throw new Error(result.error || result.message || 'Stats unavailable.');
      if (result.state === 'ready') { showTeamContext(result.data, game); return; }
      if (++polls >= 1200) throw new Error('Still gathering season stats. Select the game again shortly to check progress.');
      const progress = result.total ? `Building rankings: ${result.completed} of ${result.total} completed games checked. Saved results make later loads faster.` : result.message || 'Finding completed season games…';
      if(progress!==lastProgress){lastProgress=progress;lastChanged=Date.now();}
      const stalled=Date.now()-lastChanged>120000;
      if (result.data) {
        showTeamContext(result.data, game, {loading:true});
        const status = document.createElement('p');
        status.setAttribute('role', 'status');
        status.textContent = progress + (result.data.coverage.pointsFor.ranked && result.data.coverage.pointsAgainst.ranked ? ' Scoring is ready: you can run the simulation while yardage rankings finish.' : '') + (stalled ? ' No progress for two minutes. Check provider quota or reselect this game to retry.' : '');
        teamContext.append(status);
      } else contextMessage(progress + (stalled ? ' No progress for two minutes. Check provider quota or reselect this game to retry.' : ''));
      contextTimer = setTimeout(poll,3000);
    } catch (error) {
      if (task === contextSequence && selected === game) {
        if(scoringContext?.game===game) {
          showTeamContext(scoringContext.data,game,{warning:'Rankings refresh stopped: '+error.message+' Reselect the game to retry.'});
        } else contextMessage('Team comparison unavailable: ' + error.message);
      }
    }
  }
  poll();
}

function clearSelection() {
  scoringContext = null;
  invalidateSimulation();
  contextSequence++;
  clearTimeout(contextTimer);
  teamContext.replaceChildren();
  oddsSequence++;
  pulseSplitsSequence++;
  pulseSplits=null;pulseObservations=null;pulseManual=false;
  selected = null;
  
  $('lab').classList.add('hidden');
  $('player-lab').classList.add('hidden');
  for (const [id, label] of [['quick-lab','🎯 Game Lab · select game'],['quick-player','📊 Player props · select game']]) {
    const link = $(id);
    if (link) { link.classList.add('is-unavailable'); link.setAttribute('aria-disabled','true'); link.tabIndex = -1; link.textContent = label; }
  }
  document.dispatchEvent(new Event('unit501:selection-changed'));
  document.dispatchEvent(new Event('unit501:matchup-cleared'));
}

const today = window.Unit501SharedUI.dateCentral();

$('date').value = today;

function showMessage(message) {
  games.innerHTML = '';
  const card = document.createElement('div');
  card.className = 'card';
  card.textContent = message;
  games.appendChild(card);
}

async function health() {
  try {
    const response = await fetch('/api/health');
    if (!response.ok) throw new Error('Health check failed');

    const data = await response.json();
    $('status').textContent = data.liveData
      ? 'DATA KEY CONNECTED · CHECKING GAMES'
      : 'DATA KEY NOT CONNECTED';
  } catch {
    $('status').textContent = 'APP CONNECTION ERROR';
  }
}

function parseGame(g) {
  const away = g.teams?.away || g.teams?.visitors || {};
  const home = g.teams?.home || {};
  const date = g.game?.date || {};
  const status = g.game?.status || {};

  return {
    id: g.game?.id || g.id,
   awayId: String(away.id || ''),
homeId: String(home.id || ''),
venueName: g.game?.venue?.name || '',
venueCity: g.game?.venue?.city || '',
    kickoff: date.timestamp ? Number(date.timestamp) * 1000 : Date.parse(date.date + 'T' + date.time),
    a: away.name || 'Away team TBD',
    h: home.name || 'Home team TBD',
    time: date.timestamp
      ? new Date(date.timestamp * 1000).toLocaleTimeString('en-US', {
          timeZone: 'America/Chicago',
          hour: 'numeric',
          minute: '2-digit'
        }) + ' CT'
      : date.time
        ? date.time + ' CT'
        : 'Time TBD',
    status: status.long || 'Scheduled',
    awayScore: g.scores?.away?.total,
    homeScore: g.scores?.home?.total
  };
}

async function load() {
  const task = ++slateSequence;
  clearSelection();

  showMessage('Loading games…');

  const date = $('date').value;
  const league = $('league').value;

  if (!date) {
    showMessage('Choose a date first.');
    return;
  }

  try {
    const params = new URLSearchParams({
      date,
      league,
      season: date.slice(0, 4),
      timezone: 'America/Chicago'
    });

    const response = await fetch('/api/games?' + params);
    const data = await response.json();
    if (task !== slateSequence) return;

    if (!response.ok || data.error) {
      throw new Error(data.error || 'Game request failed');
    }

    if (data.errors && Object.keys(data.errors).length) {
      throw new Error(
        typeof data.errors === 'string'
          ? data.errors
          : JSON.stringify(data.errors)
      );
    }

    if (!Array.isArray(data.response)) {
      throw new Error('The data provider did not return a game list.');
    }

    // The provider includes aggregate Division II/III rows with no teams.
    // Keep partially identified matchups, but do not render empty placeholders.
    const slate = data.response.filter(game => {
      const teams = game.teams || {};
      return [teams.away || teams.visitors, teams.home].some(team =>
        team && (Number(team.id) > 0 || (typeof team.name === 'string' && team.name.trim()))
      );
    }).map(parseGame);

    if (!slate.length) {
      document.dispatchEvent(new CustomEvent('unit501:slate-loaded',{detail:{league:league==='1'?'nfl':'ncaaf'}}));
      $('status').textContent = 'NO GAMES RETURNED';
      showMessage(
        'No games were returned for this date. This could mean there are no games scheduled, or your data plan does not include this season.'
      );
      return;
    }

    $('status').textContent = 'GAME DATA RECEIVED';
    document.dispatchEvent(new CustomEvent('unit501:slate-loaded',{detail:{league:league==='1'?'nfl':'ncaaf'}}));
    games.innerHTML = '';

    slate.forEach(game => {
      const hasScore=game.awayScore!=null && game.homeScore!=null;
      const detailText=`${game.time} | ${game.status}`+
        (hasScore ? ` | ${game.a} ${game.awayScore} - ${game.h} ${game.homeScore}` : '');
      const card=window.Unit501SharedUI.gameCard({
        away:game.a,home:game.h,detailText,container:games,
        onSelect:()=>choose(game)
      });
      games.appendChild(card);
    });
  } catch (error) {
    if (task !== slateSequence) return;
    $('status').textContent = 'GAME DATA UNAVAILABLE';
    showMessage('Unable to load games: ' + error.message);
  }
}

async function choose(game) {
  scoringContext = null;
  game.league = $('league').value;
  game.season = $('date').value.slice(0,4);
  const priorLeague=selected?.league;
  selected = game;
  $('autoInjuries').checked=true;injuryModeChanged();
  document.dispatchEvent(new Event('unit501:selection-changed'));
  $('lab').classList.remove('hidden');
  $('player-lab').classList.remove('hidden');
  for (const [id,label] of [['quick-lab','🎯 Game Lab'],['quick-player','📊 Player props']]) {
    const link = $(id);
    if (link) { link.classList.remove('is-unavailable'); link.setAttribute('aria-disabled','false'); link.tabIndex = 0; link.textContent = label; }
  }
  $('matchup').textContent = window.Unit501SharedUI.matchup(game.a, game.h);
  document.dispatchEvent(new CustomEvent('unit501:matchup-selected',{detail:{league:game.league==='1'?'nfl':'ncaaf',away:game.a,home:game.h}}));

  // Do not invent a betting line when current odds are unavailable.
  $('spread').value = '';
  $('total').value = '';
  $('awayRating').value = 0;
  $('homeRating').value = 0;
  for (const id of ['awayOffenseLoss','awayDefenseLoss','homeOffenseLoss','homeDefenseLoss']) $(id).value = 0;
  $('venueMode').value = 'home';
  $('variableHomeField').checked=false;
  $('homeContext').value=3;
  $('homeFieldMode').value='auto';
  $('home-advantage-override').open=false;
  $('gameMode').value='normal';
  $('homeContext').disabled=true;
  $('homeFieldReason').disabled=true;
  $('homeFieldReason').value='';
  describeMatchup(game);
  renderHomeAdvantage();
  pulseObservations=null;pulseSplits=null;pulseManual=false;
  renderMarketPulse();
  loadMarketSplits();
  
  homeFieldProfiles=null;
  loadHomeField(game);

  $('score').textContent = '—';
  $('cover').textContent = '—';
  $('over').textContent = '—';
  $('win').textContent = '—';
  for (const id of ['outright-pick','underdog-outlook','win-both','upset-history']) $(id).textContent = '—';

  $('note').textContent =
    'Enter the current FanDuel spread and total to run a simulation.';

  $('lab').scrollIntoView({ behavior: 'smooth' });
  loadFanDuel();
  loadTeamContext(game);
}

function sim() {
  if (!selected) return;
  invalidateSimulation();
  const marketFields=[['spread','FanDuel away spread'],['total','FanDuel total']];
  for(const [id,label] of marketFields){
    const field=$(id);
    if(field.value===''||field.validity?.badInput||!Number.isFinite(Number(field.value))||(id==='total'&&Number(field.value)<=0)){
      $('note').textContent=field.value===''&&!field.validity?.badInput?
        `Missing ${label}. Load FanDuel lines or enter it above.`:`Check ${label}: enter ${id==='total'?'a number greater than 0':'a valid number (0 for pick’em)'}.`;
      field.focus();
      return;
    }
  }
  const adjustmentFields=[['awayRating','Away point adjustment'],['homeRating','Home point adjustment']];
  if(!$('autoInjuries').checked)adjustmentFields.push(
    ['awayOffenseLoss','Away offense loss'],['awayDefenseLoss','Away defense loss'],
    ['homeOffenseLoss','Home offense loss'],['homeDefenseLoss','Home defense loss']);
  for(const [id,label] of adjustmentFields){
    const field=$(id);
    if(field.validity?.badInput||(field.value!==''&&!Number.isFinite(Number(field.value)))){
      $('note').textContent=`Check ${label}: enter a valid number.`;
      field.focus();
      return;
    }
    if(field.value==='')field.value='0';
  }
  const spread = Number($('spread').value);
  const total = Number($('total').value);
  const data = scoringContext?.game === selected ? scoringContext.data : null;
  const forecastAt=Date.now();
  const lineup=window.Unit501Lineups?.evaluate();
  const automatic=['1','2'].includes(selected.league)&&$('autoInjuries').checked&&window.Unit501AutoInjury?
    window.Unit501AutoInjury.evaluate(window.Unit501Availability?.snapshot(),selected,lineup,forecastAt,data):null;
  if(automatic)renderAutomaticInjuries(automatic,true);
  const options = {now:forecastAt,gameMode:$('gameMode').value,
    away:Number($('awayRating').value),home:Number($('homeRating').value),venueMode:$('venueMode').value,
    variableHomeField:$('variableHomeField').checked,homeFieldProfile:homeFieldProfiles,homeFieldTotal:$('homeFieldMode').value==='manual'?Number($('homeContext').value):null,homeFieldReason:$('homeFieldReason').value,
    forecast:forecastContext?.game === selected ? forecastContext.data : null,
    injury:automatic?{...automatic.injury}:{
      awayOffense:Number($('awayOffenseLoss').value),awayDefense:Number($('awayDefenseLoss').value),
      homeOffense:Number($('homeOffenseLoss').value),homeDefense:Number($('homeDefenseLoss').value)},
    awaySpread:spread,splitsEnabled:false,
    quarterback:automatic?{...automatic.quarterback}:null,
    automaticInjury:automatic?{applied:automatic.applied,withheld:automatic.withheld,message:automatic.message}:null,
    lineup,
    weatherEnabled:$('weatherEnabled').checked
  };
  const prediction = Unit501TeamModel.project(data, selected, options);
  if (!prediction.available) {
    $('note').textContent = prediction.reason;
    return false;
  }
  renderHomeAdvantage(prediction.venue);
  const result = Unit501TeamModel.simulate(prediction,spread,total);
  const percent = value => (value*100).toFixed(1) + '%';
  const calibratedMarkets=Object.entries({win:'away win',cover:'away cover',over:'over'}).filter(([key])=>result.calibrated[key]!==null).map(([,name])=>name);
  $('score').textContent = `${Math.round(prediction.away)}–${Math.round(prediction.home)}`;
  $('cover').textContent = percent(result.calibrated.cover??result.cover);
  $('over').textContent = percent(result.calibrated.over??result.over);
  $('win').textContent = percent(result.calibrated.win??result.win);
  const outlook=Unit501TeamModel.outcome(prediction,spread);
  const teamName=side=>side==='away'?selected.a:selected.h;
  $('outright-pick').classList.toggle('automatic-upset-pick',outlook.upset);
  $('outright-pick').textContent=outlook.winner?
    `${outlook.upset?'⚠ UPSET ALERT · ':''}UNIT501 projects ${teamName(outlook.winner)} to win outright by ${Math.abs(outlook.margin).toFixed(1)} points${outlook.upset?' — UNDERDOG UPSET PICK':''}.`:
    'Projected scores are tied — no outright winner selected.';
  if(!outlook.underdog){
    $('underdog-outlook').textContent='Pick’em line — neither team is a spread underdog.';
  }else{
    const dog=teamName(outlook.underdog),dogLine=Math.abs(spread);
    $('underdog-outlook').textContent=`${dog} +${dogLine}: `+(outlook.upset?'projected to win outright.':
      outlook.underdogCoverOnly?'projected to cover, but lose outright.':
      !outlook.winner?'projected to tie the game and cover; no outright win projected.':
      !outlook.cover?'projected to lose outright and push the spread.':'projected to lose outright and fail to cover.');
  }
  const calibratedWin=result.calibrated.win;
  const awayWin=calibratedWin??result.win;
  const homeWin=calibratedWin!==null?1-calibratedWin:Math.max(0,1-result.win-result.tie);
  $('win-both').textContent=`${selected.a} win ${percent(awayWin)} · ${selected.h} win ${percent(homeWin)} · `+
    (calibratedWin!==null?`win percentages calibrated among non-tied scores; raw tied-score frequency ${percent(result.tie)}.`:
      `tied scores ${percent(result.tie)} · raw simulation frequencies.`);
  const strength = prediction.schedule;
  const scheduleNote = strength.applied
    ? prediction.pace?.applied ? 'Schedule strength corrections are included in scoring per drive, using opponents’ other pre-kickoff games with conservative limits. Cross-division strength remains experimental.'
    : `Schedule strength applied automatically: baseline ${prediction.unadjustedAway.toFixed(1)}–${prediction.unadjustedHome.toFixed(1)} → adjusted ${prediction.preInjuryAway.toFixed(1)}–${prediction.preInjuryHome.toFixed(1)} points (before injuries and home field; same manual point adjustments). Uses opponents’ other pre-kickoff games with conservative limits for small samples. Experimental, not calibrated.${strength.away.supplemental + strength.home.supplemental ? " Includes separately fetched non-FBS opponent scoring; cross-division strength is not calibrated." : ""}`
    : `Schedule strength unavailable: opponent coverage ${strength.away.covered}/${strength.away.total} away and ${strength.home.covered}/${strength.home.total} home. Baseline retained for both teams; missing opponents are not guessed. Unresolved: ${[...new Set([...strength.away.missing,...strength.home.missing])].join(", ") || "incomplete scoring history"}.`;
  const availabilityReview = window.Unit501InjuryModel?.impactReview(window.Unit501Availability?.snapshot(),selected,lineup);
  const autoCovered=new Set((automatic?.applied||[]).map(p=>p.teamId+':'+p.playerId));
  const availabilityNote = availabilityReview ? availabilityReview.teams.map(t=>{
    const name=t.id===selected.awayId?selected.a:selected.h;
    const stillUnvalued=t.unvalued.filter(p=>!autoCovered.has(t.id+':'+p.id));
    const autoCount=(automatic?.applied||[]).filter(p=>p.teamId===t.id).length;
    return `${name}: ${t.applied.length} absences or announced QB changes covered by a lineup score scenario, ${autoCount} by experimental automatic injury points; ${stillUnvalued.length} without a score valuation${stillUnvalued.length?' ('+stillUnvalued.map(p=>p.name).join(', ')+')':''}; ${t.conflicts.length} conflicting, ${t.conditional.length} conditional and ${t.unknown.length} unresolved reports. ${t.reportsVerified?'Fresh provider roster and injury feeds checked; this does not confirm full health or starters.':'Roster/injury feed coverage incomplete or expired; zero listed absences does not mean healthy.'}`;
  }).join(' ')+' '+availabilityReview.reason : 'Availability score coverage has not been reviewed.';
  $('availability-score-status').textContent='Availability score coverage: '+availabilityNote;
  const injuryNote = automatic?
    `Automatic experimental injury scenario: away offense ${prediction.injury.awayOffense.toFixed(2)}, away defense ${prediction.injury.awayDefense.toFixed(2)}, home offense ${prediction.injury.homeOffense.toFixed(2)}, home defense ${prediction.injury.homeDefense.toFixed(2)} points. ${automatic.applied.length} matched injury absence(s), ${automatic.withheld.length} review item(s). These assumed weights are not validated and may overlap the baseline; manual boxes were not added. See injury scoring section for names and withheld cases.`:
    prediction.injury.applied
    ? `User injury scenario: away offense loss ${prediction.injury.awayOffense.toFixed(1)}, away defense loss ${prediction.injury.awayDefense.toFixed(1)}, home offense loss ${prediction.injury.homeOffense.toFixed(1)}, home defense loss ${prediction.injury.homeDefense.toFixed(1)} points. Scores ${prediction.preInjuryAway.toFixed(1)}–${prediction.preInjuryHome.toFixed(1)} → ${prediction.preVenueAway.toFixed(1)}–${prediction.preVenueHome.toFixed(1)} before home field and weather. User estimates in addition to any replacement scenario.`
    : 'No injury scenario entered; this does not confirm either team is healthy. Confirmed replacement scenarios can change scores after the player-ratings build; missing role or replacement data is withheld.';
  const weatherNote = prediction.weather.reason + (prediction.weather.applied
    ? ` Before wind ${prediction.preWeatherAway.toFixed(1)}–${prediction.preWeatherHome.toFixed(1)} → after wind ${prediction.away.toFixed(1)}–${prediction.home.toFixed(1)}.` : '');
  const paceNote=prediction.pace?.reason||'Drive reports unavailable; current scoring retained.';
  $('note').textContent = `Score order: ${selected.a}–${selected.h}. Based on ${prediction.awayGames}/${prediction.homeGames} completed games, with early-season smoothing. ${calibratedMarkets.length?'Calibration applied to '+calibratedMarkets.join(', ')+'. Those percentages exclude pushes/tied scores; other markets remain raw frequencies.':'Raw model frequencies; calibration unavailable for this sample or adjusted scenario.'} Variance: ${result.varianceSource}. Raw win/cover/over frequencies: ${percent(result.win)} / ${percent(result.cover)} / ${percent(result.over)}. Lineup scenario score changes: ${prediction.lineup.awayChange.toFixed(1)} / ${prediction.lineup.homeChange.toFixed(1)} points. Injury point assumptions add to confirmed lineup scenarios, but known duplicate player losses are skipped automatically. See Historical model check for held-out errors. These are not validated betting probabilities. ${scheduleNote} ${prediction.venue.reason} Home-margin change before weather: +${prediction.venue.appliedMargin.toFixed(1)} points. ${weatherNote} ${injuryNote} ${availabilityNote} Spread pushes: ${percent(result.spreadPush)}; total pushes: ${percent(result.totalPush)}; tied scores: ${percent(result.tie)} (overtime not modeled).`;
  if(prediction.gameScenario?.applied)$('note').textContent+=` Manual ${prediction.gameScenario.mode}: projected margin ×${prediction.gameScenario.factor}; total unchanged.`;
  $('note').textContent+=` Simulated 21+ point margins: ${selected.a} ${percent(result.blowout.away)}, ${selected.h} ${percent(result.blowout.home)}. These are raw simulation frequencies, not calibrated blowout probabilities.`;
  $('note').textContent+=' '+paceNote+' QB passing changes: '+prediction.quarterback.away.toFixed(1)+' / '+prediction.quarterback.home.toFixed(1)+' points.';
  if(window.Unit501ForecastArchive){
    if(automatic&&!automatic.ready){
      latestForecast=null;
    }else try{
      const snapshot=Unit501ForecastArchive.capture({game:selected,data,options,marketContext:{awaySpread:spread,total,quotes:gameQuotes?.game===selected?gameQuotes.data:null},availability:window.Unit501Availability?.snapshot(),lineupInputs:window.Unit501Lineups?.snapshot()},forecastAt);
      latestForecast=snapshot;
      Unit501ForecastArchive.save(localStorage,snapshot);
    }catch{ latestForecast=null; }
  }
  try{
    const snapshots=Unit501ForecastArchive.read(localStorage).snapshots.filter(s=>
      String(s.game?.league)===String(selected.league)&&String(s.game?.season)===String(selected.season));
    const history=Unit501ForecastDashboard.upsetHistory(snapshots);
    const panel=$('upset-history');panel.replaceChildren();
    for(const g of history.groups){
      const line=document.createElement('p');
      line.textContent=`${g.league==='1'?'NFL':'College'} ${g.season} · ${g.modelVersion}: ${g.projectedUpsets} outright underdog picks in ${g.forecasts} saved forecasts with a nonzero spread. ${g.completed} completed: ${g.actualUpsets} actual upsets, ${g.calledUpsets} called, ${g.missedUpsets} missed; ${g.falseAlarms} upset picks lost, ${g.actualTies} final ties. ${g.pending} pending results.`;
      panel.append(line);
    }
    const note=document.createElement('p');
    note.textContent=(history.groups.length?'':'No eligible saved pregame forecasts with an underdog line yet. ')+
      `Uses the spread entered with the first saved forecast on this browser, not a verified closing line or full-season history. ${history.missingLine} missing lines, ${history.pickem} pick’em games and ${history.excluded} invalid or duplicate snapshots excluded. Manual scenarios are included under their saved model version. Missing results are pending, not losses; no betting profit is inferred.`;
    panel.append(note);
  }catch{$('upset-history').textContent='Saved upset history could not be verified. Existing forecasts are retained.';}
  document.dispatchEvent(new Event('unit501:simulation-completed'));
  return true;
}

$('load').onclick = load;
$('sim').onclick = sim;
for (const id of ['date', 'league']) {
  $(id).addEventListener('change', () => {
    slateSequence++;
    clearSelection();
    showMessage('Tap Load Slate to see games for this date and league.');
  });
}

health();
load();

document.addEventListener('unit501:availability-updated',()=>{
  if($('autoInjuries').checked&&selected){
    previewAutomaticInjuries();
    invalidateSimulation('Injury evidence updated. Run the simulation again.');
  }else if($('availability-score-status').textContent){
    $('availability-score-status').textContent='Availability reports changed or freshness was rechecked. Run the simulation again to review score coverage.';
  }
});

$('maintenance-panel').addEventListener('toggle',async()=>{
  if(!$('maintenance-panel').open)return;
  try{
    const response=await fetch('/api/roster-maintenance');
    if(!response.ok)throw Error();
    const report=await response.json();
    $('maintenance-status').textContent=report.message+' '+(report.lastCompleted?'Last completed: '+new Date(report.lastCompleted).toLocaleString()+'. ':'')+report.gamesChecked+' games checked. Status is local to this server and resets on restart.';
    $('maintenance-issues').replaceChildren();
    const groups=new Map();
    const reviewIssues=[...(report.issues||[])].sort((a,b)=>(a.priority||2)-(b.priority||2));
    for(const item of reviewIssues){
      const key=String(item.game);
      if(!groups.has(key)){
        const row=document.createElement('li'),details=document.createElement('details'),summary=document.createElement('summary'),list=document.createElement('ul');
        summary.textContent=(item.matchup||'Game '+key)+(Number.isFinite(item.kickoff)?' — '+new Date(item.kickoff).toLocaleString():'');
        const counts=reviewIssues.filter(i=>String(i.game)===key);
        summary.textContent+=' · '+counts.filter(i=>i.priority===1).length+' review first · '+counts.length+' total notices';
        details.open=String(selected?.id)===key;details.append(summary,list);row.append(details);$('maintenance-issues').append(row);groups.set(key,list);
      }
      const row=document.createElement('li');row.textContent=(item.reviewLabel?item.reviewLabel+' — ':'')+item.label+': '+item.reason;
      if(item.url){try{const url=new URL(item.url);if(url.protocol==='https:'){const link=document.createElement('a');link.href=url.href;link.textContent=' View source';link.target='_blank';link.rel='noopener noreferrer';row.append(link);}}catch{}}
      if(item.players?.length){
        const players=document.createElement('ul');
        for(const player of item.players){const entry=document.createElement('li');entry.textContent=[player.name,player.position,player.status,player.reason,player.rank?'Listed depth '+player.rank:null,player.teamNames?.length?'Listed on multiple provider rosters: '+player.teamNames.join(', '):player.teamIds?'Conflicting provider team IDs: '+player.teamIds.join(', '):null].filter(Boolean).join(' · ');players.append(entry);}
        row.append(players);
      }
      groups.get(key).append(row);
    }
    if(!report.issues?.length){const row=document.createElement('li');row.textContent=report.running?'Check in progress. Close and reopen this panel to refresh.':'No review items reported by this sweep. This does not confirm every player is healthy.';$('maintenance-issues').append(row);}
  }catch{$('maintenance-status').textContent='Background check status unavailable. Open a matchup to refresh its reports.';}
});

document.addEventListener('unit501:team-context-updated',previewAutomaticInjuries);
document.addEventListener('unit501:lineup-updated',previewAutomaticInjuries);

// On-demand comparison for the currently selected football matchup.
{
 const button=$('football-compare'),status=$('football-compare-status'),board=$('football-compare-board');
 let serial=0,timer;
 const node=(tag,text)=>{const n=document.createElement(tag);n.textContent=text;return n;};
 const signed=n=>n>0?'+'+n:String(n);
 function reset(){serial++;clearTimeout(timer);board.replaceChildren();button.disabled=false;status.textContent=selected?'Click Compare to check the three sportsbooks.':'Select a matchup to compare pregame lines.';}
 document.addEventListener('unit501:selection-changed',reset);
 function render(game,data){
  board.replaceChildren();if(!data.books?.length){board.append(node('p',data.message||'No quotes available.'));return;}
  const table=node('table',''),head=node('thead',''),header=node('tr','');
  for(const name of ['Sportsbook',game.a+' moneyline',game.h+' moneyline',game.a+' spread',game.h+' spread','Over','Under']){const th=node('th',name);th.scope='col';header.append(th);}head.append(header);table.append(head);
  const body=node('tbody',''),now=Date.now();
  for(const book of data.books){
   const row=node('tr',''),name=node('th',book.name);name.scope='row';row.append(name);const m=book.moneyline,s=book.spread,t=book.total;
   for(const [value,at] of [[m&&signed(m.away),m?.updatedAt],[m&&signed(m.home),m?.updatedAt],[s&&signed(s.away)+' ('+signed(s.awayPrice)+')',s?.updatedAt],[s&&signed(s.home)+' ('+signed(s.homePrice)+')',s?.updatedAt],[t&&t.line+' ('+signed(t.over)+')',t?.updatedAt],[t&&t.line+' ('+signed(t.under)+')',t?.updatedAt]]){
    const fresh=Number.isFinite(at)&&at<=now+60000&&now-at<=1800000&&now<game.kickoff;
    const td=node('td',fresh?value:'Unavailable');if(fresh)td.append(node('small','Updated '+new Date(at).toLocaleTimeString('en-US',{timeZone:'America/Chicago',hour:'numeric',minute:'2-digit',timeZoneName:'short'})));row.append(td);
   }body.append(row);
  }table.append(body);board.append(table);
  const deadlines=data.books.flatMap(b=>[b.moneyline?.updatedAt,b.spread?.updatedAt,b.total?.updatedAt]).filter(Number.isFinite).map(at=>at+1800001).filter(at=>at>now);deadlines.push(game.kickoff);
  clearTimeout(timer);const next=Math.min(...deadlines.filter(at=>at>now));if(Number.isFinite(next))timer=setTimeout(()=>{if(selected===game)render(game,data);},Math.min(next-now,2147483647));
 }
 button.addEventListener('click',async()=>{
  if(!selected)return;const game=selected,task=++serial;button.disabled=true;status.textContent='Loading sportsbook comparison…';board.replaceChildren();
  try{const q=new URLSearchParams({league:game.league,away:game.a,home:game.h,kickoff:game.kickoff});const r=await fetch('/api/football/comparison?'+q,{signal:AbortSignal.timeout(20000)}),data=await r.json();
   if(task!==serial||selected!==game)return;if(!r.ok)throw Error(data.error||'Comparison unavailable.');
   if(data.league!==game.league||data.away!==game.a||data.home!==game.h||data.kickoff!==game.kickoff||!Array.isArray(data.books))throw Error('Matchup could not be verified.');
   render(game,data);status.textContent=(data.message||'Comparison checked.')+' Quotes expire after 30 minutes or at kickoff; cached up to five minutes.';
  }catch(e){if(task===serial&&selected===game)status.textContent=e.message;}
  finally{if(task===serial)button.disabled=false;}
 });
}
