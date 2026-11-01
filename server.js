

const http = require('http');

const {withRecovery} = require('./provider-retry');

const fs = require('fs');

const path = require('path');
const dataHealth = require('./data-health').createHealth({file:process.env.UNIT501_DATA_HEALTH_FILE || (process.env.UNIT501_LINE_HISTORY_FILE?path.join(path.dirname(process.env.UNIT501_LINE_HISTORY_FILE),'feed-health-v1.json'):'')});
const fanduel = require('./fanduel');
const getHook=require('./hook-quotes').createHook();
const footballComparison = require('./football-comparison').createComparison();
const outsidePicks = require('./outside-picks').createFeed();
const publicNBA = require('./nba-public').createPublicNBA();
const primaryNBAGames=require('./nba-feed').createNBAFeed();
const nbaSources = require('./nba-public').createNBASources({primaryGames:primaryNBAGames,primaryContext:require('./nba-context').createNBAContext(),publicFeed:publicNBA});
const nbaGames = nbaSources.games;
const nbaLiveWatch = require('./nba-live-watch').createLiveWatch({publicFeed:publicNBA});
const nbaContext = nbaSources.context;
const ncaab = require('./ncaab-feed').createNCAAB();
const ncaabMarkets=require('./ncaab-markets').createMarkets();
const ncaaOfficial=require('./ncaa-official-history').createNCAA();
const ncaabPlayers=require('./ncaab-players').createPlayers({feed:ncaab,conferenceReports:require('./ncaab-conference-reports').createReports(),official:data=>ncaaOfficial(require('./ncaa-official-history').basketballScope(data))});
const nbaTravel = require('./nba-travel').createNBATravel({publicFeed:publicNBA});
const nbaOdds = require('./nba-odds').createNBAOdds();
let lineHistory;
try {
  lineHistory = require('./line-history').createHistory({
    file: process.env.UNIT501_LINE_HISTORY_FILE || '',
    enabled: process.env.UNIT501_LINE_HISTORY_BACKGROUND === '1',
    dailyBudget: Number(process.env.UNIT501_LINE_HISTORY_DAILY_CREDITS || 240)
  });
} catch {
  console.error('Line history storage could not be loaded; background tracking disabled. Existing file preserved.');
  lineHistory = require('./line-history').createHistory();
}
require('./odds-monitor').setObserver(lineHistory.noteQuota);
const marketRecorder=require('./market-grades').createMarketRecorder();
const trackedOdds = require('./tracked-odds').createTrackedOdds({history: lineHistory,
  onGameQuote:(game,quote)=>observeLearning(()=>marketRecorder.quote(game,quote)),
  footballLines: fanduel.getLines, footballProps: require('./fanduel-props').getProps, nbaOdds, ncaabOdds: ncaabMarkets});
const nbaInjuries = require('./nba-injuries').createNBAInjuries();
const nbaPlayerHistory = require('./nba-player-history').createPlayerHistory({publicFeed:publicNBA,official:require('./nba-official-history').createOfficialNBA()});
const injurySlate = require('./nba-slate-cache').createSlateCache(nbaGames);
const footballMeter=require('./api-meter').createMeter({
  history:require('./football-usage-history').createUsageHistory(process.env.UNIT501_LINE_HISTORY_FILE
    ? path.join(path.dirname(process.env.UNIT501_LINE_HISTORY_FILE),'football-usage-v1') : null),
  budget:Number(process.env.UNIT501_FOOTBALL_DAILY_BUDGET||7500)});
