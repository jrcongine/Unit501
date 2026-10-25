

const http = require('http');

const fs = require('fs');

const path = require('path');
const fanduel = require('./fanduel');
const outsidePicks = require('./outside-picks').createFeed();
const nbaSources = require('./nba-public').createNBASources({primaryGames:require('./nba-feed').createNBAFeed(),primaryContext:require('./nba-context').createNBAContext(),publicFeed:require('./nba-public').createPublicNBA()});
const nbaGames = nbaSources.games;
const nbaContext = nbaSources.context;
const nbaOdds = require('./nba-odds').createNBAOdds();
const footballMeter=require('./api-meter').createMeter({budget:Number(process.env.UNIT501_FOOTBALL_DAILY_BUDGET||7500)});
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
const getRankings = require('./rankings').createRankings(api, {
  publicNFL:require('./nfl-public-yardage').createPublicNFLYardage()
});
const getBettingSplits=require('./betting-splits').createSplits();
const getLeaguePulse=require('./league-pulse').createLeaguePulse();
const getAvailability = require('./availability').createAvailability(api);
const getPlayerRatings = require('./player-ratings').createRatings(api);

const rosterMaintenance=require('./roster-maintenance').createRosterMaintenance(api,getAvailability);

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

  return footballMeter.track(endpoint,async()=>{
    const r = await fetch(API + endpoint, {
      signal: AbortSignal.timeout(15000),
      headers: {'x-apisports-key': process.env.API_SPORTS_KEY}
    });
    if (!r.ok) throw new Error('Football provider HTTP ' + r.status);
    return r.json();
  });

}

const server = http.createServer(async (req, res) => {
  if(!require('./private-access').allowRequest(req,res))return;

  try {

    const u = new URL(req.url, 'http://localhost');
    if(u.pathname==='/api/league-pulse'){
      const league=u.searchParams.get('league')||'nfl';
      if(!require('./league-pulse').LEAGUES[league])return send(res,400,{error:'Choose NFL, college football, NBA, MLB or NHL.'});
      return send(res,200,await getLeaguePulse(league));
    }
    if(u.pathname==='/api/betting-splits'){
      const q=Object.fromEntries(u.searchParams);q.kickoff=Number(q.kickoff);
      if(!['1','2'].includes(q.league)||!/^\d{4}$/.test(q.season||'')||!/^\d+$/.test(q.game||'')||!Number.isFinite(q.kickoff)||!q.home||!q.away||q.home.length>120||q.away.length>120)return send(res,400,{error:'Valid matchup required.'});
      return send(res,200,await getBettingSplits(q));
    }
    if(u.pathname==='/api/nba/games'){
      const date=u.searchParams.get('date');
      if(!require('./nba-feed').validDate(date))return send(res,400,{error:'Valid NBA date (YYYY-MM-DD) required.'});
      try{return send(res,200,await nbaGames(date));}
      catch(e){console.error('NBA beta:',e.message);return send(res,503,{error:e.code==='NBA_PLAN_ACCESS'?e.message:'NBA schedule unavailable. Verify NBA provider access and try again.',code:e.code==='NBA_PLAN_ACCESS'?e.code:'NBA_UNAVAILABLE'});}
    }
    if(['/api/nba/odds','/api/nba/props'].includes(u.pathname)){
      const date=u.searchParams.get('date'),id=u.searchParams.get('game');
      if(!require('./nba-feed').validDate(date)||!/^\d{1,12}$/.test(id||''))return send(res,400,{error:'Valid NBA date and game ID required.'});
      try{
        const slate=await nbaGames(date),game=slate.games.find(g=>String(g.id)===id);
        if(!game)return send(res,404,{error:'Selected NBA game was not found on this slate.'});
        if(u.searchParams.get('provider')&&u.searchParams.get('provider')!==game.provider)return send(res,409,{error:'NBA source changed. Reload the NBA slate before selecting this game.'});
        return send(res,200,await nbaOdds(game,u.pathname.endsWith('/props')?'props':'game'));
      }catch(e){return send(res,503,{error:e.message});}
    }
    if(u.pathname==='/api/nba/context'){
      const date=u.searchParams.get('date'),id=u.searchParams.get('game');
      if(!require('./nba-feed').validDate(date)||!/^\d{1,12}$/.test(id||''))
        return send(res,400,{error:'Valid NBA date and game ID required.'});
      try{
        const slate=await nbaGames(date);
        const game=slate.games.find(g=>String(g.id)===id);
        if(!game)return send(res,404,{error:'Selected game not found on this NBA slate.'});
        if(u.searchParams.get('provider')&&u.searchParams.get('provider')!==game.provider)return send(res,409,{error:'NBA source changed. Reload the NBA slate before selecting this game.'});
        return send(res,200,await nbaContext(game,slate.season));
      }catch(e){
        console.error('NBA team context:',e.message);
        return send(res,503,{error:'NBA matchup history unavailable. Check NBA data access or try again.'});
      }
    }
    if(u.pathname==='/api/outside-picks'){
      const league=u.searchParams.get('league')||'nfl';
      if(!['nfl','ncaaf','mlb','nba','nhl'].includes(league))return send(res,400,{error:'Choose NFL, college football, MLB, NBA or NHL.'});
      return send(res,200,await outsidePicks(league));
    }
    if(u.pathname==='/api/provider-usage')return send(res,200,footballMeter.snapshot());
    if(u.pathname==='/api/roster-maintenance')return send(res,200,rosterMaintenance.status());
    if (u.pathname === '/api/player-ratings') {
      const q={league:u.searchParams.get('league')||'1',season:u.searchParams.get('season'),before:Number(u.searchParams.get('before'))};
      if (!['1','2'].includes(q.league) || !/^\d{4}$/.test(q.season || '') || !Number.isFinite(q.before) || q.before <= 0 || q.before > Date.now()+366*86400000)
        return send(res,400,{error:'Valid football league, season and kickoff cutoff required.'});
      return send(res,200,getPlayerRatings(q));
    }
    if(u.pathname==='/api/game-venue'){
      const q={league:u.searchParams.get('league'),season:u.searchParams.get('season'),kickoff:Number(u.searchParams.get('kickoff')),home:u.searchParams.get('home'),away:u.searchParams.get('away')};
      if(!['1','2'].includes(q.league)||!/^\d{4}$/.test(q.season||'')||!Number.isFinite(q.kickoff)||q.kickoff<=0||!q.home||!q.away||q.home.length>120||q.away.length>120)return send(res,400,{error:'Valid matchup required.'});
      return send(res,200,await require('./game-venue').resolveVenue(q));
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

    // Revalidate app files so a reload receives the latest controls and scripts.
    res.setHeader('Cache-Control','no-cache, max-age=0, must-revalidate');
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
  // Heavy full-league roster sweeps are opt-in, and never run on startup.
  if(process.env.API_SPORTS_KEY && process.env.UNIT501_ENABLE_ROSTER_SWEEPS==='1')rosterMaintenance.start();
  else rosterMaintenance.pause();

});
