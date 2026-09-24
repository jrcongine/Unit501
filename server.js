

const http = require('http');

const fs = require('fs');

const path = require('path');

const PORT = process.env.PORT || 5010;

const API = 'https://v1.american-football.api-sports.io';

function send(res, code, obj, type = 'application/json') {

  res.writeHead(code, { 'Content-Type': type });

  res.end(type === 'application/json' ? JSON.stringify(obj) : obj);

}

async function api(endpoint) {

  if (!process.env.API_SPORTS_KEY) {

    throw new Error('API key is not configured');

  }

  const r = await fetch(API + endpoint, {

    headers: {

      'x-apisports-key': process.env.API_SPORTS_KEY

    }

  });

  if (!r.ok) throw new Error('API error ' + r.status);

  return r.json();

}

const server = http.createServer(async (req, res) => {

  try {

    const u = new URL(req.url, 'http://localhost');
// Get player statistics for a game

if (u.pathname === '/api/player-stats') {

  const id = u.searchParams.get('game');

  if (!id || !/^\d+$/.test(id)) {

    return send(res, 400, {

      error: 'Valid game ID required'

    });

  }

  return send(

    res,

    200,

    await api(

      '/games/statistics/players?id=' +

      encodeURIComponent(id)

    )

  );

}// Get a team's games for a season
if (u.pathname === '/api/team-games') {
  const team = u.searchParams.get('team');
  const season = u.searchParams.get('season');

  if (!team || !/^\d+$/.test(team) ||
      !season || !/^\d{4}$/.test(season)) {
    return send(res, 400, {
      error: 'Valid team ID and season required'
    });
  }

  const params = new URLSearchParams({ team, season });

  return send(
    res,
    200,
    await api('/games?' + params)
  );
}
    if (u.pathname === '/api/health') {

      return send(res, 200, {

        ok: true,

        liveData: Boolean(process.env.API_SPORTS_KEY)

      });

    }

    if (u.pathname === '/api/leagues') {

      return send(res, 200, await api('/leagues?current=true'));

    }

    if (u.pathname === '/api/games') {

      const date = u.searchParams.get('date');

      const league = u.searchParams.get('league') || '2';

      const season = u.searchParams.get('season') || '2026';

      const tz = u.searchParams.get('timezone') || 'America/Chicago';

      if (!date) {

        return send(res, 400, { error: 'Date is required' });

      }

      const params = new URLSearchParams({

        league,

        season,

        date,

        timezone: tz

      });

      return send(res, 200, await api('/games?' + params));

    }

    if (u.pathname === '/api/odds') {

      const id = u.searchParams.get('game');

      if (!id || !/^\d+$/.test(id)) {

        return send(res, 400, { error: 'Valid game ID required' });

      }

      return send(

        res,

        200,

        await api('/odds?game=' + encodeURIComponent(id))

      );

    }

    // Automatic betting markets, including player props

    // when supplied by the data provider.

    if (u.pathname === '/api/markets') {

      const id = u.searchParams.get('game');

      if (!id || !/^\d+$/.test(id)) {

        return send(res, 400, { error: 'Valid game ID required' });

      }

      const data = await api('/odds?game=' + encodeURIComponent(id));

      const markets = [];

      for (const entry of data.response || []) {

        for (const bookmaker of entry.bookmakers || []) {

          for (const bet of bookmaker.bets || []) {

            markets.push({

              bookmaker: bookmaker.name,

              market: bet.name,

              values: bet.values || []

            });

          }

        }

      }

      return send(res, 200, {

        game: id,

        markets

      });

    }

    // Serve the existing app.

    const publicDir = path.resolve(__dirname, 'public');

    const file = u.pathname === '/'

      ? 'index.html'

      : decodeURIComponent(u.pathname.slice(1));

    const p = path.resolve(publicDir, file);

    if (!p.startsWith(publicDir + path.sep)) {

      return send(res, 403, { error: 'Forbidden' });

    }

    if (!fs.existsSync(p) || !fs.statSync(p).isFile()) {

      return send(res, 404, { error: 'Not found' });

    }

    const ext = path.extname(p);

    const types = {

      '.html': 'text/html',

      '.js': 'text/javascript',

      '.css': 'text/css',

      '.png': 'image/png',

      '.svg': 'image/svg+xml',

      '.ico': 'image/x-icon'

    };

    send(

      res,

      200,

      fs.readFileSync(p),

      types[ext] || 'application/octet-stream'

    );

  } catch (e) {

    console.error(e);

    send(res, 500, { error: e.message });

  }

});

server.listen(PORT, () => {

  console.log('UNIT 501 running on port ' + PORT);

});
