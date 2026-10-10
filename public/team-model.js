/* Experimental scoring model; constants are assumptions, not fitted parameters. */
(function (root) {
  'use strict';
  const probability=typeof module!=='undefined'&&module.exports?require('./probability-calibration'):root.Unit501ProbabilityCalibration;
  const paceModel=typeof module!=='undefined'&&module.exports?require('./pace-model'):root.Unit501PaceModel;
  function weatherEffect(game, forecast, enabled = true, now = Date.now()) {
    const skip = reason => ({applied:false,reduction:0,reason});
    if (!enabled) return skip('Weather adjustment switched off.');
    if (forecast?.roof === 'indoor') return skip('Enclosed stadium: no outdoor weather adjustment.');
    if (forecast?.roof !== 'outdoor') return skip('Roof or stadium location unverified: no weather adjustment.');
    if (!forecast.available) return skip('Forecast unavailable or loading: no weather adjustment.');
    if (forecast.kickoff !== game.kickoff || !Number.isFinite(game.kickoff) || game.kickoff <= now ||
        !Number.isFinite(forecast.fetchedAt) || forecast.fetchedAt > now || now - forecast.fetchedAt > 15 * 60000 ||
        !Number.isFinite(forecast.forecastTime) || Math.abs(forecast.forecastTime - game.kickoff) > 30 * 60000)
      return skip('Forecast expired or does not match this kickoff: reselect the matchup to refresh.');
    if (!Number.isFinite(forecast.windMph) || forecast.windMph < 0 || forecast.windMph > 200)
      return skip('Sustained wind unavailable: no weather adjustment.');
    // Explicit uncalibrated assumption: reduce both scores by 1% per mph over
    // 15 mph, capped at 15%. Gusts and rain probability are display-only.
    const reduction = Math.min(0.15,Math.max(0,forecast.windMph - 15) * 0.01);
    return {applied:reduction > 0,reduction,reason:reduction > 0
      ? `Experimental wind adjustment: sustained wind ${forecast.windMph.toFixed(1)} mph reduces both projected scores by ${(reduction*100).toFixed(1)}%. Assumption, not calibrated; player props unchanged.`
      : 'Sustained wind at or below 15 mph: no scoring reduction.'};
  }
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
  function project(data, game, adjustments = {}, legacy = false) {
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
      const allowed=team.metrics.pointsAgainst;
      if (!Number.isFinite(m.average) || m.average < 0 || !(m.games > 0) ||
          !allowed || !Number.isFinite(allowed.average) || allowed.average<0 || allowed.games!==m.games)
        return {available:false,reason:'League scoring data is incomplete.'};
      // FBS games include opponents outside the ranking pool. Use both sides
      // of the pool's scoring environment, rather than only its points scored.
      sum += (legacy?m.average:(m.average+allowed.average)/2) * m.games;
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
    // Offense and defense are deviations from one league baseline. Averaging
    // them halves both signals *after* sample shrinkage and compresses margins.
    const score = (offense,defense,adjustment,adjusted) => {
      const sum=(adjusted ? corrected : shrink)(offense,'pointsFor') +
        (adjusted ? corrected : shrink)(defense,'pointsAgainst');
      return Math.max(0,(legacy?sum/2:sum-baseline)+adjustment);
    };
    const venue = venueEffect(game,home,away,adjustments.venueMode);
    if (!venue.valid) return {available:false,reason:'Choose a valid venue setting.'};
    const injury = Object.fromEntries(['awayOffense','awayDefense','homeOffense','homeDefense']
      .map(key => [key,adjustments.injury?.[key] ?? 0]));
    if (!Object.values(injury).every(value => Number.isFinite(value) && value >= 0 && value <= 14))
      return {available:false,reason:'Each injury scenario must be between 0 and 14 points.'};
    const candidate=paceModel?.project(pool,away,home,baseline,{applied:scheduleApplied,[away.id]:awaySchedule,[home.id]:homeSchedule});
    const paceCheck=data.paceValidation;
    const paceAccepted=paceCheck?.accepted===true&&paceCheck.before===game.kickoff&&String(paceCheck.league)===String(game.league)&&String(paceCheck.season)===String(game.season);
    const paceApplied=!legacy&&adjustments.pace!==false&&candidate?.available&&(adjustments.pace===true||paceAccepted);
    const pace={...candidate,applied:!!paceApplied};
    if(candidate?.available&&!paceApplied)pace.reason='Drive data available; current scoring retained until the chronological pace comparison improves both score and total error on at least 30 later games.';
    const preInjuryAway = paceApplied?Math.max(0,candidate.away+awayAdjustment):score(away,home,awayAdjustment,true);
    const preInjuryHome = paceApplied?Math.max(0,candidate.home+homeAdjustment):score(home,away,homeAdjustment,true);
    const lineup=adjustments.lineup;
    const lineupValid=lineup?.applied&&lineup.gameId===String(game.id)&&lineup.kickoff===game.kickoff;
    const lineupAway=lineupValid?lineup.teams?.[game.awayId]?.points??0:0;
    const lineupHome=lineupValid?lineup.teams?.[game.homeId]?.points??0:0;
    if(![lineupAway,lineupHome].every(v=>Number.isFinite(v)&&Math.abs(v)<=8))return {available:false,reason:'Invalid lineup score scenario.'};
    const preVenueAway = Math.max(0,preInjuryAway+lineupAway-injury.awayOffense+injury.homeDefense);
    const preVenueHome = Math.max(0,preInjuryHome+lineupHome-injury.homeOffense+injury.awayDefense);
    injury.applied = Object.values(injury).some(value => value > 0);
    injury.awayChange = Math.max(0,preInjuryAway-injury.awayOffense+injury.homeDefense)-preInjuryAway;
    injury.homeChange = Math.max(0,preInjuryHome-injury.homeOffense+injury.awayDefense)-preInjuryHome;
    // Transfer half the margin between teams; cap at away score to preserve total and nonnegativity.
    const transfer = Math.min(venue.margin / 2,preVenueAway);
    venue.appliedMargin = transfer * 2;
    const preWeatherAway = preVenueAway-transfer, preWeatherHome = preVenueHome+transfer;
    const weather = weatherEffect(game,adjustments.forecast,adjustments.weatherEnabled,adjustments.now);
    return {available:true,away:preWeatherAway*(1-weather.reduction),home:preWeatherHome*(1-weather.reduction),
      weather,preWeatherAway,preWeatherHome,
      injury,lineup:{applied:lineupValid,awayChange:lineupAway,homeChange:lineupHome},preInjuryAway,preInjuryHome,
      preVenueAway,preVenueHome,venue,
      unadjustedAway:score(away,home,awayAdjustment,false),unadjustedHome:score(home,away,homeAdjustment,false),
      schedule:{applied:scheduleApplied,away:awaySchedule,home:homeSchedule},
      baseline,awayGames:away.games,homeGames:home.games,
      pace,modelVersion:legacy?'scoring-v1':paceApplied?'pace-v1':'scoring-v2',calibration:paceApplied?data.paceValidation?.calibration||null:data.validation?.calibration || null,
      probabilityCalibration:!legacy&&!paceApplied&&!injury.applied&&!weather.applied&&!awayAdjustment&&!homeAdjustment&&!adjustments.lineup?.applied&&(!adjustments.venueMode||adjustments.venueMode==='auto')&&
        data.validation?.probabilityCalibration?.before===game.kickoff&&String(data.validation.probabilityCalibration.league)===String(game.league)&&String(data.validation.probabilityCalibration.season)===String(game.season)?data.validation.probabilityCalibration:null};
  }
  function simulate(prediction, spread, total, runs = 50000, random = Math.random) {
    if (!prediction.available || ![prediction.away,prediction.home,spread,total].every(Number.isFinite) || total <= 0 || !Number.isInteger(runs) || runs < 1)
      throw new Error('Valid projected scores, lines and run count required.');
    const normal = () => Math.sqrt(-2 * Math.log(Math.max(Number.EPSILON,random()))) * Math.cos(2*Math.PI*random());
    const fit=prediction.calibration;
    const fitted=fit?.modelVersion===(prediction.modelVersion||'scoring-v2') && fit.games>=30 &&
      [fit.awaySD,fit.homeSD,fit.correlation].every(Number.isFinite) &&
      fit.awaySD>=3 && fit.awaySD<=30 && fit.homeSD>=3 && fit.homeSD<=30 && Math.abs(fit.correlation)<=.8;
    const awaySD=fitted?fit.awaySD:Math.sqrt(7.5**2+4**2);
    const homeSD=fitted?fit.homeSD:awaySD;
    const correlation=fitted?fit.correlation:4**2/(7.5**2+4**2);
    // Flooring a normal centered on a low projection inflates its average.
    // Find a location whose nonnegative continuous mean matches the projection.
    const cdf=x=>{
      const t=1/(1+.2316419*Math.abs(x));
      const tail=Math.exp(-x*x/2)/Math.sqrt(2*Math.PI)*t*(.319381530+t*(-.356563782+t*(1.781477937+t*(-1.821255978+t*1.330274429))));
      return x>=0?1-tail:tail;
    };
    const location=(mean,sd)=>{
      if(mean<=0)return -Infinity;
      let low=-12*sd,high=mean;
      for(let i=0;i<40;i++) {
        const mid=(low+high)/2,z=mid/sd;
        const censoredMean=sd*Math.exp(-z*z/2)/Math.sqrt(2*Math.PI)+mid*cdf(z);
        if(censoredMean>mean)high=mid;else low=mid;
      }
      return (low+high)/2;
    };
    const awayLocation=location(prediction.away,awaySD),homeLocation=location(prediction.home,homeSD);
    let covers=0,overs=0,wins=0,spreadPushes=0,totalPushes=0,ties=0,awaySum=0,homeSum=0;
    for (let i=0;i<runs;i++) {
      const z=normal(),other=normal();
      const away=Math.max(0,Math.round(awayLocation+z*awaySD));
      const home=Math.max(0,Math.round(homeLocation+(correlation*z+Math.sqrt(1-correlation**2)*other)*homeSD));
      awaySum+=away;homeSum+=home;
      if (away+spread>home) covers++;
      if (away+spread===home) spreadPushes++;
      if (away+home>total) overs++;
      if (away+home===total) totalPushes++;
      if (away>home) wins++;
      if (away===home) ties++;
    }
    const calibration=prediction.probabilityCalibration?.modelVersion==='scoring-v2'?prediction.probabilityCalibration:null;
    const conditional={win:wins/(runs-ties),cover:covers/(runs-spreadPushes),over:overs/(runs-totalPushes)};
    const calibrated=Object.fromEntries(['win','cover','over'].map(key=>[key,probability?.apply(conditional[key],calibration?.[key])??null]));
    return {calibrated,conditional,cover:covers/runs,over:overs/runs,win:wins/runs,spreadPush:spreadPushes/runs,totalPush:totalPushes/runs,tie:ties/runs,
      varianceSource:fitted?'Earlier held-out score errors':'Default uncalibrated variance',meanAway:awaySum/runs,meanHome:homeSum/runs};
  }
  const model={project,simulate,venueEffect,weatherEffect};
  if (typeof module !== 'undefined' && module.exports) module.exports=model;
  else root.Unit501TeamModel=model;
})(typeof globalThis !== 'undefined' ? globalThis : this);