const footballLearning=require('./football-learning').createLearning({
  directory:process.env.UNIT501_LINE_HISTORY_FILE && path.join(path.dirname(process.env.UNIT501_LINE_HISTORY_FILE),'football-learning-v1'),
  marketRecorder,revision:process.env.RAILWAY_GIT_COMMIT_SHA||'local'
});
const footballPropsGrader=require('./football-prop-grades').createFootballProps({
  directory:process.env.UNIT501_LINE_HISTORY_FILE&&path.join(path.dirname(process.env.UNIT501_LINE_HISTORY_FILE),'football-prop-grades-v1'),
  revision:process.env.RAILWAY_GIT_COMMIT_SHA||'local'
});
const basketballPropsGrader=require('./basketball-prop-grades').createPropGrades({
  directory:process.env.UNIT501_LINE_HISTORY_FILE&&path.join(path.dirname(process.env.UNIT501_LINE_HISTORY_FILE),'basketball-prop-grades-v1'),
  revision:process.env.RAILWAY_GIT_COMMIT_SHA||'local'
});
async function withPropGrading(league,game,season,kind,request){
  const result=await request;
  observeLearning(()=>basketballPropsGrader.observe(league,game,season,kind,result));
  return result;
}
const basketballLearning=require('./basketball-learning').createBasketballLearning({
  directory:process.env.UNIT501_LINE_HISTORY_FILE && path.join(path.dirname(process.env.UNIT501_LINE_HISTORY_FILE),'basketball-learning-v1'),
  marketRecorder,revision:process.env.RAILWAY_GIT_COMMIT_SHA||'local'
});
function observeLearning(action){
  try { action(); } catch { console.warn('Model grading observation unavailable.'); }
}
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
  publicNFL:require('./nfl-public-yardage').createPublicNFLYardage(),
  // Reuse the configured persistent data volume when present. Otherwise the
  // rankings module retains its temporary-directory default.
  cacheDir:process.env.UNIT501_TEAM_BOX_CACHE_DIR || (process.env.UNIT501_LINE_HISTORY_FILE
    ? path.join(path.dirname(process.env.UNIT501_LINE_HISTORY_FILE),'team-boxes-v1') : undefined)
});
const getBettingSplits=require('./betting-splits').createSplits();
const getLeaguePulse=require('./league-pulse').createLeaguePulse({
  // One shared, metered season-schedule request per 15-minute college cache.
  // Uses the same schedule cache as Game Lab; no extra box-score downloads.
  collegeSchedule:season=>api('/games?league=2&season='+season)
});
const getAvailability = require('./availability').createAvailability(api,Date.now,q=>footballGamebooks(q));
const getPlayerRatings = require('./player-ratings').createRatings(api);

const rosterMaintenance=require('./roster-maintenance').createRosterMaintenance(api,getAvailability);

const PORT = process.env.PORT || 5010;

const API = 'https://v1.american-football.api-sports.io';

function send(res, code, obj, type = 'application/json') {

  if(type === 'application/json' && res.healthURL)dataHealth.observe(res.healthURL,code,obj);
  res.writeHead(code, { 'Content-Type': type });

  res.end(type === 'application/json' ? JSON.stringify(obj) : obj);

}

async function providerAPI(endpoint) {

  if (!process.env.API_SPORTS_KEY) {

    throw new Error('API key is not configured');

  }

  return withRecovery(()=>footballMeter.track(endpoint,async(observeHeaders,observeResponse)=>{
    let r;
    try { r = await fetch(API + endpoint, {
      signal: AbortSignal.timeout(15000),
      headers: {'x-apisports-key': process.env.API_SPORTS_KEY}
    }); } catch(error) {
      if(error.name==='TimeoutError'||error.name==='TypeError')error.retryable=true;
      throw error;
    }
    observeHeaders(r.headers);
    observeResponse(r.status,r.headers);
    if (!r.ok) {
      const error=new Error('Football provider HTTP ' + r.status);
      error.retryable=[502,503,504].includes(r.status);
      throw error;
    }
    const data=await r.json();
    observeResponse(r.status,r.headers,data);
    if(data?.errors&&Object.keys(data.errors).length)throw new Error('Football provider returned an API error; retries paused briefly.');
    return data;
  }));

}

const footballGamebooks=require('./football-participation').createParticipation({api,ncaa:ncaaOfficial});

