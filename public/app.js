
const $ = id => document.getElementById(id);
const games = $('games');
let selected = null;

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
  selected = null;
  $('lab').classList.add('hidden');
  $('player-lab').classList.add('hidden');
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
    $('status').textContent = 'GAME DATA UNAVAILABLE';
    showMessage('Unable to load games: ' + error.message);
  }
}

async function choose(game) {
  selected = game;
  $('lab').classList.remove('hidden');
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
}

function normal() {
  let u = 0;
  let v = 0;
  while (!u) u = Math.random();
  while (!v) v = Math.random();

  return Math.sqrt(-2 * Math.log(u)) *
    Math.cos(2 * Math.PI * v);
}

function sim() {
  if (!selected) return;

  if ($('spread').value === '' || $('total').value === '') {
    $('note').textContent =
      'Enter both the away spread and the game total first.';
    return;
  }

  const spread = Number($('spread').value);
  const total = Number($('total').value);
  const awayRating = Number($('awayRating').value);
  const homeRating = Number($('homeRating').value);

  if (![spread, total, awayRating, homeRating].every(Number.isFinite) ||
      total <= 0) {
    $('note').textContent = 'Check your numbers and try again.';
    return;
  }

  const meanMargin = homeRating - awayRating + 2.5;
  const meanTotal = 48 + (awayRating + homeRating) * 0.25;
  const expectedAway = (meanTotal - meanMargin) / 2;
  const expectedHome = (meanTotal + meanMargin) / 2;

  let covers = 0;
  let overs = 0;
  let awayWins = 0;
  let awayPoints = 0;
  let homePoints = 0;

  const runs = 50000;

  for (let i = 0; i < runs; i++) {
    const shared = normal() * 4;
    const away = Math.max(0, expectedAway + normal() * 7.5 + shared);
    const home = Math.max(0, expectedHome + normal() * 7.5 + shared);

    awayPoints += away;
    homePoints += home;

    if (away + spread > home) covers++;
    if (away + home > total) overs++;
    if (away > home) awayWins++;
  }

  $('score').textContent =
    `${Math.round(awayPoints / runs)}–${Math.round(homePoints / runs)}`;

  $('cover').textContent = (covers / runs * 100).toFixed(1) + '%';
  $('over').textContent = (overs / runs * 100).toFixed(1) + '%';
  $('win').textContent = (awayWins / runs * 100).toFixed(1) + '%';

  $('note').textContent =
    'Illustrative simulation using manually entered ratings—not a validated betting prediction.';
}

$('load').onclick = load;
$('sim').onclick = sim;

health();
load();
