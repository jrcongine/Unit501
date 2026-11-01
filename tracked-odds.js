'use strict';
const {createHistory, footballTarget, nbaTarget, ncaabTarget} = require('./line-history');
function createTrackedOdds({history = createHistory(), footballLines, footballProps, nbaOdds, ncaabOdds,onGameQuote} = {}) {
  async function football(q, kind) {
    const target = footballTarget(q, kind);
    const result=await (kind === 'props' ? footballProps(q) : footballLines(q));
    if(kind==='game')onGameQuote?.(target,result);
    return history.capture(target,result);
  }
  async function nba(game, kind) {
    const result = await nbaOdds(game, kind);
    // Only FanDuel is tracked; never combine different bookmakers into one series.
    if (kind === 'comparison') return result;
    const target=nbaTarget(game,kind);
    if(kind==='game')onGameQuote?.({...target,id:game.id,provider:game.provider},result);
    return history.capture(target,result);
  }
  async function ncaab(game, kind) {
    const target=ncaabTarget(game,kind),result=await ncaabOdds(game,kind);
    if(kind==='game')onGameQuote?.({...target,id:game.id,provider:'espn'},result);
    return history.capture(target,result);
  }
  async function fetchTarget(target) {
    if (target.league === 'ncaab') return ncaabOdds(target.game, target.kind);
    if (target.league === 'nba') return nbaOdds(target.game, target.kind);
    return target.kind === 'props' ? footballProps(target) : footballLines(target);
  }
  return {football, nba, ncaab, status: history.status, start() { history.start(fetchTarget); }, stop: history.stop};
}
module.exports = {createTrackedOdds};