const server = http.createServer(async (req, res) => {
  if(!require('./private-access').allowRequest(req,res))return;

  try {

    const u = new URL(req.url, 'http://localhost');
    res.healthURL=u;
    if(u.pathname==='/api/football/participation'){
      const q=Object.fromEntries(['game','league','season','date'].map(k=>[k,u.searchParams.get(k)||'']));
      if(!/^\d{1,12}$/.test(q.game)||!['1','2'].includes(q.league)||!/^20\d{2}$/.test(q.season)||!/^20\d{2}-\d{2}-\d{2}$/.test(q.date))return send(res,400,{error:'Valid historical game, league, season and date required'});
      const report=await footballGamebooks(q);
      if(report?.available)observeLearning(()=>footballPropsGrader.put('participation/'+q.game,report));
      return send(res,200,{response:[report]});
    }
    if(u.pathname==='/api/data-health')return send(res,200,{...dataHealth.snapshot(),footballUsage:footballMeter.snapshot(),lineHistory:trackedOdds.status()});
    if(u.pathname==='/api/hook'){
      const q=Object.fromEntries(u.searchParams),kickoff=Number(q.kickoff);
      if(!['1','2','nba','ncaab'].includes(q.league)||!Number.isSafeInteger(kickoff)||kickoff<=Date.now()||kickoff>Date.now()+7*86400000||
         !q.away||!q.home||q.away.length>120||q.home.length>120)return send(res,400,{error:'Upcoming matchup required.'});
      let neutral=false;
      if(q.league==='ncaab'){
        const date=require('./nba-feed').centralDate(kickoff);
        const slate=await ncaab.games(date);
        const g=slate.games.find(g=>String(g.id)===q.game&&g.timeKnown&&g.status==='Scheduled'&&g.home===q.home&&g.away===q.away&&Date.parse(g.tipoff)===kickoff);
        if(!g)return send(res,404,{error:'College matchup unavailable.'});
        neutral=g.neutral===true;
      }
      try{return send(res,200,{quotes:await getHook({league:q.league,away:q.away,home:q.home,tipoff:new Date(kickoff).toISOString(),neutral})});}
      catch{return send(res,503,{error:'FanDuel quote lookup unavailable.'});}
    }
    if(u.pathname==='/api/slate-spreads'){
      const league=u.searchParams.get('league');
      if(!['1','2','nba','ncaab'].includes(league))return send(res,400,{error:'Unknown league'});
      return send(res,200,{rows:lineHistory.slateSpreads(league)});
    }
    if(u.pathname==='/api/line-history/status')return send(res,200,trackedOdds.status());
    if(u.pathname==='/api/league-pulse'){
      const league=u.searchParams.get('league')||'nfl';
      if(!Object.hasOwn(require('./league-pulse').LEAGUES,league))return send(res,400,{error:'Choose NFL, college football, NBA, college basketball, MLB or NHL.'});
      return send(res,200,await getLeaguePulse(league));
    }
    if(u.pathname==='/api/betting-splits'){
      const q=Object.fromEntries(u.searchParams);q.kickoff=Number(q.kickoff);
      if(!['1','2'].includes(q.league)||!/^\d{4}$/.test(q.season||'')||!/^\d+$/.test(q.game||'')||!Number.isFinite(q.kickoff)||!q.home||!q.away||q.home.length>120||q.away.length>120)return send(res,400,{error:'Valid matchup required.'});
      return send(res,200,await getBettingSplits(q));
    }
    if(u.pathname==='/api/ncaab/games'){
      const date=u.searchParams.get('date');
      if(!require('./nba-feed').validDate(date))return send(res,400,{error:'Valid date required.'});
      try{const slate=await ncaab.games(date);observeLearning(()=>basketballLearning.observe(slate));return send(res,200,slate);}catch{return send(res,503,{error:'College basketball schedule unavailable.'});}
    }
    if(['/api/ncaab/odds','/api/ncaab/props','/api/ncaab/injuries','/api/ncaab/player-history'].includes(u.pathname)){
      const date=u.searchParams.get('date'),id=u.searchParams.get('game');
      if(!require('./nba-feed').validDate(date)||!/^\d{1,12}$/.test(id||''))return send(res,400,{error:'Valid date and game required.'});
      try{const slate=await ncaab.games(date),game=slate.games.find(g=>g.id===id);if(!game)return send(res,404,{error:'Game not found on this slate.'});
       if(!game.timeKnown||game.status!=='Scheduled'||Date.parse(game.tipoff)<=Date.now())return send(res,400,{error:'Confirmed upcoming game required.'});
       if(u.pathname.endsWith('/odds'))return send(res,200,await trackedOdds.ncaab(game,'game'));
       if(u.pathname.endsWith('/props'))return send(res,200,await withPropGrading('ncaab',game,game.season,'quotes',trackedOdds.ncaab(game,'props')));
       if(u.pathname.endsWith('/injuries'))return send(res,200,await ncaabPlayers.injuries(game));
       return send(res,200,await withPropGrading('ncaab',game,game.season,'history',ncaabPlayers.history(game)));
      }catch(error){return send(res,503,{error:error.publicMessage||'Data source unavailable for this matchup.'});}
    }
    if(u.pathname==='/api/ncaab/context'){
      const date=u.searchParams.get('date'),id=u.searchParams.get('game');
      if(!require('./nba-feed').validDate(date)||!/^\d{1,12}$/.test(id||''))return send(res,400,{error:'Valid date and game required.'});
      try{const slate=await ncaab.games(date),game=slate.games.find(g=>g.id===id);
       if(!game)return send(res,404,{error:'Game not found on this slate.'});
       const context=await ncaab.context(game);
       observeLearning(()=>basketballLearning.capture(slate,game,context));
       return send(res,200,context);
      }catch{return send(res,503,{error:'College basketball team history unavailable.'});}
    }
    if(u.pathname==='/api/nba/live-watch'){
      // Live monitoring uses the shared public scoreboard, never paid NBA or odds credits.
      try{return send(res,200,await nbaLiveWatch());}
      catch{return send(res,503,{error:'Live NBA scores unavailable. Try again shortly.'});}
    }
    if(u.pathname==='/api/nba/games'){
      const date=u.searchParams.get('date');
      if(!require('./nba-feed').validDate(date))return send(res,400,{error:'Valid NBA date (YYYY-MM-DD) required.'});
      try{const slate=await nbaGames(date);injurySlate.remember(date,slate);observeLearning(()=>basketballLearning.observe(slate));return send(res,200,slate);}
      catch(e){console.error('NBA beta:',e.message);return send(res,503,{error:e.code==='NBA_PLAN_ACCESS'?e.message:'NBA schedule unavailable. Verify NBA provider access and try again.',code:e.code==='NBA_PLAN_ACCESS'?e.code:'NBA_UNAVAILABLE'});}
    }
    if(['/api/nba/odds','/api/nba/props','/api/nba/comparison'].includes(u.pathname)){
      const date=u.searchParams.get('date'),id=u.searchParams.get('game');
      if(!require('./nba-feed').validDate(date)||!/^\d{1,12}$/.test(id||''))return send(res,400,{error:'Valid NBA date and game ID required.'});
      try{
        const slate=await nbaGames(date),game=slate.games.find(g=>String(g.id)===id);
        if(!game)return send(res,404,{error:'Selected NBA game was not found on this slate.'});
        if(u.searchParams.get('provider')&&u.searchParams.get('provider')!==game.provider)return send(res,409,{error:'NBA source changed. Reload the NBA slate before selecting this game.'});
        if(u.pathname.endsWith('/props'))return send(res,200,await withPropGrading('nba',game,slate.season,'quotes',trackedOdds.nba(game,'props')));
        return send(res,200,await trackedOdds.nba(game,u.pathname.endsWith('/comparison')?'comparison':'game'));
      }catch(e){return send(res,503,{error:e.message});}
    }
    if(u.pathname==='/api/nba/travel'){
      const date=u.searchParams.get('date'),id=u.searchParams.get('game');
      if(!require('./nba-feed').validDate(date)||!/^\d{1,12}$/.test(id||''))return send(res,400,{error:'Valid NBA date and game ID required.'});
      try{
        const slate=await injurySlate(date),game=slate.games.find(g=>String(g.id)===id);
        if(!game)return send(res,404,{error:'Selected NBA game was not found on this slate.'});
        if(u.searchParams.get('provider')&&u.searchParams.get('provider')!==game.provider)return send(res,409,{error:'NBA source changed. Reload the NBA slate.'});
        return send(res,200,await nbaTravel(game,date,slate.season));
      }catch{return send(res,503,{error:'NBA travel context unavailable.'});}
    }
    if(u.pathname==='/api/nba/player-history'){
      const date=u.searchParams.get('date'),id=u.searchParams.get('game');
      if(!require('./nba-feed').validDate(date)||!/^\d{1,12}$/.test(id||''))return send(res,400,{error:'Valid NBA date and game ID required.'});
      try{
        const slate=await injurySlate(date),game=slate.games.find(g=>String(g.id)===id);
        if(!game)return send(res,404,{error:'Selected NBA game was not found on this slate.'});
        if(u.searchParams.get('provider')&&u.searchParams.get('provider')!==game.provider)return send(res,409,{error:'NBA source changed. Reload the NBA slate before selecting this game.'});
        return send(res,200,await withPropGrading('nba',game,slate.season,'history',nbaPlayerHistory(game,date,slate.season)));
      }catch(error){console.error('NBA player history:',error.message);return send(res,503,{error:'NBA player history unavailable for this matchup.'});}
    }
    if(u.pathname==='/api/nba/injuries'){
      const date=u.searchParams.get('date'),id=u.searchParams.get('game');
      if(!require('./nba-feed').validDate(date)||!/^\d{1,12}$/.test(id||''))return send(res,400,{error:'Valid NBA date and game ID required.'});
      try{
        const slate=await injurySlate(date),game=slate.games.find(g=>String(g.id)===id);
        if(!game)return send(res,404,{error:'Selected NBA game was not found on this slate.'});
        if(u.searchParams.get('provider')&&u.searchParams.get('provider')!==game.provider)return send(res,409,{error:'NBA source changed. Reload the NBA slate before selecting this game.'});
        return send(res,200,await nbaInjuries(game,slate.season));
      }catch(error){console.error('NBA injury report:',error.message);return send(res,503,{error:'Official NBA injury report unavailable for this matchup. Open the NBA report to check manually.'});}
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
        const context=await nbaContext(game,slate.season);
       observeLearning(()=>basketballLearning.capture(slate,game,context));
       return send(res,200,context);
      }catch(e){
        console.error('NBA team context:',e.message);
        return send(res,503,{error:'NBA matchup history unavailable. Check NBA data access or try again.'});
      }
    }
    if(u.pathname==='/api/outside-picks'){
      const league=u.searchParams.get('league')||'nfl';
      if(!['nfl','ncaaf','mlb','nba','nhl','ncaab'].includes(league))return send(res,400,{error:'Choose NFL, college football, MLB, NBA, college basketball or NHL.'});
      return send(res,200,await outsidePicks(league));
    }
    if(u.pathname==='/api/basketball/model-review')return send(res,200,{...basketballLearning.summary(),playerProps:basketballPropsGrader.summary()});
    if(u.pathname==='/api/football/model-review')return send(res,200,{...footballLearning.summary(),playerProps:footballPropsGrader.summary()});
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
      const result=getRankings(query);
      if(result.state!=='error')observeLearning(()=>footballLearning.capture(query,result.data));
      return send(res,200,result);
    }
    if (u.pathname === '/api/fanduel' || u.pathname === '/api/fanduel-props' || u.pathname === '/api/football/player-lines' || u.pathname === '/api/football/comparison') {
      const query = Object.fromEntries(u.searchParams);
      query.kickoff = Number(query.kickoff);
      if (!fanduel.sports[query.league] || !query.away || !query.home ||
          query.away.length > 120 || query.home.length > 120 ||
          !Number.isFinite(query.kickoff) || query.kickoff <= 0) {
        return send(res, 400, { error: 'Valid league, teams and kickoff required' });
      }
      if (u.pathname === '/api/football/comparison') return send(res, 200, await footballComparison(query));
      const kind=['/api/fanduel-props','/api/football/player-lines'].includes(u.pathname)?'props':'game';
      const result=await trackedOdds.football(query,kind);
      if(kind==='props')observeLearning(()=>footballPropsGrader.capture(query,result));
      return send(res,200,result);
    }
// Get player statistics for a game

if (u.pathname === '/api/player-stats' || u.pathname === '/api/team-stats') {

  const id = u.searchParams.get('game');

  if (!id || !/^\d+$/.test(id)) {

    return send(res, 400, {

      error: 'Valid game ID required'

    });

  }

  const teamStats=u.pathname==='/api/team-stats';
  const result=await api((teamStats?'/games/statistics/teams?id=':'/games/statistics/players?id=')+encodeURIComponent(id));
  if(!teamStats)observeLearning(()=>footballPropsGrader.put('box/'+id,result));
  return send(res,200,result);

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

  const result=await api('/games?'+params);
  observeLearning(()=>footballPropsGrader.put('team/'+u.searchParams.get('league')+'/'+season+'/'+team,result));
  return send(res,200,result);
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

      const slate=await api('/games?' + params);
      observeLearning(()=>footballLearning.observe(slate));
      observeLearning(()=>footballPropsGrader.slate(slate));
      return send(res,200,slate);

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
  if(process.env.RAILWAY_PROJECT_ID)require('./runtime-verification').verify({port:PORT,password:process.env.UNIT501_PRIVATE_PASSWORD,commit:process.env.RAILWAY_GIT_COMMIT_SHA})
    .then(result=>console.log('Runtime verification: '+JSON.stringify(result))).catch(()=>console.log('Runtime verification: unavailable'));
  if(process.env.UNIT501_BASKETBALL_ODDS_AUDIT)require('./basketball-odds-audit').run()
    .then(result=>console.log('Basketball odds audit: '+JSON.stringify(result))).catch(()=>console.log('Basketball odds audit: unavailable'));
  trackedOdds.start();
  if(process.env.UNIT501_LINE_HISTORY_FILE&&process.env.API_SPORTS_KEY)setInterval(()=>footballPropsGrader.refresh(footballGamebooks).catch(()=>console.warn('Football prop final check deferred.')),3600000).unref();
  if(process.env.UNIT501_LINE_HISTORY_FILE)setInterval(()=>basketballPropsGrader.refresh().catch(()=>console.warn('Basketball prop final check deferred.')),900000).unref();
  if(process.env.UNIT501_LINE_HISTORY_FILE)setInterval(()=>basketballLearning.refresh(async game=>{
    if(game.league==='ncaab')return ncaab.games(game.date);
    if(game.provider==='espn')return publicNBA.games(game.date);
    const slate=await primaryNBAGames(game.date);
    return {...slate,provider:'api-nba',games:slate.games.map(row=>({...row,provider:'api-nba'}))};
  }).catch(()=>console.warn('Basketball final check deferred.')),3600000).unref();
  if(process.env.UNIT501_LINE_HISTORY_FILE && process.env.API_SPORTS_KEY)
    setInterval(()=>footballLearning.refresh(api).catch(()=>console.warn('Football final check deferred.')),3600000).unref();
  console.log('Line history: ' + JSON.stringify(trackedOdds.status()));
  // Heavy full-league roster sweeps are opt-in, and never run on startup.
  if(process.env.API_SPORTS_KEY && process.env.UNIT501_ENABLE_ROSTER_SWEEPS==='1')rosterMaintenance.start();
  else rosterMaintenance.pause();

});
