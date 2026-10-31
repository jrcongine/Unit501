'use strict';
const sports = { '1': 'americanfootball_nfl', '2': 'americanfootball_ncaaf' };
const cache = new Map();
const {errorForResponse}=require('./odds-provider-error');
const { matches: matchupMatches, missingMatchMessage } = require('./odds-matching');
function selectLines(events, { away, home, kickoff, league }, now = Date.now()) {
  const query = {away,home,kickoff,league};
  const matches = events.filter(event => matchupMatches(event,query));
  if (matches.length !== 1) return { available: false, message: missingMatchMessage(events,query) };
  const lines=require('./game-quotes').gameQuotes(matches[0],now,'fanduel',{requirePrices:false});
  return {
    available:Boolean(lines.spread||lines.total||lines.moneyline),
    moneyline:lines.moneyline,marketAudit:lines.marketAudit,
    bookmaker:'FanDuel',awaySpread:lines.spread?.away??null,total:lines.total?.line??null,
    prices:{away:lines.spread?.awayPrice??null,home:lines.spread?.homePrice??null,over:lines.total?.over??null,under:lines.total?.under??null},
    spreadUpdated:lines.spread?.updatedAt??null,totalUpdated:lines.total?.updatedAt??null,
    message:'Missing or older-than-30-minute markets require manual entry.'
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
