/* Experimental scoring model; constants are assumptions, not fitted parameters. */
(function (root) {
  'use strict';
  function project(data, game, adjustments = {}) {
    if (!data || data.before !== game.kickoff || String(data.season) !== String(game.season))
      return {available:false,reason:'Waiting for scoring stats for this matchup.'};
    const poolSize = game.league === '1' ? 32 : 138;
    if (!data.coverage?.pointsFor?.ranked || !data.coverage?.pointsAgainst?.ranked ||
        data.coverage.pointsFor.expected !== poolSize)
      return {available:false,reason:'Complete league scoring data is needed before predicting.'};
    const pool = data.teams.filter(team => team.metrics.pointsFor.rank !== null && team.metrics.pointsFor.pool === poolSize);
    if (pool.length !== poolSize) return {available:false,reason:'The scoring comparison pool is incomplete.'};
    const away = pool.find(team => team.id === game.awayId);
    const home = pool.find(team => team.id === game.homeId);
    if (!away || !home) return {available:false,reason:'Predictions currently support NFL and verified FBS teams.'};
    const complete = team => team.games >= 2 && ['pointsFor','pointsAgainst'].every(key => {
      const m = team.metrics[key];
      return m.games === team.games && Number.isFinite(m.average) && m.average >= 0;
    });
    if (!complete(away) || !complete(home))
      return {available:false,reason:'Both teams need at least two games with complete scoring data.'};
    let sum = 0, count = 0;
    for (const team of pool) {
      const m = team.metrics.pointsFor;
      if (!Number.isFinite(m.average) || m.average < 0 || !(m.games > 0))
        return {available:false,reason:'League scoring data is incomplete.'};
      sum += m.average * m.games;
      count += m.games;
    }
    const baseline = sum / count;
    const awayAdjustment = adjustments.away ?? 0;
    const homeAdjustment = adjustments.home ?? 0;
    if (![awayAdjustment,homeAdjustment].every(x => Number.isFinite(x) && Math.abs(x) <= 14))
      return {available:false,reason:'Point adjustments must be between -14 and +14.'};
    // Four league-average pseudo-games soften small early-season samples.
    const shrink = (team,key) => (team.metrics[key].average * team.games + baseline * 4) / (team.games + 4);
    const score = (offense,defense,adjustment) => Math.max(0,
      (shrink(offense,'pointsFor') + shrink(defense,'pointsAgainst')) / 2 + adjustment);
    return {available:true,away:score(away,home,awayAdjustment),home:score(home,away,homeAdjustment),
      baseline,awayGames:away.games,homeGames:home.games};
  }
  function simulate(prediction, spread, total, runs = 50000, random = Math.random) {
    if (!prediction.available || ![prediction.away,prediction.home,spread,total].every(Number.isFinite) || total <= 0 || !Number.isInteger(runs) || runs < 1)
      throw new Error('Valid projected scores, lines and run count required.');
    const normal = () => Math.sqrt(-2 * Math.log(Math.max(Number.EPSILON,random()))) * Math.cos(2*Math.PI*random());
    let covers=0,overs=0,wins=0,spreadPushes=0,totalPushes=0,ties=0;
    for (let i=0;i<runs;i++) {
      const shared=normal()*4;
      const away=Math.max(0,Math.round(prediction.away+normal()*7.5+shared));
      const home=Math.max(0,Math.round(prediction.home+normal()*7.5+shared));
      if (away+spread>home) covers++;
      if (away+spread===home) spreadPushes++;
      if (away+home>total) overs++;
      if (away+home===total) totalPushes++;
      if (away>home) wins++;
      if (away===home) ties++;
    }
    return {cover:covers/runs,over:overs/runs,win:wins/runs,spreadPush:spreadPushes/runs,totalPush:totalPushes/runs,tie:ties/runs};
  }
  const model={project,simulate};
  if (typeof module !== 'undefined' && module.exports) module.exports=model;
  else root.Unit501TeamModel=model;
})(typeof globalThis !== 'undefined' ? globalThis : this);
