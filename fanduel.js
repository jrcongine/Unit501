'use strict';
const sports = { '1': 'americanfootball_nfl', '2': 'americanfootball_ncaaf' };
const cache = new Map();
const {errorForResponse}=require('./odds-provider-error');
const { matches: matchupMatches, missingMatchMessage } = require('./odds-matching');
function selectLines(events, { away, home, kickoff, league }, now = Date.now()) {
  const query = {away,home,kickoff,league};
  const matches = events.filter(event => matchupMatches(event,query));
  if (matches.length !== 1) return { available: false, message: missingMatchMessage(events,query) };
  const books = (matches[0].bookmakers || []).filter(book => book.key === 'fanduel');
  const book = books.length === 1 ? books[0] : null;
  const markets = book?.markets || [];
  function fresh(key) {
    const candidates=markets.filter(m=>m.key===key);
    const market=candidates.length===1?candidates[0]:null;
    const updated = Date.parse(market?.last_update || book?.last_update);
    return Number.isFinite(updated) && now - updated <= 30 * 60 * 1000 && updated <= now + 60000
      ? market : null;
  }
  const spread = fresh('spreads');
  const total = fresh('totals');
  const h2h = fresh('h2h');
  const awayMoney = h2h?.outcomes?.filter(o => o.name === matches[0].away_team) || [];
  const homeMoney = h2h?.outcomes?.filter(o => o.name === matches[0].home_team) || [];
  const moneyline = awayMoney.length === 1 && homeMoney.length === 1 && h2h.outcomes.length === 2 &&
    [awayMoney[0].price, homeMoney[0].price].every(p => Number.isInteger(p) && Math.abs(p) >= 100)
    ? {away: awayMoney[0].price, home: homeMoney[0].price, updatedAt: Date.parse(h2h.last_update || book.last_update)} : null;
  const awayOutcome = spread?.outcomes?.find(o => o.name === matches[0].away_team);
  const homeOutcome = spread?.outcomes?.find(o => o.name === matches[0].home_team);
  const over = total?.outcomes?.find(o => o.name === 'Over');
  const under = total?.outcomes?.find(o => o.name === 'Under');
  const awaySpread = Number.isFinite(awayOutcome?.point) && Number.isInteger(awayOutcome.point*2) && homeOutcome?.point === -awayOutcome.point && spread.outcomes.length===2 ? awayOutcome.point : null;
  const gameTotal = Number.isFinite(over?.point) && over.point > 0 && over.point === under?.point && Number.isInteger(over.point*2) && total.outcomes.length===2 ? over.point : null;
  return {
    available: awaySpread !== null || gameTotal !== null || moneyline !== null,
    moneyline,
    bookmaker: 'FanDuel', awaySpread, total: gameTotal,
    prices: {
      away: Number.isInteger(awayOutcome?.price) && Math.abs(awayOutcome.price)>=100 ? awayOutcome.price : null,
      home: homeOutcome?.point === -awaySpread && Number.isInteger(homeOutcome?.price) && Math.abs(homeOutcome.price)>=100 ? homeOutcome.price : null,
      over: Number.isInteger(over?.price) && Math.abs(over.price)>=100 ? over.price : null,
      under: Number.isInteger(under?.price) && Math.abs(under.price)>=100 ? under.price : null
    },
    spreadUpdated: spread?.last_update || (spread ? book.last_update : null),
    totalUpdated: total?.last_update || (total ? book.last_update : null),
    message: 'Missing or older-than-30-minute markets require manual entry.'
  };
}
async function getLines(query) {
  if (!process.env.ODDS_API_KEY?.trim()) return { available: false, message: 'Automatic FanDuel lines need an ODDS_API_KEY in Railway. You can still enter lines manually.' };
  const sport = sports[query.league];
  let item = cache.get(sport);
  if (!item || Date.now() - item.at >= 5 * 60 * 1000) {
    const params = new URLSearchParams({ apiKey: process.env.ODDS_API_KEY.trim(), bookmakers: 'fanduel', markets: 'h2h,spreads,totals', oddsFormat: 'american' });
    const pending = (async () => {
      let response;
      try {
        response = await fetch(`https://api.the-odds-api.com/v4/sports/${sport}/odds/?${params}`, { signal: AbortSignal.timeout(12000) });
      } catch { throw new Error('FanDuel feed could not be reached. Enter lines manually.'); }
      require('./odds-monitor').observe(response);
      if (!response.ok) throw errorForResponse(response.status,await response.json().catch(()=>null));
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
