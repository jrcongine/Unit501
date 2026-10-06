/* Experimental scoring model; constants are assumptions, not fitted parameters. */
(function (root) {
  'use strict';
  function venueEffect(game, home, away, mode = 'auto') {
    if (!['auto','home','neutral'].includes(mode)) return {valid:false};
    if (mode === 'neutral') return {valid:true,margin:0,reason:'Neutral site selected: no home-field adjustment.'};
    const key = String(game.venueName || '').toLowerCase().replace(/[^a-z0-9]/g,'');
    const inferred = key && home.homeVenues?.[key] >= 2 && !(away.homeVenues?.[key] > 0);
    if (mode === 'auto' && !inferred) return {valid:true,margin:0,
      reason:'Home venue unverified: no home-field adjustment. Select Home stadium or Neutral site if you know the location.'};
    const margin = game.league === '1' ? 2 : 3;
    return {valid:true,margin,reason:(mode === 'home' ? 'Home stadium selected.' : 'Home venue inferred from at least two earlier home games; verify neutral-site exceptions.') +
      ` Experimental home-field assumption: +${margin} points to the home margin; projected total unchanged.`};
  }
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
    // One-pass opponent correction. Exclude the head-to-head result from each
    // opponent average; shrink their remaining sample toward four average games.
    // These are conservative assumptions, not fitted or calibrated parameters.
    function schedule(team) {
      let offense = 0, defense = 0, covered = 0, supplemental = 0;
      const missing = [];
      for (const past of team.opponents || []) {
        const opponent = pool.find(t => t.id === past.id) || data.teams.find(t => t.id === past.id && t.opponentScheduleVerified === true);
        if (!opponent || !complete(opponent) ||
            ![past.scored,past.allowed].every(x => Number.isFinite(x) && x >= 0)) {
          missing.push(data.teams.find(t => t.id === past.id)?.name || `Team ${past.id}`);
          continue;
        }
        if (opponent.scoringOnly) supplemental++;
        const otherGames = opponent.games - 1;
        const otherFor = opponent.metrics.pointsFor.average * opponent.games - past.allowed;
        const otherAgainst = opponent.metrics.pointsAgainst.average * opponent.games - past.scored;
        if (otherFor < -1e-8 || otherAgainst < -1e-8) continue;
        offense += baseline - (Math.max(0,otherAgainst) + baseline * 4) / (otherGames + 4);
        defense += baseline - (Math.max(0,otherFor) + baseline * 4) / (otherGames + 4);
        covered++;
      }
      const available = team.opponents?.length === team.games && covered === team.games;
      const cap = value => Math.max(-6,Math.min(6,value));
      return {available,covered,total:team.games,supplemental,missing:[...new Set(missing)],
        offense:available ? cap(offense / team.games * 0.5) : 0,
        defense:available ? cap(defense / team.games * 0.5) : 0};
    }
    const awaySchedule = schedule(away), homeSchedule = schedule(home);
    // Apply as a pair, or keep the baseline when either schedule is incomplete.
    const scheduleApplied = awaySchedule.available && homeSchedule.available;
    const corrections = new Map([[away.id,awaySchedule],[home.id,homeSchedule]]);
    // Four league-average pseudo-games soften small early-season samples.
    const shrink = (team,key) => (team.metrics[key].average * team.games + baseline * 4) / (team.games + 4);
    const corrected = (team,key) => shrink(team,key) + (scheduleApplied
      ? corrections.get(team.id)[key === 'pointsFor' ? 'offense' : 'defense'] * team.games / (team.games + 4) : 0);
    const score = (offense,defense,adjustment,adjusted) => Math.max(0,
      ((adjusted ? corrected : shrink)(offense,'pointsFor') +
       (adjusted ? corrected : shrink)(defense,'pointsAgainst')) / 2 + adjustment);
    const venue = venueEffect(game,home,away,adjustments.venueMode);
    if (!venue.valid) return {available:false,reason:'Choose a valid venue setting.'};
    const preVenueAway = score(away,home,awayAdjustment,true);
    const preVenueHome = score(home,away,homeAdjustment,true);
    // Transfer half the margin between teams; cap at away score to preserve total and nonnegativity.
    const transfer = Math.min(venue.margin / 2,preVenueAway);
    venue.appliedMargin = transfer * 2;
    return {available:true,away:preVenueAway-transfer,home:preVenueHome+transfer,
      preVenueAway,preVenueHome,venue,
      unadjustedAway:score(away,home,awayAdjustment,false),unadjustedHome:score(home,away,homeAdjustment,false),
      schedule:{applied:scheduleApplied,away:awaySchedule,home:homeSchedule},
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
  const model={project,simulate,venueEffect};
  if (typeof module !== 'undefined' && module.exports) module.exports=model;
  else root.Unit501TeamModel=model;
})(typeof globalThis !== 'undefined' ? globalThis : this);
