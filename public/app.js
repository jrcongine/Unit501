
const $ = id => document.getElementById(id);
const games = $('games');
let selected = null;
let scoringContext = null;
let forecastContext = null;
function invalidateSimulation(message) {
  for (const id of ['score','cover','over','win']) $(id).textContent = '—';
  if (message) $('note').textContent = message;
}
for (const id of ['spread','total','awayRating','homeRating',
  'awayOffenseLoss','awayDefenseLoss','homeOffenseLoss','homeDefenseLoss']) {
  $(id).addEventListener('input', () => invalidateSimulation('Inputs changed. Run the simulation again.'));
}
$('venueMode').addEventListener('change', () => invalidateSimulation('Game location changed. Run the simulation again.'));
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
  oddsStatus.textContent = 'Manual lines — refresh FanDuel lines to replace them.';
});
async function loadFanDuel() {
  if (!selected) return;
  const game = selected;
  const task = ++oddsSequence;
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
    const messages = [];
    for (const [id, key, stamp] of [['spread', 'awaySpread', 'spreadUpdated'], ['total', 'total', 'totalUpdated']]) {
      if (Number.isFinite(data[key])) {
        $(id).value = data[key];
        const time = new Date(data[stamp]).toLocaleTimeString('en-US', {timeZone:'America/Chicago', hour:'numeric', minute:'2-digit'});
        messages.push(`${id === 'spread' ? game.a + ' spread' : 'Total'} ${data[key]} (updated ${time} CT)`);
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
async function loadVenueForecast(game, conditions, roof) {
  const key = String(game.venueName || '')
    .toLowerCase().replace(/[^a-z0-9]/g, '');

const locations = {
  soldierfield: [41.8625, -87.6167],
  lambeaufield: [44.5014, -88.0622],

  arrowheadstadium: [39.0488, -94.4846],
  gehafieldatarrowheadstadium: [39.0488, -94.4846],

  gillettestadium: [42.0909, -71.2647],
  metlifestadium: [40.8135, -74.0750],
  lincolnfinancialfield: [39.9009, -75.1681],

  hardrockstadium: [25.9578, -80.2393],
  levisstadium: [37.4033, -121.9698],
  lumenfield: [47.5951, -122.3319]
};
  const location = locations[key];

  if (!location) {
    conditions.textContent =
      'Forecast unavailable: this stadium location has not been added yet.';
    return;
  }

  roof.textContent = 'Open-air stadium.';
  forecastContext = {game, data:{roof:'outdoor',available:false,kickoff:game.kickoff}};
  conditions.textContent = 'Loading forecast near kickoff…';

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
      conditions.textContent = data.message || 'Forecast unavailable.';
      return;
    }

    forecastContext = {game,data:{...data,roof:'outdoor',kickoff:game.kickoff}};
    invalidateSimulation('Weather forecast loaded. Run the simulation to use it.');

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

    const source = document.createElement('p');
    source.style.cssText = 'font-size:.85em;opacity:.8';

    const link = document.createElement('a');
    link.href = 'https://open-meteo.com/';
    link.textContent = 'Weather data by Open-Meteo';
    link.style.color = '#83e2ba';

    source.append(
      link,
      ` • Retrieved ${fetchedTime} CT. Cached up to 15 minutes. ` +
      'Outdoor forecast near the stadium; actual field conditions may differ. ' +
      'The experimental wind setting affects team scores only; rain chance, gusts and temperature are context.'
    );
    conditions.after(source);
  } catch {
    if (selected === game && conditions.isConnected) {
      conditions.textContent =
        'Weather could not be loaded. Select the matchup again to retry.';
    }
  }
}
document.addEventListener('unit501:selection-changed', () => {
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
  const venueKey = String(selected.venueName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const isIndoor = ['caesarssuperdome','mercedesbenzsuperdome','louisianasuperdome',
    'fordfield','usbankstadium','allegiantstadium'].includes(venueKey);
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
  if(data.paceValidation){const check=data.paceValidation,line=document.createElement('p');line.textContent=`Pace model check: ${check.evaluatedGames} later games. ${check.evaluatedGames?`Score error ${check.scoreError.toFixed(1)} vs current ${check.baselineScoreError.toFixed(1)}; total error ${check.totalError.toFixed(1)} vs current ${check.baselineTotalError.toFixed(1)}. `:''}${check.accepted?'Drive-based scoring enabled.':'Current scoring retained; the pace candidate has not passed both improvement gates.'} ${check.explanation}`;teamContext.append(line);}
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
    if(validation.legacy){
      const comparison=document.createElement('p');
      comparison.textContent=`Previous formula on the same games: score error ${validation.legacy.scoreMAE.toFixed(1)}, margin error ${validation.legacy.marginMAE.toFixed(1)}, total error ${validation.legacy.totalMAE.toFixed(1)}. Lower is better; the new formula is not assumed to win this comparison.`;
      details.append(comparison);
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
  const prediction = Unit501TeamModel.project(data, selected, {
    away:Number($('awayRating').value),home:Number($('homeRating').value),venueMode:$('venueMode').value,
    forecast:forecastContext?.game === selected ? forecastContext.data : null,
    injury:{awayOffense:Number($('awayOffenseLoss').value),awayDefense:Number($('awayDefenseLoss').value),
      homeOffense:Number($('homeOffenseLoss').value),homeDefense:Number($('homeDefenseLoss').value)},
    lineup:window.Unit501Lineups?.evaluate(),
    weatherEnabled:$('weatherEnabled').checked
  });
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
  const injuryNote = prediction.injury.applied
    ? `User injury scenario: away offense loss ${prediction.injury.awayOffense.toFixed(1)}, away defense loss ${prediction.injury.awayDefense.toFixed(1)}, home offense loss ${prediction.injury.homeOffense.toFixed(1)}, home defense loss ${prediction.injury.homeDefense.toFixed(1)} points. Scores ${prediction.preInjuryAway.toFixed(1)}–${prediction.preInjuryHome.toFixed(1)} → ${prediction.preVenueAway.toFixed(1)}–${prediction.preVenueHome.toFixed(1)} before home field and weather. User estimates in addition to any replacement scenario.`
    : 'No injury scenario entered; this does not confirm either team is healthy. Confirmed replacement scenarios can change scores after the player-ratings build; missing role or replacement data is withheld.';
  const weatherNote = prediction.weather.reason + (prediction.weather.applied
    ? ` Before wind ${prediction.preWeatherAway.toFixed(1)}–${prediction.preWeatherHome.toFixed(1)} → after wind ${prediction.away.toFixed(1)}–${prediction.home.toFixed(1)}.` : '');
  const paceNote=prediction.pace?.reason||'Drive reports unavailable; current scoring retained.';
  $('note').textContent = `Score order: ${selected.a}–${selected.h}. Based on ${prediction.awayGames}/${prediction.homeGames} completed games, with early-season smoothing. ${calibratedMarkets.length?'Calibration applied to '+calibratedMarkets.join(', ')+'. Those percentages exclude pushes/tied scores; other markets remain raw frequencies.':'Raw model frequencies; calibration unavailable for this sample or adjusted scenario.'} Variance: ${result.varianceSource}. Raw win/cover/over frequencies: ${percent(result.win)} / ${percent(result.cover)} / ${percent(result.over)}. Lineup scenario score changes: ${prediction.lineup.awayChange.toFixed(1)} / ${prediction.lineup.homeChange.toFixed(1)} points. Manual injury points are additional: avoid entering the same loss twice. See Historical model check for held-out errors. These are not validated betting probabilities. ${scheduleNote} ${prediction.venue.reason} Home-margin change before weather: +${prediction.venue.appliedMargin.toFixed(1)} points. ${weatherNote} ${injuryNote} Spread pushes: ${percent(result.spreadPush)}; total pushes: ${percent(result.totalPush)}; tied scores: ${percent(result.tie)} (overtime not modeled).`;
  $('note').textContent+=' '+paceNote;
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
