
const $ = id => document.getElementById(id);
const games = $('games');
let selected = null;
let scoringContext = null;
let forecastContext = null;
let latestForecast = null;
let gameQuotes = null;
function invalidateSimulation(message) {
  latestForecast=null;
  $('game-pick-price').value='';
  $('availability-score-status').textContent='';
  $('forecast-archive-status').textContent='';
  for (const id of ['score','cover','over','win']) $(id).textContent = '—';
  if (message) $('note').textContent = message;
}
for (const id of ['spread','total','awayRating','homeRating',
  'awayOffenseLoss','awayDefenseLoss','homeOffenseLoss','homeDefenseLoss']) {
  $(id).addEventListener('input', () => invalidateSimulation('Inputs changed. Run the simulation again.'));
}
$('venueMode').addEventListener('change', () => invalidateSimulation('Game location changed. Run the simulation again.'));
$('variableHomeField').addEventListener('change',()=>invalidateSimulation('Home-field estimate setting changed. Run the simulation again.'));
$('homeContext').addEventListener('input',()=>invalidateSimulation('Matchup-context assumption changed. Run the simulation again.'));
$('homeFieldMode').addEventListener('change',()=>{
  const manual=$('homeFieldMode').value==='manual';
  $('homeContext').disabled=!manual;
  $('homeFieldReason').disabled=!manual;
  invalidateSimulation('Home advantage mode changed. Run the simulation again.');
});
$('homeFieldReason').addEventListener('input',()=>invalidateSimulation('Override reason changed. Run the simulation again.'));
const injuryFields=['awayOffenseLoss','awayDefenseLoss','homeOffenseLoss','homeDefenseLoss'];
function injuryModeChanged(){
  const automatic=$('autoInjuries').checked;
  for(const id of injuryFields){$(id).disabled=automatic;$(id).value='0';}
  $('auto-injury-status').textContent=automatic?
    'Automatic injury scoring ON. Run the simulation after live official reports load; missing or unmatched players remain unvalued.':
    'Manual injury scoring ON. Enter your own point estimates; no automatic injury points will be added.';
  invalidateSimulation('Injury scoring mode changed. Run the simulation again.');
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
  $('matchup-context-status').textContent=[division?'Division rivalry detected.':'',hour>=19?'Evening kickoff detected (broadcast slot unverified).':'','Context only: no automatic extra points. NFL standard: 2 points; college: 3, at a verified home venue.'].filter(Boolean).join(' ');
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
let slateSequence = 0;
let oddsSequence = 0;
let lineEdits = 0;
const oddsStatus = document.createElement('p');
oddsStatus.setAttribute('aria-live', 'polite');
const refreshOdds = document.createElement('button');
refreshOdds.textContent = 'Refresh FanDuel lines';
refreshOdds.type = 'button';
$('matchup').after(oddsStatus, refreshOdds);
for (const id of ['spread', 'total']) $(id).addEventListener('input', () => {
  lineEdits++;
  gameQuotes=null;
  oddsStatus.textContent = 'Manual lines — refresh FanDuel lines to replace them.';
});
async function loadFanDuel() {
  if (!selected) return;
  const game = selected;
  const task = ++oddsSequence;
  gameQuotes=null;
  const edits = lineEdits;
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
    if (!data.available) { oddsStatus.textContent = data.message; return; }
    gameQuotes={game,data};
    const messages = [];
    for (const [id, key, stamp] of [['spread', 'awaySpread', 'spreadUpdated'], ['total', 'total', 'totalUpdated']]) {
      if (Number.isFinite(data[key])) {
        $(id).value = data[key];
        const time = new Date(data[stamp]).toLocaleTimeString('en-US', {timeZone:'America/Chicago', hour:'numeric', minute:'2-digit'});
        const observed=window.Unit501LineWatch?.observe(localStorage,
          [game.league,game.season,game.id,'game',key].join(':'),data[key],Date.parse(data[stamp]));
        const movement=observed?.changed?` • since first observed ${observed.firstLine} (${observed.delta>0?'+':''}${observed.delta.toFixed(1)})`:'';
        messages.push(`${id === 'spread' ? game.a + ' spread' : 'Total'} ${data[key]} (updated ${time} CT)${movement}`);
      } else {
        $(id).value = '';
        messages.push(`${id} unavailable — enter manually`);
      }
    }
    oddsStatus.textContent = 'FanDuel • ' + messages.join(' • ') + '. Feed cached up to 5 minutes.';
    $('note').textContent = 'Review the lines and ratings, then run the simulation.';
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
weatherPanel.style.cssText =
  'margin:18px 0;padding:14px;border:1px solid #354057;border-radius:12px';
teamContext.before(weatherPanel);
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
  const venue = window.Unit501Venues?.resolve(game);
  const location = venue && [venue.latitude, venue.longitude];
  if (!location) {
    conditions.textContent =
      'Forecast unavailable: stadium location has not been reviewed for this season.';
    return;
  }

  if (Date.now() >= game.kickoff || game.kickoff - Date.now() > 15 * 86400000) {
    conditions.textContent = 'Forecast available for upcoming games within 15 days of kickoff.';
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
    if (forecastContext?.data.available) invalidateSimulation('Weather forecast expired. Refreshing weather; run the simulation again.');
    forecastContext = {game, data:{roof:exposure,available:false,kickoff:game.kickoff}};
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
      watch.source?.replaceChildren();
      conditions.textContent = data.message || 'Forecast unavailable.';
      return;
    }

    forecastContext = {game,data:{...data,roof:exposure,kickoff:game.kickoff}};
    if (!previous || ['windMph','forecastTime','temperatureF','gustMph','precipitationChance'].some(key => previous[key] !== data[key]) || JSON.stringify(previous.gameHours) !== JSON.stringify(data.gameHours)) {
      invalidateSimulation('Weather forecast updated. Run the simulation to use it.');
    }

    const format = (value, unit) =>
      Number.isFinite(value) ? `${Math.round(value)}${unit}` : 'Unavailable';

    const timeOptions = {
      timeZone: 'America/Chicago',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    };

    const forecastTime = new Date(data.forecastTime)
      .toLocaleString('en-US', timeOptions);
    const fetchedTime = new Date(data.fetchedAt)
      .toLocaleString('en-US', timeOptions);

    conditions.textContent =
      `Forecast near kickoff (${forecastTime} CT): ` +
      `${format(data.temperatureF, '°F')} • ` +
      `Wind: ${format(data.windMph, ' mph')} • ` +
      `Gusts: ${format(data.gustMph, ' mph')} • ` +
      `Precipitation chance: ${format(data.precipitationChance, '%')}`;

    const hours = Array.isArray(data.gameHours) ? data.gameHours : [];
    if (hours.length) conditions.textContent += ' • Hourly outlook (kickoff through +3 hours): ' + hours.map(hour =>
      `${new Date(hour.forecastTime).toLocaleTimeString('en-US',{timeZone:'America/Chicago',hour:'numeric',minute:'2-digit'})} CT: ${format(hour.temperatureF,'°F')}, wind ${format(hour.windMph,' mph')}, gusts ${format(hour.gustMph,' mph')}, precipitation ${format(hour.precipitationChance,'%')}`
    ).join(' | ');
    else conditions.textContent += ' • Later game-hour forecasts unavailable.';

    const source = watch.source || document.createElement('p');
    source.replaceChildren();
    source.style.cssText = 'font-size:.85em;opacity:.8';

    const link = document.createElement('a');
    link.href = 'https://open-meteo.com/';
    link.textContent = 'Weather data by Open-Meteo';
    link.style.color = '#83e2ba';

    source.append(
      link,
      ` • Retrieved ${fetchedTime} CT. Cached up to 15 minutes. ` +
      'Outdoor forecast near the stadium; actual field conditions may differ. ' +
      (exposure === 'outdoor' ? 'The experimental wind setting uses kickoff sustained wind for team scores only. Later hours, rain chance, gusts and temperature are context; player props are unchanged.' : 'Roof or field exposure is unverified; all forecast values are context only.')
    );
    if (!watch.source) conditions.after(source);
    watch.source = source;
  } catch {
    if (selected === game && conditions.isConnected) {
      conditions.textContent =
        'Weather could not be loaded. Automatic retry while this tab is visible.';
    }
  } finally {
    watch.pending = false;
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

  const conditions = document.createElement('p');
  conditions.id = 'game-weather-status';
  conditions.textContent = 'Weather forecast not connected yet.';

  const roof = document.createElement('p');
  roof.id = 'game-roof-status';
  const stadium = window.Unit501Venues?.resolve(selected);
  const isIndoor = stadium?.roof === 'indoor';
  roof.textContent = isIndoor ? 'Fixed dome — indoor playing conditions.' : 'Roof type and game-day roof status not verified.';
  if (isIndoor) {
    forecastContext = {game:selected,data:{roof:'indoor'}};
    conditions.textContent = 'Outside wind and precipitation do not directly affect play inside this enclosed stadium.';
  }

  weatherPanel.append(heading, venue, conditions, roof);
  if (!isIndoor) {
  loadVenueForecast(selected, conditions, roof);
}
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
function showTeamContext(data, game) {
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
        const row = document.createElement('div');
        row.style.cssText = 'padding:10px 0;border-top:1px solid #293142';
        const title = document.createElement('div');
        title.textContent = label;
        const value = document.createElement('strong');
        value.textContent = metric.average === null ? 'Unavailable' :
          `${metric.average.toFixed(1)} ${key.startsWith('points') ? 'pts' : 'yds'}/game`;
        const rank = document.createElement('span');
        const coverage = data.coverage?.[key];
        rank.textContent = metric.rank === null
          ? (data.scope.includes('FBS rankings') && !team.fbsName ? ' • Outside FBS ranking pool'
            : coverage ? ` • Rank unavailable (${coverage.complete}/${coverage.expected} teams complete)` : ' • Rank unavailable')
          : ` • #${metric.rank} of ${metric.pool}${team.fbsName ? ' FBS' : ''}`;
        if (metric.rank !== null) rank.style.color = metric.rank <= Math.ceil(metric.pool / 4) ? '#83e2ba' : metric.rank > Math.floor(metric.pool * .75) ? '#ffc184' : '#c5cede';
        row.append(title,value,rank);
        if (metric.games !== team.games) {
          const coverage = document.createElement('div');
          coverage.style.cssText = 'font-size:.85em;color:#ffc184';
          coverage.textContent = `${metric.games}/${team.games} games have this stat • incomplete average`;
          row.append(coverage);
        }
        column.append(row);
      }
    }
    grid.append(column);
  }
  const note = document.createElement('p');
  note.style.cssText = 'font-size:.85em;color:#aeb9c9';
  note.textContent = data.explanation + ' Passing uses team box-score totals. Scoring allowed includes all opponent points, including defense/special teams. Rankings show raw averages. Game predictions combine offense and opposing defense deviations from one league scoring average, with small-sample smoothing. Schedule strength adjusts predicted scores only when both teams have complete opponent scoring coverage; otherwise the baseline is retained. Rushing and passing ranks are context only. Player projections use their separate model.';
  teamContext.append(grid,note);
  for(const [id,name]of [[game.awayId,game.a],[game.homeId,game.h]]){
    const team=data.teams.find(t=>t.id===id),pace=team?.pace;
    if(pace?.games||pace?.playGames){const line=document.createElement('p');line.textContent=`${name} pace: ${pace.games?(pace.drives/pace.games).toFixed(1)+' recorded drives/game ('+pace.games+'/'+team.games+' games)':'drive counts unavailable'}; ${pace.playGames?(pace.plays/pace.playGames).toFixed(1)+' plays/game ('+pace.playGames+'/'+team.games+' games)':'play counts unavailable'}. Recorded drives are a possession proxy, including end-of-half drives and overtime when present.`;teamContext.append(line);}
  }
  if(data.paceValidation){const check=data.paceValidation,line=document.createElement('p');line.textContent=`Pace model check: ${check.evaluatedGames} later games.${Number.isInteger(check.warmupGames)?` ${check.warmupGames} warm-up predictions; ${check.skipped} games lacked eligible scoring or complete drive coverage.`:''} ${check.evaluatedGames?`Score error ${check.scoreError.toFixed(1)} vs current ${check.baselineScoreError.toFixed(1)}; total error ${check.totalError.toFixed(1)} vs current ${check.baselineTotalError.toFixed(1)}. `:''}${check.accepted?'Drive-based scoring enabled.':'Current scoring retained; the pace candidate has not passed both improvement gates.'} ${check.explanation}`;teamContext.append(line);}
  const validation=data.validation;
  if(validation) {
    const details=document.createElement('details');
    const summary=document.createElement('summary');summary.textContent='Historical model check';
    const description=document.createElement('p');
    description.textContent=validation.games
      ? `${validation.games} replayed games; average score error ${validation.scoreMAE.toFixed(1)} points per team, margin error ${validation.marginMAE.toFixed(1)}, total error ${validation.totalMAE.toFixed(1)}. Total bias ${validation.totalBias>=0?'+':''}${validation.totalBias.toFixed(1)} (positive means projected too high).`
      : 'Not enough earlier complete scoring history for a model check yet.';
    const explanation=document.createElement('p');explanation.textContent=validation.explanation;
    details.append(summary,description,explanation);
    if(validation.scoreAudit)details.append(Unit501ScoreAuditUI.render(validation.scoreAudit,'Replay scoring audit'));
    if(validation.legacy){
      const comparison=document.createElement('p');
      comparison.textContent=`Previous formula on the same games: score error ${validation.legacy.scoreMAE.toFixed(1)}, margin error ${validation.legacy.marginMAE.toFixed(1)}, total error ${validation.legacy.totalMAE.toFixed(1)}. Lower is better; the new formula is not assumed to win this comparison.`;
      details.append(comparison);
    }
    if(validation.laterComparison) {
      const check=validation.laterComparison;
      const comparison=document.createElement('p');
      comparison.textContent=check.games && check.current && check.previous
        ? `Later-game formula comparison: ${check.games} games after ${check.warmupGames} warm-up predictions. Current vs previous: score error ${check.current.scoreMAE.toFixed(1)} vs ${check.previous.scoreMAE.toFixed(1)}, margin error ${check.current.marginMAE.toFixed(1)} vs ${check.previous.marginMAE.toFixed(1)}, total error ${check.current.totalMAE.toFixed(1)} vs ${check.previous.totalMAE.toFixed(1)}. Lower is better.${check.sufficient ? '' : ' Fewer than 30 later games; evidence remains limited.'}`
        : 'Later-game formula comparison awaits enough eligible predictions beyond warm-up.';
      details.append(comparison);
      const caveat=document.createElement('p');caveat.textContent=check.explanation;details.append(caveat);
    }
    if(validation.offenseDiagnostics){
      const diagnostics=validation.offenseDiagnostics;
      for(const [key,label]of [['belowAverage','Below-average scoring offenses'],['atOrAboveAverage','At-or-above-average scoring offenses']]){
        const row=diagnostics.overall[key],later=diagnostics.later[key];
        if(!row?.teamGames)continue;
        const line=document.createElement('p');
        line.textContent=`${label}: ${row.teamGames} team-games. Current vs previous score error ${row.scoreMAE.toFixed(1)} vs ${row.legacyScoreMAE.toFixed(1)} points; scoring bias ${row.bias>=0?'+':''}${row.bias.toFixed(1)} vs ${row.legacyBias>=0?'+':''}${row.legacyBias.toFixed(1)}. Later comparison: ${later.teamGames} team-games across ${later.games} matchups.${later.games<30?' Limited later evidence.':''}`;
        details.append(line);
      }
      const note=document.createElement('p');note.textContent=diagnostics.explanation;details.append(note);
    }
    if(validation.probabilityGames) {
      const label=document.createElement('p');label.textContent=`Away-win reliability: ${validation.probabilityGames} later games, Brier score ${validation.brier.toFixed(3)} (lower is better). Small bins remain uncertain.`;details.append(label);
      const table=document.createElement('table');table.style.width='100%';
      const header=document.createElement('tr');for(const title of ['Model band','Games','Mean model','Actual away wins']){const cell=document.createElement('th');cell.textContent=title;header.append(cell);}table.append(header);
      for(const bin of validation.bins.filter(b=>b.games)) {
        const tr=document.createElement('tr');
        for(const text of [`${Math.round(bin.lower*100)}–${Math.round(bin.upper*100)}%`,bin.games,`${(bin.predicted*100).toFixed(1)}%`,`${(bin.observed*100).toFixed(1)}%`]){const cell=document.createElement('td');cell.textContent=text;tr.append(cell);}table.append(tr);
      }details.append(table);
    }
    if(validation.probabilityChecks){
      for(const [market,check]of Object.entries(validation.probabilityChecks)){
        const label=document.createElement('p');label.textContent=check.games?`${market} calibration: ${check.games} later games (${check.thresholds} evaluated thresholds); Brier ${check.brier.toFixed(3)} vs raw ${check.rawBrier.toFixed(3)}. Lower is better; reference spread/total thresholds are not historical sportsbook lines.`:`${market}: not enough earlier training and later evaluation for calibration yet.`;details.append(label);
        const table=document.createElement('table');const header=document.createElement('tr');for(const title of ['Calibrated band','Distinct games / checks','Mean probability','Observed']){const cell=document.createElement('th');cell.textContent=title;header.append(cell);}table.append(header);
        for(const bin of check.bins.filter(b=>b.thresholds)){const row=document.createElement('tr');for(const value of [`${Math.round(bin.lower*100)}–${Math.round(bin.upper*100)}%`,`${bin.games} / ${bin.thresholds}`,`${(bin.predicted*100).toFixed(1)}%`,`${(bin.observed*100).toFixed(1)}%`]){const cell=document.createElement('td');cell.textContent=value;row.append(cell);}table.append(row);}details.append(table);
      }
    }
    teamContext.append(details);
  }
}
function loadTeamContext(game) {
  clearTimeout(contextTimer);
  const task = ++contextSequence;
  const params = new URLSearchParams({league:$('league').value, season:$('date').value.slice(0,4),
    before:game.kickoff,away:game.awayId,home:game.homeId});
  let polls = 0;
  let lastProgress = '', lastChanged = Date.now();
  contextMessage('Loading season stats… The first load gathers completed game box scores and may take a few minutes.');
  async function poll() {
    try {
      const response = await fetch('/api/rankings?' + params, {signal:AbortSignal.timeout(20000)});
      const result = await response.json();
      if (task !== contextSequence || selected !== game) return;
      if (result.state === 'error' && result.data) {
        showTeamContext(result.data, game);
        const warning = document.createElement('p');
        warning.setAttribute('role', 'status');
        warning.textContent = 'Rankings could not finish: ' + result.message + ' Select the game again in a minute to retry.';
        teamContext.append(warning);
        return;
      }
      if (!response.ok || result.error || result.state === 'error') throw new Error(result.error || result.message || 'Stats unavailable.');
      if (result.state === 'ready') { showTeamContext(result.data, game); return; }
      if (++polls >= 1200) throw new Error('Still gathering season stats. Select the game again shortly to check progress.');
      const progress = result.total ? `Building rankings: ${result.completed} of ${result.total} completed games checked. Saved results make later loads faster.` : result.message || 'Finding completed season games…';
      if(progress!==lastProgress){lastProgress=progress;lastChanged=Date.now();}
      const stalled=Date.now()-lastChanged>120000;
      if (result.data) {
        showTeamContext(result.data, game);
        const status = document.createElement('p');
        status.setAttribute('role', 'status');
        status.textContent = progress + (result.data.coverage.pointsFor.ranked && result.data.coverage.pointsAgainst.ranked ? ' Scoring is ready: you can run the simulation while yardage rankings finish.' : '') + (stalled ? ' No progress for two minutes. Check provider quota or reselect this game to retry.' : '');
        teamContext.append(status);
      } else contextMessage(progress + (stalled ? ' No progress for two minutes. Check provider quota or reselect this game to retry.' : ''));
      contextTimer = setTimeout(poll,3000);
    } catch (error) {
      if (task === contextSequence && selected === game) {
        if(scoringContext?.game===game) {
          showTeamContext(scoringContext.data,game);
          const warning=document.createElement('p');warning.textContent='Rankings refresh stopped: '+error.message+' Reselect the game to retry.';teamContext.append(warning);
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
  selected = null;
  $('lab').classList.add('hidden');
  $('player-lab').classList.add('hidden');
  document.dispatchEvent(new Event('unit501:selection-changed'));
}

const today = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Chicago',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
}).format(new Date());

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

    const slate = data.response.map(parseGame);

    if (!slate.length) {
      $('status').textContent = 'NO GAMES RETURNED';
      showMessage(
        'No games were returned for this date. This could mean there are no games scheduled, or your data plan does not include this season.'
      );
      return;
    }

    $('status').textContent = 'GAME DATA RECEIVED';
    games.innerHTML = '';

    slate.forEach(game => {
      const card = document.createElement('div');
      card.className = 'card game';

      const matchup = document.createElement('b');
      matchup.textContent = `${game.a} @ ${game.h}`;

      const details = document.createElement('p');
      const hasScore =
        game.awayScore != null && game.homeScore != null;

      details.textContent =
        `${game.time} | ${game.status}` +
        (hasScore
          ? ` | ${game.a} ${game.awayScore} - ${game.h} ${game.homeScore}`
          : '');

      card.append(matchup, details);
      card.onclick = () => choose(game);
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
  selected = game;
  document.dispatchEvent(new Event('unit501:selection-changed'));
  $('lab').classList.remove('hidden');
  $('player-lab').classList.remove('hidden');
  $('matchup').textContent = `${game.a} @ ${game.h}`;

  // Do not invent a betting line when current odds are unavailable.
  $('spread').value = '';
  $('total').value = '';
  $('awayRating').value = 0;
  $('homeRating').value = 0;
  for (const id of ['awayOffenseLoss','awayDefenseLoss','homeOffenseLoss','homeDefenseLoss']) $(id).value = 0;
  $('venueMode').value = 'auto';
  $('variableHomeField').checked=false;
  $('homeContext').value=game.league==='1'?2:3;
  $('homeFieldMode').value='auto';
  $('homeContext').disabled=true;
  $('homeFieldReason').disabled=true;
  $('homeFieldReason').value='';
  describeMatchup(game);
  homeFieldProfiles=null;
  loadHomeField(game);

  $('score').textContent = '—';
  $('cover').textContent = '—';
  $('over').textContent = '—';
  $('win').textContent = '—';

  $('note').textContent =
    'Enter the current FanDuel spread and total to run a simulation.';

  $('lab').scrollIntoView({ behavior: 'smooth' });
  loadFanDuel();
  loadTeamContext(game);
}

function sim() {
  if (!selected) return;
  invalidateSimulation();
  if (['spread','total','awayRating','homeRating','awayOffenseLoss','awayDefenseLoss','homeOffenseLoss','homeDefenseLoss'].some(id => $(id).value === '')) {
    $('note').textContent = 'Enter spread, total, point adjustments and injury scenarios (0 is fine).';
    return;
  }
  const spread = Number($('spread').value);
  const total = Number($('total').value);
  if (![spread,total].every(Number.isFinite) || total <= 0) {
    $('note').textContent = 'Check the spread and total.';
    return;
  }
  const data = scoringContext?.game === selected ? scoringContext.data : null;
  const forecastAt=Date.now();
  const lineup=window.Unit501Lineups?.evaluate();
  const automatic=$('autoInjuries').checked&&window.Unit501AutoInjury?
    window.Unit501AutoInjury.evaluate(window.Unit501Availability?.snapshot(),selected,lineup,forecastAt):null;
  if(automatic){
    for(const [id,key] of [['awayOffenseLoss','awayOffense'],['awayDefenseLoss','awayDefense'],
      ['homeOffenseLoss','homeOffense'],['homeDefenseLoss','homeDefense']])$(id).value=String(automatic.injury[key]);
    const who=automatic.applied.map(p=>`${p.side==='away'?selected.a:selected.h}: ${p.name} (${p.position}) ${p.category==='offense'?'offense reduction':'defense loss'} +${p.points.toFixed(2)} points`);
    $('auto-injury-status').textContent=automatic.message+
      (who.length?' Applied: '+who.join(' · ')+'.':' No supported automatic points were applied.')+
      (automatic.withheld.length?' Unvalued: '+automatic.withheld.join(' · '):'');
  }
  const options = {now:forecastAt,
    away:Number($('awayRating').value),home:Number($('homeRating').value),venueMode:$('venueMode').value,
    variableHomeField:$('variableHomeField').checked,homeFieldProfile:homeFieldProfiles,homeFieldTotal:$('homeFieldMode').value==='manual'?Number($('homeContext').value):null,homeFieldReason:$('homeFieldReason').value,
    forecast:forecastContext?.game === selected ? forecastContext.data : null,
    injury:automatic?{...automatic.injury}:{
      awayOffense:Number($('awayOffenseLoss').value),awayDefense:Number($('awayDefenseLoss').value),
      homeOffense:Number($('homeOffenseLoss').value),homeDefense:Number($('homeDefenseLoss').value)},
    automaticInjury:automatic?{applied:automatic.applied,withheld:automatic.withheld,message:automatic.message}:null,
    lineup,
    weatherEnabled:$('weatherEnabled').checked
  };
  const prediction = Unit501TeamModel.project(data, selected, options);
  if (!prediction.available) {
    $('note').textContent = prediction.reason;
    return;
  }
  const result = Unit501TeamModel.simulate(prediction,spread,total);
  const percent = value => (value*100).toFixed(1) + '%';
  const calibratedMarkets=Object.entries({win:'away win',cover:'away cover',over:'over'}).filter(([key])=>result.calibrated[key]!==null).map(([,name])=>name);
  $('score').textContent = `${Math.round(prediction.away)}–${Math.round(prediction.home)}`;
  $('cover').textContent = percent(result.calibrated.cover??result.cover);
  $('over').textContent = percent(result.calibrated.over??result.over);
  $('win').textContent = percent(result.calibrated.win??result.win);
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
    `Automatic experimental injury scenario: away offense ${prediction.injury.awayOffense.toFixed(2)}, away defense ${prediction.injury.awayDefense.toFixed(2)}, home offense ${prediction.injury.homeOffense.toFixed(2)}, home defense ${prediction.injury.homeDefense.toFixed(2)} points. ${automatic.applied.length} matched top-depth Out player(s), ${automatic.withheld.length} review item(s). These assumed weights are not validated and may overlap the baseline; manual boxes were not added. See injury scoring section for names and withheld cases.`:
    prediction.injury.applied
    ? `User injury scenario: away offense loss ${prediction.injury.awayOffense.toFixed(1)}, away defense loss ${prediction.injury.awayDefense.toFixed(1)}, home offense loss ${prediction.injury.homeOffense.toFixed(1)}, home defense loss ${prediction.injury.homeDefense.toFixed(1)} points. Scores ${prediction.preInjuryAway.toFixed(1)}–${prediction.preInjuryHome.toFixed(1)} → ${prediction.preVenueAway.toFixed(1)}–${prediction.preVenueHome.toFixed(1)} before home field and weather. User estimates in addition to any replacement scenario.`
    : 'No injury scenario entered; this does not confirm either team is healthy. Confirmed replacement scenarios can change scores after the player-ratings build; missing role or replacement data is withheld.';
  const weatherNote = prediction.weather.reason + (prediction.weather.applied
    ? ` Before wind ${prediction.preWeatherAway.toFixed(1)}–${prediction.preWeatherHome.toFixed(1)} → after wind ${prediction.away.toFixed(1)}–${prediction.home.toFixed(1)}.` : '');
  const paceNote=prediction.pace?.reason||'Drive reports unavailable; current scoring retained.';
  $('note').textContent = `Score order: ${selected.a}–${selected.h}. Based on ${prediction.awayGames}/${prediction.homeGames} completed games, with early-season smoothing. ${calibratedMarkets.length?'Calibration applied to '+calibratedMarkets.join(', ')+'. Those percentages exclude pushes/tied scores; other markets remain raw frequencies.':'Raw model frequencies; calibration unavailable for this sample or adjusted scenario.'} Variance: ${result.varianceSource}. Raw win/cover/over frequencies: ${percent(result.win)} / ${percent(result.cover)} / ${percent(result.over)}. Lineup scenario score changes: ${prediction.lineup.awayChange.toFixed(1)} / ${prediction.lineup.homeChange.toFixed(1)} points. Injury point assumptions add to confirmed lineup scenarios, but known duplicate player losses are skipped automatically. See Historical model check for held-out errors. These are not validated betting probabilities. ${scheduleNote} ${prediction.venue.reason} Home-margin change before weather: +${prediction.venue.appliedMargin.toFixed(1)} points. ${weatherNote} ${injuryNote} ${availabilityNote} Spread pushes: ${percent(result.spreadPush)}; total pushes: ${percent(result.totalPush)}; tied scores: ${percent(result.tie)} (overtime not modeled).`;
  $('note').textContent+=' '+paceNote;
  if(window.Unit501ForecastArchive){
    if(automatic&&!automatic.ready){
      latestForecast=null;
      $('forecast-archive-status').textContent='Forecast not archived: automatic injury feeds or depth coverage are incomplete. Rerun after both teams have current reports; missing coverage must not become the frozen first forecast.';
    }else try{
      const snapshot=Unit501ForecastArchive.capture({game:selected,data,options,marketContext:{awaySpread:spread,total,quotes:gameQuotes?.game===selected?gameQuotes.data:null},availability:window.Unit501Availability?.snapshot(),lineupInputs:window.Unit501Lineups?.snapshot()},forecastAt);
      latestForecast=snapshot;
      fillGamePickPrice();
      $('forecast-archive-status').textContent=Unit501ForecastArchive.save(localStorage,snapshot).message;
    }catch{ $('forecast-archive-status').textContent='Forecast archive could not be saved on this browser. This prediction is not archived.'; }
  }
}

function fillGamePickPrice(){
  const [market,direction]=$('game-pick-direction').value.split(':');
  const q=latestForecast?.inputs.marketContext?.quotes;
  const updated=Date.parse(q?.[market==='spread'?'spreadUpdated':'totalUpdated']);
  const value=q?.prices?.[direction];
  $('game-pick-price').value=Number.isInteger(value)&&Number.isFinite(updated)&&Date.now()-updated<=1800000&&updated<=Date.now()+60000?String(value):'';
}
$('game-pick-direction').addEventListener('change',fillGamePickPrice);
$('save-game-pick').onclick=()=>{
  const choice=$('game-pick-direction').value;
  const [market,direction]=choice.split(':');
  const line=latestForecast?.inputs.marketContext?.[market==='spread'?'awaySpread':'total'];
  const raw=$('game-pick-price').value.trim();
  $('forecast-archive-status').textContent=Unit501ForecastArchive.select(localStorage,latestForecast,{market,direction,line,price:raw===''?null:Number(raw)}).message;
};

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
    for(const id of injuryFields)$(id).value='0';
    $('auto-injury-status').textContent='Roster or official injury evidence updated. Run the simulation for freshly evaluated automatic adjustments.';
    invalidateSimulation('Injury evidence updated. Run the simulation again.');
  }else if($('availability-score-status').textContent){
    $('availability-score-status').textContent='Availability reports changed or freshness was rechecked. Run the simulation again to review score coverage.';
  }
});

