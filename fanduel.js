'use strict';
const sports = { '1': 'americanfootball_nfl', '2': 'americanfootball_ncaaf' };
const cache = new Map();
const { matches: matchupMatches, missingMatchMessage } = require('./odds-matching');
function selectLines(events, { away, home, kickoff, league }, now = Date.now()) {
  const query = {away,home,kickoff,league};
  const matches = events.filter(event => matchupMatches(event,query));
  if (matches.length !== 1) return { available: false, message: missingMatchMessage(events,query) };
  const book = matches[0].bookmakers?.find(book => book.key === 'fanduel');
  const markets = book?.markets || [];
  function fresh(key) {
    const market = markets.find(m => m.key === key);
    const updated = Date.parse(market?.last_update || book?.last_update);
    return Number.isFinite(updated) && now - updated <= 30 * 60 * 1000 && updated <= now + 60000
      ? market : null;
  }
  const spread = fresh('spreads');
  const total = fresh('totals');
  const awayOutcome = spread?.outcomes?.find(o => o.name === matches[0].away_team);
  const over = total?.outcomes?.find(o => o.name === 'Over');
  const under = total?.outcomes?.find(o => o.name === 'Under');
  const awaySpread = Number.isFinite(awayOutcome?.point) ? awayOutcome.point : null;
  const gameTotal = Number.isFinite(over?.point) && over.point > 0 && over.point === under?.point ? over.point : null;
  return {
    available: awaySpread !== null || gameTotal !== null,
    bookmaker: 'FanDuel', awaySpread, total: gameTotal,
    spreadUpdated: spread?.last_update || (spread ? book.last_update : null),
    totalUpdated: total?.last_update || (total ? book.last_update : null),
    message: 'Missing or older-than-30-minute markets require manual entry.'
  };
}
async function getLines(query) {
  if (!process.env.ODDS_API_KEY) return { available: false, message: 'Automatic FanDuel lines need an ODDS_API_KEY in Railway. You can still enter lines manually.' };
  const sport = sports[query.league];
  let item = cache.get(sport);
  if (!item || Date.now() - item.at >= 5 * 60 * 1000) {
    const params = new URLSearchParams({ apiKey: process.env.ODDS_API_KEY, bookmakers: 'fanduel', markets: 'spreads,totals', oddsFormat: 'american' });
    const pending = (async () => {
      let response;
      try {
        response = await fetch(`https://api.the-odds-api.com/v4/sports/${sport}/odds/?${params}`, { signal: AbortSignal.timeout(12000) });
      } catch { throw new Error('FanDuel feed could not be reached. Enter lines manually.'); }
      if (!response.ok) throw new Error(`FanDuel feed returned ${response.status}. Check the odds subscription or enter lines manually.`);
      const data = await response.json();
      if (!Array.isArray(data)) throw new Error('FanDuel feed returned an invalid response.');
      return data;
    })();
    item = { at: Date.now(), pending };
    cache.set(sport, item);
    pending.catch(() => { if (cache.get(sport) === item) cache.delete(sport); });
  }
  return selectLines(await item.pending, query);
}
module.exports = { getLines, selectLines, sports };
