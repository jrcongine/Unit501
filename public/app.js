

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

const normal = () => {

  let u = 0, v = 0;

  while (!u) u = Math.random();

  while (!v) v = Math.random();

  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);

};

async function health() {

  try {

    const r = await fetch('/api/health');

    const x = await r.json();

    $('status').textContent = x.liveData

      ? 'LIVE DATA READY'

      : 'DATA NOT CONNECTED';

  } catch {

    $('status').textContent = 'CONNECTION ERROR';

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

    awayLogo: away.logo,

    homeLogo: home.logo,

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

    statusCode: status.short || 'NS',

    awayScore: g.scores?.away?.total,

    homeScore: g.scores?.home?.total

  };

}

async function load() {

  games.innerHTML = '<div class="card">Loading games...</div>';

  try {

    const date = $('date').value;

    const league = $('league').value;

    const r = await fetch(

      `/api/games?date=${date}&league=${league}&season=2026&timezone=America/Chicago`

    );

    const j = await r.json();

    if (!r.ok || j.error || (j.errors && Object.keys(j.errors).length)) {

      throw new Error(j.error || JSON.stringify(j.errors) || 'Unable to load games');

    }

    const arr = (j.response || []).map(parseGame);

    games.innerHTML = '';

    if (!arr.length) {

      games.innerHTML = '<div class="card">No games scheduled for this date.</div>';

      return;

    }

    arr.forEach(g => {

      const d = document.createElement('div');

      d.className = 'card game';

      const matchup = document.createElement('b');

      matchup.textContent = `${g.a} @ ${g.h}`;

      const details = document.createElement('p');

      const hasScore = g.awayScore != null && g.homeScore != null;

      const score = hasScore

        ? ` | ${g.a} ${g.awayScore} - ${g.h} ${g.homeScore}`

        : '';

      details.textContent = `${g.time} | ${g.status}${score}`;

      d.append(matchup, details);

      d.onclick = () => choose(g);

      games.appendChild(d);

    });

  } catch (e) {

    games.innerHTML = '';

    const d = document.createElement('div');

    d.className = 'card';

    d.textContent = 'Unable to load games: ' + e.message;

    games.appendChild(d);

  }

}

async function choose(g) {

  selected = g;

  $('lab').classList.remove('hidden');

  $('matchup').textContent = g.a + ' @ ' + g.h;

  $('spread').value = 3;

  $('total').value = 48.5;

  $('note').textContent = 'Loading bookmaker odds...';

  try {

    const j = await fetch('/api/odds?game=' + g.id).then(r => r.json());

    $('note').textContent = (j.response || []).length

      ? 'Odds received. Confirm the FanDuel line before simulating.'

      : 'No current odds returned. Enter the FanDuel line manually.';

  } catch {

    $('note').textContent = 'Odds unavailable. Enter the FanDuel line manually.';

  }

  $('lab').scrollIntoView({ behavior: 'smooth' });

}

function sim() {

  if (!selected) return;

  const sp = +$('spread').value;

  const tot = +$('total').value;

  const ar = +$('awayRating').value;

  const hr = +$('homeRating').value;

  const meanMargin = hr - ar + 2.5;

  const meanTotal = 48 + (ar + hr) * .25;

  const ea = (meanTotal - meanMargin) / 2;

  const eh = (meanTotal + meanMargin) / 2;

  let c = 0, o = 0, w = 0, sa = 0, sh = 0;

  for (let i = 0; i < 50000; i++) {

    const common = normal() * 4;

    const A = Math.max(0, ea + normal() * 7.5 + common);

    const H = Math.max(0, eh + normal() * 7.5 + common);

    sa += A;

    sh += H;

    if (A + sp > H) c++;

    if (A + H > tot) o++;

    if (A > H) w++;

  }

  $('score').textContent =

    Math.round(sa / 50000) + '–' + Math.round(sh / 50000);

  $('cover').textContent = (c / 500).toFixed(1) + '%';

  $('over').textContent = (o / 500).toFixed(1) + '%';

  $('win').textContent = (w / 500).toFixed(1) + '%';

  $('note').textContent =

    'Illustrative simulation based on entered ratings, not a validated betting prediction.';

}

$('load').onclick = load;

$('sim').onclick = sim;

health();

load();
