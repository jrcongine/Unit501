

const http = require('http');

const fs = require('fs');

const path = require('path');
const fanduel = require('./fanduel');
const cachedAPI=require('./api-cache').createCachedAPI(providerAPI);
async function api(endpoint){
  const data=await cachedAPI(endpoint);
  const u=new URL(endpoint,'https://provider.local');
  if(u.pathname==='/games'&&u.searchParams.get('league')==='2'&&Array.isArray(data.response)){
    let reference=data.response;
    if(u.searchParams.has('date')){
      try{const all=await cachedAPI('/games?league=2&season='+u.searchParams.get('season'));
        if(Array.isArray(all.response)&&!(all.paging?.total>1)){if(!all.errors||!Object.keys(all.errors).length)reference=all.response;}
      }catch{/* Keep original provider IDs when identity cannot be established. */}
    }
    return {...data,response:require('./team-identity').canonicalizeGames(data.response,reference,u.searchParams.get('season'))};
  }
  return data;
}
const getRankings = require('./rankings').createRankings(api);
const getAvailability = require('./availability').createAvailability(api);
const getPlayerRatings = require('./player-ratings').createRatings(api);

const PORT = process.env.PORT || 5010;

const API = 'https://v1.american-football.api-sports.io';

function send(res, code, obj, type = 'application/json') {

  res.writeHead(code, { 'Content-Type': type });

  res.end(type === 'application/json' ? JSON.stringify(obj) : obj);

}

async function providerAPI(endpoint) {

  if (!process.env.API_SPORTS_KEY) {

    throw new Error('API key is not configured');

  }

  const r = await fetch(API + endpoint, {
    signal: AbortSignal.timeout(15000),

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
    if (u.pathname === '/api/player-ratings') {
      const q={league:u.searchParams.get('league')||'1',season:u.searchParams.get('season'),before:Number(u.searchParams.get('before'))};
      if (!['1','2'].includes(q.league) || !/^\d{4}$/.test(q.season || '') || !Number.isFinite(q.before) || q.before <= 0 || q.before > Date.now()+366*86400000)
        return send(res,400,{error:'Valid football league, season and kickoff cutoff required.'});
      return send(res,200,getPlayerRatings(q));
    }
    if (u.pathname === '/api/weather') {
  const names = ['latitude', 'longitude', 'kickoff'];
  const values = names.map(name => u.searchParams.get(name));

  if (values.some(value =>
    value === null || value.trim() === '' ||
    !Number.isFinite(Number(value))
  )) {
    return send(res, 400, {
      error: 'Stadium coordinates and kickoff are required.'
    });
  }

  const [latitude, longitude, kickoff] = values.map(Number);

  if (Math.abs(latitude) > 90 ||
      Math.abs(longitude) > 180 ||
      kickoff <= 0) {
    return send(res, 400, {
      error: 'Invalid stadium coordinates or kickoff.'
    });
  }

  const forecast = await require('./weather').getForecast({
    latitude,
    longitude,
    kickoff
  });

  return send(res, 200, forecast);
}
    if (u.pathname === '/api/availability') {
      const q = Object.fromEntries(u.searchParams);
      if (!['1','2'].includes(q.league) || !/^\d{4}$/.test(q.season || '') ||
          !/^\d{1,6}$/.test(q.away || '') || !/^\d{1,6}$/.test(q.home || '')) {
        return send(res,400,{error:'Valid league, season and team IDs required.'});
      }
      return send(res,200,await getAvailability(q));
    }
    if (u.pathname === '/api/rankings') {
      const query = Object.fromEntries(u.searchParams);
      query.before = Number(query.before);
      if (!['1','2'].includes(query.league) || !/^\d{4}$/.test(query.season || '') ||
          !/^\d+$/.test(query.away || '') || !/^\d+$/.test(query.home || '') ||
          !Number.isFinite(query.before) || query.before <= 0 ||
          query.before > Date.now() + 366 * 86400000) {
        return send(res,400,{error:'Valid season, league, team IDs and cutoff required.'});
      }
      return send(res,200,getRankings(query));
    }
    if (u.pathname === '/api/fanduel' || u.pathname === '/api/fanduel-props') {
      const query = Object.fromEntries(u.searchParams);
      query.kickoff = Number(query.kickoff);
      if (!fanduel.sports[query.league] || !query.away || !query.home ||
          query.away.length > 120 || query.home.length > 120 ||
          !Number.isFinite(query.kickoff) || query.kickoff <= 0) {
        return send(res, 400, { error: 'Valid league, teams and kickoff required' });
      }
      return send(res, 200, await (u.pathname === '/api/fanduel-props' ? require('./fanduel-props').getProps(query) : fanduel.getLines(query)));
    }
// Get player statistics for a game

if (u.pathname === '/api/player-stats' || u.pathname === '/api/team-stats') {

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

      (u.pathname === '/api/team-stats' ? '/games/statistics/teams?id=' : '/games/statistics/players?id=') +

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
