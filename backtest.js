'use strict';
const model=require('./public/team-model');
const mean=a=>a.reduce((s,v)=>s+v,0)/a.length;
function fit(errors) {
  if(errors.length<30)return null;
  // RMS includes systematic error rather than hiding bias by centering residuals.
  const awaySD=Math.max(3,Math.min(30,Math.sqrt(mean(errors.map(e=>e.away**2)))));
  const homeSD=Math.max(3,Math.min(30,Math.sqrt(mean(errors.map(e=>e.home**2)))));
  const correlation=Math.max(-.8,Math.min(.8,mean(errors.map(e=>e.away*e.home))/(awaySD*homeSD)));
  return {modelVersion:'scoring-v2',games:errors.length,awaySD,homeSD,correlation};
}
function validate(games,query,snapshot) {
  const ordered=[...new Map(games.filter(g=>Number(g.game?.date?.timestamp)*1000<query.before)
    .map(g=>[String(g.game?.id),g])).values()].sort((a,b)=>a.game.date.timestamp-b.game.date.timestamp);
  const errors=[],records=[];
  const bins=Array.from({length:10},(_,i)=>({lower:i/10,upper:(i+1)/10,games:0,predicted:0,observed:0}));
  let skipped=0;
  // Freeze training at each kickoff: simultaneous results never leak into each other.
  for(let start=0;start<ordered.length;) {
    let end=start+1;
    const before=ordered[start].game.date.timestamp*1000;
    while(end<ordered.length && ordered[end].game.date.timestamp*1000===before)end++;
    const data=snapshot(before),calibration=fit(errors),batch=[];
    for(const g of ordered.slice(start,end)) {
      const away=g.teams?.away||g.teams?.visitors,home=g.teams?.home;
      const game={league:query.league,season:query.season,kickoff:before,awayId:String(away?.id),homeId:String(home?.id),venueName:g.game?.venue?.name};
      const prediction=model.project(data,game);
      const numeric=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
      if(!prediction.available||!numeric(g.scores?.away?.total)||!numeric(g.scores?.home?.total)){skipped++;continue;}
      const actualAway=Number(g.scores.away.total),actualHome=Number(g.scores.home.total);
      const error={away:actualAway-prediction.away,home:actualHome-prediction.home};
      const legacy=model.project(data,game,{},true);
      batch.push(error);
      const record={id:String(g.game.id),kickoff:before,awayId:game.awayId,homeId:game.homeId,
        projectedAway:prediction.away,projectedHome:prediction.home,actualAway,actualHome,...error,
        legacyAwayError:actualAway-legacy.away,legacyHomeError:actualHome-legacy.home};
      if(calibration) {
        let seed=123;
        const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
        const p=model.simulate({...prediction,calibration},0,Math.max(1,prediction.away+prediction.home),2000,random).win;
        const observed=actualAway>actualHome?1:0;
        record.winFrequency=p;record.observedWin=observed;record.brier=(p-observed)**2;
        const bin=bins[Math.min(9,Math.floor(p*10))];bin.games++;bin.predicted+=p;bin.observed+=observed;
      }
      records.push(record);
    }
    errors.push(...batch);start=end;
  }
  const evaluated=records.filter(r=>Number.isFinite(r.brier));
  return {modelVersion:'scoring-v2',games:records.length,skipped,probabilityGames:evaluated.length,
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
    calibration:fit(errors),records,
    explanation:'Chronological replay uses only results before each kickoff. Variance fits earlier score errors after 30 predictions; win bins are evaluated on later games. Weather and historical injuries are unavailable. No historical bookmaker lines: spread/total profitability and prop calibration are not measured.'};
}
module.exports={fit,validate};
