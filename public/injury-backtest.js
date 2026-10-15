(function(root){
'use strict';
const scoreAudit=typeof module!=='undefined'&&module.exports?require('./score-audit'):root.Unit501ScoreAudit;
const marketReliability=typeof module!=='undefined'&&module.exports?require('./market-reliability'):root.Unit501MarketReliability;
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
    // All diagnosis uses the SAME accepted, pregame, version-scoped targets
    // as the accuracy report. Summarize each game once so crowded games
    // cannot dominate directional rates or recent-window comparisons.
    const byDate=[...games.values()].map(rs=>({
      gameId:String(rs[0].gameId),season:String(rs[0].season),kickoff:rs[0].kickoff,
      bias:rs.reduce((n,r)=>n+r.adjusted-r.actual,0)/rs.length,
      mae:rs.reduce((n,r)=>n+r.adjustedError,0)/rs.length
    })).sort((a,b)=>b.kickoff-a.kickoff||b.gameId.localeCompare(a.gameId));
    const recent=byDate.slice(0,10),previous=byDate.slice(10,20);
    const windowAverage=(sample,key)=>sample.length?sample.reduce((n,g)=>n+g[key],0)/sample.length:null;
    const highGames=byDate.filter(g=>g.bias>1e-9).length;
    const lowGames=byDate.filter(g=>g.bias< -1e-9).length;
    const evenGames=byDate.length-highGames-lowGames;
    // The 70% / 30-game threshold is a transparent manual-review heuristic,
    // not a significance test or permission to adjust the model.
    const tendency=byDate.length<30?'insufficient':
      highGames/byDate.length>=0.7?'mostly-high':
      lowGames/byDate.length>=0.7?'mostly-low':'mixed';
    const seen=new Set(),worst=[];
    for(const r of [...rows].sort((a,b)=>b.adjustedError-a.adjustedError||b.kickoff-a.kickoff)){
      const gameKey=JSON.stringify([String(r.league),String(r.season),String(r.gameId)]);
      if(seen.has(gameKey))continue;
      seen.add(gameKey);
      worst.push({league:String(r.league),season:String(r.season),gameId:String(r.gameId),
        teamId:String(r.teamId),playerId:r.playerId==null?null:String(r.playerId),market:r.market,
        kickoff:r.kickoff,adjusted:r.adjusted,actual:r.actual,
        signedMiss:r.adjusted-r.actual,absoluteMiss:r.adjustedError});
      if(worst.length>=3)break;
    }
    const pattern={highGames,lowGames,evenGames,tendency,
      recentGames:recent.length,previousGames:previous.length,
      recentMAE:windowAverage(recent,'mae'),previousMAE:windowAverage(previous,'mae'),
      recentBias:windowAverage(recent,'bias'),previousBias:windowAverage(previous,'bias'),
      worst};
    const baselineMAE = average('baseline'), adjustedMAE = average('adjusted');
    return {pairs: rows.length, games: errors.length, pending: pendingRows.length, baselineMAE, adjustedMAE, pattern,
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
  const scoreGroups=new Map(), audits=new Map();
  for(const r of pairs.filter(r=>r.kind==='score')){
    const key=JSON.stringify([String(r.league),String(r.season),String(r.gameId)]);
    if(!scoreGroups.has(key))scoreGroups.set(key,[]);scoreGroups.get(key).push(r);
  }
  for(const rs of scoreGroups.values()){
    if(rs.length!==2||rs[0].teamId===rs[1].teamId||rs[0].forecastAt!==rs[1].forecastAt||rs[0].kickoff!==rs[1].kickoff)continue;
    const [a,b]=rs,key=JSON.stringify([String(a.league),String(a.season),a.modelVersion]);
    if(!audits.has(key))audits.set(key,{league:String(a.league),season:String(a.season),modelVersion:a.modelVersion,rows:[]});
    audits.get(key).rows.push({id:String(a.gameId),kickoff:a.kickoff,forecastAt:a.forecastAt,knownAt:Math.max(a.resultKnownAt,b.resultKnownAt),projectedAway:a.adjusted,projectedHome:b.adjusted,actualAway:a.actual,actualHome:b.actual});
  }
  const scoringAudits=[...audits.values()].map(({rows,...scope})=>({...scope,...scoreAudit.audit(rows)}));
  return {scoringAudits,marketReliability:marketReliability.summarize(pairs,pendingRecords),modelVersion: version, accepted: pairs.length, skips, scores, props,
    explanation: 'Paired archived forecasts only. Timestamp and source fields are assertions requiring independent archive review. At least 30 distinct games are needed to label observed improvement; this is descriptive, not independent validation, causality, profitability, or automatic model activation. Missing appearances are not zero outcomes.'};
}

if(typeof module!=='undefined'&&module.exports)module.exports={compare};
else root.Unit501InjuryBacktest={compare};
})(typeof globalThis!=='undefined'?globalThis:this);
