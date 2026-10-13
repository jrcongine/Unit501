(function(root){
'use strict';
// Compare archived forecasts, not reconstructed historical injury reports.
function compare(records) {
  if (!Array.isArray(records)) throw new TypeError('Expected an array of archived forecast records.');
  const groups = new Map();
  const skips = {pending:0, ambiguous: 0, invalid: 0, late: 0, version: 0};
  const pairs = [], pendingRecords = [];
  for (const r of records) {
    const key = JSON.stringify([r?.league, r?.season, r?.gameId, r?.kind, r?.teamId, r?.playerId, r?.market].map(v => v == null ? null : String(v)));
    groups.set(key, [...(groups.get(key) || []), r]);
  }
  let version = null;
  for (const rows of groups.values()) {
    if (rows.length !== 1) { skips.ambiguous += rows.length; continue; }
    const r = rows[0];
    const pending=r?.actual===null&&r?.resultKnownAt===null;
    const numeric = ['kickoff', 'forecastAt', 'inputAsOf', 'resultKnownAt', 'baseline', 'adjusted', 'actual'];
    if (!r || !['1', '2'].includes(String(r.league)) || !/^\d{4}$/.test(String(r.season)) ||
        !/^\d+$/.test(String(r.gameId)) || !/^\d+$/.test(String(r.teamId)) ||
        !['score', 'prop'].includes(r.kind) || typeof r.modelVersion !== 'string' || !r.modelVersion.trim() ||
        typeof r.evidenceUrl !== 'string' || !/^https:\/\/[^\s]+$/.test(r.evidenceUrl) ||
        numeric.some(k => !(pending&&['actual','resultKnownAt'].includes(k))&&!Number.isFinite(r[k])) || r.kickoff <= 0 || r.inputAsOf <= 0 ||
        (r.kind === 'prop' && (!/^\d+$/.test(String(r.playerId)) || !['passYds','passTD','carries','rushYds','rushTD','recYds','rec','recTD'].includes(r.market))) ||
        (r.kind === 'score' && r.market !== 'points') ||
        ((r.kind === 'score' || !r.market.endsWith('Yds')) && [r.baseline,r.adjusted,r.actual].some(v => v < 0))) {
      skips.invalid++; continue;
    }
    // These are asserted archive timestamps; the tool cannot authenticate them.
    if (r.inputAsOf > r.forecastAt || r.forecastAt >= r.kickoff || (!pending&&r.resultKnownAt <= r.kickoff)) {
      skips.late++; continue;
    }

    if(pending){skips.pending++;pendingRecords.push(r);continue;}
    pairs.push({...r, baselineError: Math.abs(r.baseline-r.actual), adjustedError: Math.abs(r.adjusted-r.actual)});
  }
  const versions = [...new Set(pairs.map(r => r.modelVersion))];
  version = versions.length===1 ? versions[0] : null;
  const scope=r=>JSON.stringify([String(r.league),r.kind,r.market]);
  const scopedVersions=new Map();
  for(const r of pairs){const k=scope(r);if(!scopedVersions.has(k))scopedVersions.set(k,new Set());scopedVersions.get(k).add(r.modelVersion);}
  for(let i=pairs.length-1;i>=0;i--)if(scopedVersions.get(scope(pairs[i])).size>1){pairs.splice(i,1);skips.version++;}
  const metrics = (rows, pendingRows=[]) => {
    const games = new Map();
    for (const r of rows) {
      const key = JSON.stringify([String(r.league), String(r.season), String(r.gameId)]);
      games.set(key, [...(games.get(key) || []), r]);
    }
    // Equal weight per game: games with more player markets cannot dominate.
    const errors = [...games.values()].map(rs => ({
      baseline: rs.reduce((n,r) => n+r.baselineError,0)/rs.length,
      adjusted: rs.reduce((n,r) => n+r.adjustedError,0)/rs.length,
      baselineBias: rs.reduce((n,r) => n+r.baseline-r.actual,0)/rs.length,
      adjustedBias: rs.reduce((n,r) => n+r.adjusted-r.actual,0)/rs.length
    }));
    const average = key => errors.length ? errors.reduce((n,r) => n+r[key],0)/errors.length : null;
    const baselineMAE = average('baseline'), adjustedMAE = average('adjusted');
    return {pairs: rows.length, games: errors.length, pending: pendingRows.length, baselineMAE, adjustedMAE,
      baselineBias: average('baselineBias'), adjustedBias: average('adjustedBias'),
      improvement: errors.length ? baselineMAE-adjustedMAE : null,
      status: errors.length < 30 ? 'insufficient' : adjustedMAE < baselineMAE ? 'lower-observed-error' : 'no-observed-improvement'};
  };
  const scores = {}, props = {};
  // Keep leagues and prop units separate; do not pool receptions with yards.
  for (const league of ['1','2']) {
    scores[league] = metrics(pairs.filter(r => String(r.league)===league && r.kind==='score'),pendingRecords.filter(r => String(r.league)===league && r.kind==='score'));
    props[league] = {};
    for (const market of [...new Set([...pairs,...pendingRecords].filter(r => String(r.league)===league && r.kind==='prop').map(r => r.market))]) {
      props[league][market] = metrics(pairs.filter(r => String(r.league)===league && r.kind==='prop' && r.market===market),pendingRecords.filter(r => String(r.league)===league && r.kind==='prop' && r.market===market));
    }
  }
  return {modelVersion: version, accepted: pairs.length, skips, scores, props,
    explanation: 'Paired archived forecasts only. Timestamp and source fields are assertions requiring independent archive review. At least 30 distinct games are needed to label observed improvement; this is descriptive, not independent validation, causality, profitability, or automatic model activation. Missing appearances are not zero outcomes.'};
}

if(typeof module!=='undefined'&&module.exports)module.exports={compare};
else root.Unit501InjuryBacktest={compare};
})(typeof globalThis!=='undefined'?globalThis:this);
