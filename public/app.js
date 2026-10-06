
const $ = id => document.getElementById(id);
const games = $('games');
let selected = null;
let scoringContext = null;
function invalidateSimulation(message) {
  for (const id of ['score','cover','over','win']) $(id).textContent = '—';
  if (message) $('note').textContent = message;
}
for (const id of ['spread','total','awayRating','homeRating']) {
  $(id).addEventListener('input', () => invalidateSimulation('Inputs changed. Run the simulation again.'));
}
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
    const response = await fetch('/api/fanduel?' + params);
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
      'Weather does not yet change projections.'
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
  const venueKey = String(selected.venueName || '')   .toLowerCase().replace(/[^a-z0-9]/g, '');  const isIndoor = [   'caesarssuperdome',   'mercedesbenzsuperdome',   'louisianasuperdome', 'fordfield', 'usbankstadium', 'allegiantstadium' ].includes(venueKey);  roof.textContent = isIndoor   ? 'Fixed dome — indoor playing conditions.'   : 'Roof type and game-day roof status not verified.';  if (isIndoor) {   conditions.textContent =     'Outside wind and precipitation do not directly affect play inside this enclosed stadium.'; }

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
  const nextSignature = JSON.stringify([data.before, data.coverage?.pointsFor, data.coverage?.pointsAgainst,
    data.teams.map(t => [t.id,t.games,t.metrics.pointsFor,t.metrics.pointsAgainst,t.opponents])]);
  if (scoringContext?.signature !== nextSignature) {
    scoringContext = {game,data,signature:nextSignature};
    invalidateSimulation('Scoring stats updated. Run the simulation to use them.');
  }
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
  note.textContent = data.explanation + ' Passing uses team box-score totals. Scoring allowed includes all opponent points, including defense/special teams. Rankings show raw averages. Game predictions use scoring offense and opposing scoring defense, softened toward the league average for small samples. Schedule strength adjusts predicted scores only when both teams have complete opponent scoring coverage; otherwise the baseline is retained. Rushing and passing ranks are context only. Player projections use their separate model.';
  teamContext.append(grid,note);
}
function loadTeamContext(game) {
  clearTimeout(contextTimer);
  const task = ++contextSequence;
  const params = new URLSearchParams({league:$('league').value, season:$('date').value.slice(0,4),
    before:game.kickoff,away:game.awayId,home:game.homeId});
  let polls = 0;
  contextMessage('Loading season stats… The first load gathers completed game box scores and may take a few minutes.');
  async function poll() {
    try {
      const response = await fetch('/api/rankings?' + params);
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
      if (result.data) {
        showTeamContext(result.data, game);
        const status = document.createElement('p');
        status.setAttribute('role', 'status');
        status.textContent = progress;
        teamContext.append(status);
      } else contextMessage(progress);
      contextTimer = setTimeout(poll,3000);
    } catch (error) {
      if (task === contextSequence && selected === game) contextMessage('Team comparison unavailable: ' + error.message);
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
  if (['spread','total','awayRating','homeRating'].some(id => $(id).value === '')) {
    $('note').textContent = 'Enter spread, total and both point adjustments (0 is fine).';
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
    away:Number($('awayRating').value),home:Number($('homeRating').value)
  });
  if (!prediction.available) {
    $('note').textContent = prediction.reason;
    return;
  }
  const result = Unit501TeamModel.simulate(prediction,spread,total);
  const percent = value => (value*100).toFixed(1) + '%';
  $('score').textContent = `${Math.round(prediction.away)}–${Math.round(prediction.home)}`;
  $('cover').textContent = percent(result.cover);
  $('over').textContent = percent(result.over);
  $('win').textContent = percent(result.win);
  const strength = prediction.schedule;
  const scheduleNote = strength.applied
    ? `Schedule strength applied automatically: baseline ${prediction.unadjustedAway.toFixed(1)}–${prediction.unadjustedHome.toFixed(1)} → adjusted ${prediction.away.toFixed(1)}–${prediction.home.toFixed(1)} points (same manual point adjustments). Uses opponents’ other pre-kickoff games with conservative limits for small samples. Experimental, not calibrated.`
    : `Schedule strength unavailable: opponent coverage ${strength.away.covered}/${strength.away.total} away and ${strength.home.covered}/${strength.home.total} home. Baseline retained for both teams; missing or outside-pool opponents are not guessed.`;
  $('note').textContent = `Score order: ${selected.a}–${selected.h}. Based on ${prediction.awayGames}/${prediction.homeGames} completed games, with early-season smoothing. Experimental model frequencies, not calibrated betting probabilities. ${scheduleNote} No automatic team-score injury, weather or venue adjustment. Spread pushes: ${percent(result.spreadPush)}; total pushes: ${percent(result.totalPush)}; tied scores: ${percent(result.tie)} (overtime not modeled).`;
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