$('download-forecast-archive').onclick=()=>{
  try{
    const archive=Unit501ForecastArchive.read(localStorage);
    if(!archive.snapshots.length){$('forecast-archive-status').textContent='No pregame forecasts have been saved on this browser yet.';return;}
    const url=URL.createObjectURL(new Blob([JSON.stringify(archive,null,2)],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download='unit501-forecasts.json';link.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
    $('forecast-archive-status').textContent='Archive download requested. Open Saved forecast accuracy to review matched results; pending forecasts wait for confirmed finals.';
  }catch{$('forecast-archive-status').textContent='Saved archive could not be downloaded. Existing data retained.';}
};

let forecastRefreshAt=0;
async function refreshForecastResults(){
 const button=$('refresh-forecast-results');if(button.disabled)return;button.disabled=true;forecastRefreshAt=Date.now();
 $('forecast-archive-status').textContent='Checking saved forecasts against confirmed final games…';
 try{
  const result=await Unit501ForecastResults.refresh(localStorage,async url=>{
   const response=await fetch(url,{signal:AbortSignal.timeout(15000)});const data=await response.json();
   if(!response.ok||data.error)throw Error('Result request failed');return data;
  });
  $('forecast-archive-status').textContent=`${result.matched} score/prop outcomes matched to confirmed finals. ${result.failed} archive requests failed. Missing player stats remain unknown; open Saved forecast accuracy to compare errors.`;
 }catch{$('forecast-archive-status').textContent='Final results could not be saved. Existing archive retained.';}
 finally{button.disabled=false;}
};

$('refresh-forecast-results').onclick=refreshForecastResults;
function autoRefreshForecastResults(){
 if(document.hidden)return;
 try{if(Unit501ForecastResults.autoRefreshDue(Unit501ForecastArchive.read(localStorage),forecastRefreshAt))refreshForecastResults();}catch{}
}
// Browser-local archives can only be checked while this app is open.
setTimeout(autoRefreshForecastResults,0);
setTimeout(function checkForecastResults(){autoRefreshForecastResults();setTimeout(checkForecastResults,300000);},300000);
document.addEventListener('visibilitychange',autoRefreshForecastResults);
document.addEventListener('unit501:archive-updated',autoRefreshForecastResults);

$('forecast-review').addEventListener('toggle',()=>{
 if($('forecast-review').open&&Date.now()-forecastRefreshAt>=300000){
  try{if(Unit501ForecastArchive.read(localStorage).snapshots.some(s=>s.game.kickoff<Date.now()))refreshForecastResults();}catch{}
 }
});
$('import-forecast-archive').addEventListener('change',async()=>{
 const input=$('import-forecast-archive'),file=input.files?.[0];if(!file)return;
 try{
  if(file.size>20*1024*1024)throw Error('Choose an archive smaller than 20 MB.');
  const result=Unit501ForecastArchive.importArchive(localStorage,await file.text());
  $('forecast-archive-status').textContent=`${result.imported} forecasts restored. ${result.skipped} existing targets kept without replacement. Imported timestamps and reports still need review.`;
  forecastRefreshAt=0;
 }catch(e){$('forecast-archive-status').textContent='Archive import failed; existing forecasts retained. '+(e instanceof SyntaxError?'Choose a valid JSON archive.':e.message);}
 finally{input.value='';}
});

$('maintenance-panel').addEventListener('toggle',async()=>{
  if(!$('maintenance-panel').open)return;
  try{
    const response=await fetch('/api/roster-maintenance');
    if(!response.ok)throw Error();
    const report=await response.json();
    $('maintenance-status').textContent=report.message+' '+(report.lastCompleted?'Last completed: '+new Date(report.lastCompleted).toLocaleString()+'. ':'')+report.gamesChecked+' games checked. Runs every six hours while the server is running; status resets on restart.';
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
