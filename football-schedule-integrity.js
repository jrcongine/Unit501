'use strict';
const {positiveId}=require('./provider-id');
const number = value => typeof value === 'number' && Number.isFinite(value) ? value
  : typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value.trim()) ? Number(value) : null;
const readScore = value => {const n=number(value);return Number.isInteger(n)&&n>=0?n:null;};
// Preserve identical repeated observations, but never choose a winner between
// contradictory schedule records. Compare model-relevant fields, not logos/metadata.
function reconcileGames(games) {
  const unique = new Map();
  const signature = g => JSON.stringify([
    String(g.league?.id), String(g.league?.season), g.game?.stage ?? null,
    number(g.game?.date?.timestamp), String(g.game?.status?.short).toUpperCase(),
    String((g.teams?.away || g.teams?.visitors)?.id), String(g.teams?.home?.id),
    readScore(g.scores?.away?.total), readScore(g.scores?.home?.total),
    String(g.game?.venue?.name || '').toLowerCase().replace(/[^a-z0-9]/g, '')
  ]);
  for (const game of games) {
    const id = String(game?.game?.id ?? '');
    if (!positiveId(game?.game?.id)) throw new Error('Unverified game identity in scoring schedule.');
    const key = [game.league?.id, game.league?.season, id].join(':');
    const prior = unique.get(key);
    if (prior && signature(prior) !== signature(game))
      throw new Error('Conflicting game records in scoring schedule. Refresh before predicting.');
    if (!prior) unique.set(key, game);
  }
  return [...unique.values()];
}
module.exports = {reconcileGames,readScore};
