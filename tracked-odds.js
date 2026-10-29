'use strict';
const {createHistory, footballTarget, nbaTarget, ncaabTarget} = require('./line-history');
function createTrackedOdds({history = createHistory(), footballLines, footballProps, nbaOdds, ncaabOdds} = {}) {
  async function football(q, kind) {
    const target = footballTarget(q, kind);
    return history.capture(target, await (kind === 'props' ? footballProps(q) : footballLines(q)));
  }
  async function nba(game, kind) {
    const result = await nbaOdds(game, kind);
    // Only FanDuel is tracked; never combine different bookmakers into one series.
    if (kind === 'comparison') return result;
    return history.capture(nbaTarget(game, kind), result);
  }
  async function ncaab(game, kind) {
    return history.capture(ncaabTarget(game, kind), await ncaabOdds(game, kind));
  }
  async function fetchTarget(target) {
    if (target.league === 'ncaab') return ncaabOdds(target.game, target.kind);
    if (target.league === 'nba') return nbaOdds(target.game, target.kind);
    return target.kind === 'props' ? footballProps(target) : footballLines(target);
  }
  return {football, nba, ncaab, status: history.status, start() { history.start(fetchTarget); }, stop: history.stop};
}
module.exports = {createTrackedOdds};
