'use strict';
const model=require('./public/team-model');
const probability=require('./public/probability-calibration');
const mean=a=>a.reduce((s,v)=>s+v,0)/a.length;
// Average within each game first, so non-push threshold counts cannot change its weight.
function probabilitySummary(rows) {
 const groups=new Map();
 for(const row of rows){if(!groups.has(row.id))groups.set(row.id,[]);groups.get(row.id).push(row);}
 const average=key=>groups.size?mean([...groups.values()].map(game=>mean(game.map(r=>r[key])))):null;
 return {games:groups.size,thresholds:rows.length,brier:average('brier'),rawBrier:average('rawBrier')};
}
function fit(errors) {
  if(errors.length<30)return null;
  // RMS includes systematic error rather than hiding bias by centering residuals.
  const awaySD=Math.max(3,Math.min(30,Math.sqrt(mean(errors.map(e=>e.away**2)))));
  const homeSD=Math.max(3,Math.min(30,Math.sqrt(mean(errors.map(e=>e.home**2)))));
  const correlation=Math.max(-.8,Math.min(.8,mean(errors.map(e=>e.away*e.home))/(awaySD*homeSD)));
  return {modelVersion:'scoring-v2',games:errors.length,awaySD,homeSD,correlation};
}
function validate(games,query,snapshot) {
  const ordered=[...new Map(games.filter(g=>Number(g.game?.date?.timestamp)>0&&Number(g.game.date.timestamp)*1000<query.before&&String(g.league?.id)===String(query.league)&&String(g.league?.season)===String(query.season)&&['FT','AOT','FINAL'].includes(g.game?.status?.short)&&(query.league!=='1'||g.game?.stage==='Regular Season'))
    .map(g=>[String(g.game?.id),g])).values()].sort((a,b)=>a.game.date.timestamp-b.game.date.timestamp);
  const errors=[],records=[];
  const training={win:[],cover:[],over:[]};
  const probabilityChecks={win:[],cover:[],over:[]};
  const bins=Array.from({length:10},(_,i)=>({lower:i/10,upper:(i+1)/10,games:0,predicted:0,observed:0}));
  let skipped=0;
  // Freeze training at each kickoff: simultaneous results never leak into each other.
  for(let start=0;start<ordered.length;) {
    let end=start+1;
    const before=ordered[start].game.date.timestamp*1000;
    while(end<ordered.length && ordered[end].game.date.timestamp*1000===before)end++;
    const historyBefore=before-86400000;
    const data={...snapshot(historyBefore),before,historyBefore},calibration=fit(errors.filter(e=>e.kickoff<historyBefore)),batch=[];
    const probabilityFit=Object.fromEntries(Object.entries(training).map(([key,rows])=>[key,probability.fit(rows.filter(r=>r.kickoff<historyBefore))]));
    const probabilityBatch={win:[],cover:[],over:[]};
    for(const g of ordered.slice(start,end)) {
      const away=g.teams?.away||g.teams?.visitors,home=g.teams?.home;
      const game={league:query.league,season:query.season,kickoff:before,awayId:String(away?.id),homeId:String(home?.id),venueName:g.game?.venue?.name};
      const prediction=model.project(data,game);
      const numeric=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
      if(!prediction.available||!numeric(g.scores?.away?.total)||!numeric(g.scores?.home?.total)){skipped++;continue;}
      const actualAway=Number(g.scores.away.total),actualHome=Number(g.scores.home.total);
      const error={away:actualAway-prediction.away,home:actualHome-prediction.home,kickoff:before};
      const legacy=model.project(data,game,{},true);
      batch.push(error);
      const record={id:String(g.game.id),kickoff:before,historyBefore,awayId:game.awayId,homeId:game.homeId,
        projectedAway:prediction.away,projectedHome:prediction.home,actualAway,actualHome,...error,
        leagueBaseline:prediction.baseline,awayPriorScoring:data.teams.find(t=>String(t.id)===game.awayId)?.metrics.pointsFor.average,homePriorScoring:data.teams.find(t=>String(t.id)===game.homeId)?.metrics.pointsFor.average,
        legacyAwayError:actualAway-legacy.away,legacyHomeError:actualHome-legacy.home};
      if(calibration) {
        let seed=123;
        const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
        const simulate=(spread,total)=>{
          seed=123;
          return model.simulate({...prediction,calibration},spread,Math.max(1,total),2000,random);
        };
        const check=(market,p,y)=>{
          if(y===null||!Number.isFinite(p))return;
          const calibrated=probability.apply(p,probabilityFit[market]);
          probabilityBatch[market].push({id:record.id,kickoff:before,p,y});
          if(calibrated!==null)probabilityChecks[market].push({id:record.id,kickoff:before,p,calibrated,y,brier:(calibrated-y)**2,rawBrier:(p-y)**2});
        };
        const result=simulate(0,prediction.away+prediction.home);
        const p=result.win/(1-result.tie);
        const observed=actualAway===actualHome?null:actualAway>actualHome?1:0;
        if(observed!==null&&Number.isFinite(p)){
          record.winFrequency=p;record.observedWin=observed;record.brier=(p-observed)**2;
          record.calibratedWin=probability.apply(p,probabilityFit.win);
          const bin=bins[Math.min(9,Math.floor(p*10))];bin.games++;bin.predicted+=p;bin.observed+=observed;
        }
        check('win',p,observed);
        // Reference thresholds are model-centered, not historical bookmaker lines.
        // Each game's three thresholds together have one game's fitting weight.
        for(const offset of [-7,0,7]){
          const spread=Math.round((prediction.home-prediction.away+offset)*2)/2;
          const total=Math.max(.5,Math.round((prediction.away+prediction.home+offset)*2)/2);
          const sim=simulate(spread,total);
          check('cover',sim.cover/(1-sim.spreadPush),actualAway+spread===actualHome?null:actualAway+spread>actualHome?1:0);
          check('over',sim.over/(1-sim.totalPush),actualAway+actualHome===total?null:actualAway+actualHome>total?1:0);
        }
      }
      records.push(record);
    }
    errors.push(...batch);
    for(const key of Object.keys(training))training[key].push(...probabilityBatch[key]);
    start=end;
  }
  // Keep a later-game comparison separate from the full replay; freeze the split by kickoff.
  const warmupCutoff=records.length>=30?records[29].kickoff:Infinity;
  const later=records.filter(r=>r.kickoff>warmupCutoff);
  const comparison=rows=>rows.length?{
    scoreMAE:mean(rows.map(r=>(Math.abs(r.away)+Math.abs(r.home))/2)),
    marginMAE:mean(rows.map(r=>Math.abs(r.home-r.away))),
    totalMAE:mean(rows.map(r=>Math.abs(r.home+r.away))),
    totalBias:mean(rows.map(r=>-(r.home+r.away)))
  }:null;
  const laterComparison={warmupGames:records.length-later.length,games:later.length,
    current:comparison(later),previous:comparison(later.map(r=>({away:r.legacyAwayError,home:r.legacyHomeError}))),
    sufficient:later.length>=30,
    explanation:'Fixed formulas compared on games after the first 30 eligible predictions; all games at the warm-up boundary kickoff stay in warm-up. This is an in-season comparison, not independent future validation or evidence of betting profit.'};
  const diagnose=rows=>{
    const groups={belowAverage:[],atOrAboveAverage:[]};
    for(const r of rows)for(const side of ['away','home']){
      const prior=r[side+'PriorScoring'];if(!Number.isFinite(prior)||!Number.isFinite(r.leagueBaseline))continue;
      groups[prior<r.leagueBaseline?'belowAverage':'atOrAboveAverage'].push({id:r.id,error:r[side],legacyError:r[side==='away'?'legacyAwayError':'legacyHomeError']});
    }
    return Object.fromEntries(Object.entries(groups).map(([key,rows])=>[key,{teamGames:rows.length,games:new Set(rows.map(r=>r.id)).size,
      scoreMAE:rows.length?mean(rows.map(r=>Math.abs(r.error))):null,bias:rows.length?mean(rows.map(r=>-r.error)):null,
      legacyScoreMAE:rows.length?mean(rows.map(r=>Math.abs(r.legacyError))):null,legacyBias:rows.length?mean(rows.map(r=>-r.legacyError)):null}]));
  };
  const offenseDiagnostics={overall:diagnose(records),later:diagnose(later),
    explanation:'Groups use each team’s recorded scoring average before kickoff relative to that replay’s league scoring baseline. Positive bias means projected points exceeded actual points. Counts are team-games; two teams from the same matchup are not independent observations. These diagnostics do not tune the scoring formula.'};
  const trainingBefore=query.before-86400000;
  const checksForActivation=Object.fromEntries(Object.entries(probabilityChecks).map(([key,rows])=>[key,probabilitySummary(rows.filter(r=>r.kickoff<trainingBefore))]));
  const evaluated=records.filter(r=>Number.isFinite(r.brier));
  return {modelVersion:'scoring-v2',games:records.length,skipped,laterComparison,offenseDiagnostics,probabilityGames:evaluated.length,
    scoreMAE:errors.length?mean(errors.map(e=>(Math.abs(e.away)+Math.abs(e.home))/2)):null,
    marginMAE:errors.length?mean(errors.map(e=>Math.abs(e.home-e.away))):null,
    totalMAE:errors.length?mean(errors.map(e=>Math.abs(e.home+e.away))):null,
    totalBias:errors.length?mean(errors.map(e=>-(e.home+e.away))):null,
    legacy:records.length?{
      scoreMAE:mean(records.map(r=>(Math.abs(r.legacyAwayError)+Math.abs(r.legacyHomeError))/2)),
      marginMAE:mean(records.map(r=>Math.abs(r.legacyHomeError-r.legacyAwayError))),
      totalMAE:mean(records.map(r=>Math.abs(r.legacyHomeError+r.legacyAwayError)))
    }:null,
    brier:evaluated.length?mean(evaluated.map(r=>r.brier)):null,
    bins:bins.map(b=>({...b,predicted:b.games?b.predicted/b.games:null,observed:b.games?b.observed/b.games:null})),
    calibration:fit(errors.filter(e=>e.kickoff<trainingBefore)),records,
    probabilityCalibration:{modelVersion:'scoring-v2',league:query.league,season:query.season,before:query.before,
      ...Object.fromEntries(Object.entries(training).map(([key,rows])=>{const check=checksForActivation[key];const fitted=probability.fit(rows.filter(r=>r.kickoff<trainingBefore));const eligible=fitted&&check.games>=30&&check.brier<check.rawBrier;return [key,eligible?{...fitted,evaluationGames:check.games}:null];}))},
    probabilityChecks:Object.fromEntries(Object.entries(probabilityChecks).map(([key,rows])=>[key,{
      ...probabilitySummary(rows),
      activation:checksForActivation[key],
      bins:Array.from({length:10},(_,i)=>{const bin=rows.filter(r=>Math.min(9,Math.floor(r.calibrated*10))===i);return {lower:i/10,upper:(i+1)/10,games:new Set(bin.map(r=>r.id)).size,thresholds:bin.length,predicted:bin.length?mean(bin.map(r=>r.calibrated)):null,observed:bin.length?mean(bin.map(r=>r.y)):null};})
    }])),
    explanation:'Chronological replay excludes results from the previous 24 hours before each kickoff, including score-error and probability training. Completion timestamps are unavailable; this conservative lag limits overlap leakage but is not an exact archive of when results were published. Variance fits earlier score errors after 30 predictions. Symmetric probability calibration trains after 100 distinct earlier evaluated games with both outcomes, and is checked on later games. Calibration is activated only after at least 30 later distinct games have lower game-weighted Brier error than raw frequencies; this is a rolling in-season gate, not an independent future guarantee. Exported calibration and activation checks also exclude the most recent 24 hours. Brier comparisons average thresholds within each game before averaging games. Reliability bins describe individual thresholds. Spread/total checks use three model-centered reference thresholds per game, not sportsbook history. Pushes and tied finals are excluded from probability fitting; displayed probabilities are conditional on no push/tie. Weather and historical injuries are unavailable. No historical bookmaker lines: spread/total profitability and prop calibration are not measured.'};
}
module.exports={fit,validate,probabilitySummary};
