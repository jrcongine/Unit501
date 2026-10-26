(function(root){
 'use strict';
 const version='nba-scoring-baseline-v1';
 const round=n=>Math.round(n*10)/10;
 function project(game,data,scope='recent5',now=Date.now()){
  const unavailable=reason=>({available:false,version,reason});
  if(!game||game.statusCode!==1||!Number.isFinite(Date.parse(game.tipoff))||Date.parse(game.tipoff)<=now)
   return unavailable('Pregame estimates only. This game has started or its status is unverified.');
  if(!data||String(data.gameId)!==String(game.id)||data.tipoff!==game.tipoff||data.stage!==game.stage||
    data.away?.id!==game.awayId||data.home?.id!==game.homeId)
   return unavailable('Team history does not match this matchup. Reload the slate.');
  if(!['season','recent5','recent10','venue'].includes(scope))return unavailable('Choose a supported form window.');
  const sides=[data.away,data.home];
  if(sides.some(s=>!s.available||s.coverage?.conflictingGames>0))
   return unavailable('Missing or conflicting team results. Estimate withheld.');
  const records=sides.map((s,i)=>scope==='venue'?s[i===0?'awaySplit':'homeSplit']:s[scope]);
  if(records.some(r=>!r||!Number.isInteger(r.games)||r.games<3))
   return unavailable('Need at least 3 completed games per team in this view. Try Season or Last 10.');
  if(records.some(r=>![r.pointsFor,r.pointsAgainst].every(n=>Number.isFinite(n)&&n>0)))
   return unavailable('Scoring history is incomplete. Estimate withheld.');
  // Equal-weight offensive average and opponent defensive average. No fitted coefficients.
  const [a,h]=records,away=round((a.pointsFor+h.pointsAgainst)/2),home=round((h.pointsFor+a.pointsAgainst)/2);
  return {available:true,version,scope,away,home,total:round(away+home),homeSpread:round(away-home),
   awayGames:a.games,homeGames:h.games,thin:Math.min(a.games,h.games)<10,
   explanation:'Each score averages the team’s scoring and its opponent’s points allowed in the selected view. Experimental; no calibrated win probability. Injuries, minutes, pace and rest are not adjusted. Returned-history coverage is not independently verified.'};
 }
 // Research simulation from the most recent completed team-game scores.
 // Samples offensive/defensive deviations independently; no calibration is implied.
 function simulate(estimate,data,lines={},runs=10000,random=Math.random){
  if(!estimate?.available||![estimate.away,estimate.home].every(Number.isFinite)||
     !Number.isInteger(runs)||runs<1||runs>100000||typeof random!=='function')return {available:false,reason:'Valid score estimate required.'};
  const histories=[data?.away?.recentGames,data?.home?.recentGames];
  if(histories.some(list=>!Array.isArray(list)||list.length<5||list.length>10||list.some(g=>
     ![g.for,g.against].every(v=>Number.isFinite(v)&&v>=0))))
   return {available:false,reason:'At least five complete recent games per team are needed for the simulation.'};
  const samples=histories.map(list=>{
   const means=['for','against'].map(key=>list.reduce((a,g)=>a+g[key],0)/list.length);
   return list.map(g=>({off:g.for-means[0],def:g.against-means[1]}));
  });
  const hasSpread=Number.isFinite(lines.awaySpread),hasTotal=Number.isFinite(lines.total)&&lines.total>0;
  let awayWins=0,homeWins=0,ties=0,awayCovers=0,homeCovers=0,spreadPushes=0,overs=0,unders=0,totalPushes=0;
  const pick=list=>{const value=random();if(!Number.isFinite(value)||value<0||value>=1)throw Error('Invalid random sample');return list[Math.floor(value*list.length)];};
  for(let i=0;i<runs;i++){
   const away=Math.max(0,Math.round(estimate.away+(pick(samples[0]).off+pick(samples[1]).def)/Math.SQRT2));
   const home=Math.max(0,Math.round(estimate.home+(pick(samples[1]).off+pick(samples[0]).def)/Math.SQRT2));
   if(away>home)awayWins++;else if(home>away)homeWins++;else ties++;
   if(hasSpread){const margin=away+lines.awaySpread-home;if(margin>0)awayCovers++;else if(margin<0)homeCovers++;else spreadPushes++;}
   if(hasTotal){const diff=away+home-lines.total;if(diff>0)overs++;else if(diff<0)unders++;else totalPushes++;}
  }
  const ratio=n=>n/runs;
  return {available:true,runs,awayWin:ratio(awayWins),homeWin:ratio(homeWins),tie:ratio(ties),
   spread:hasSpread?{away:ratio(awayCovers),home:ratio(homeCovers),push:ratio(spreadPushes),line:lines.awaySpread}:null,
   total:hasTotal?{over:ratio(overs),under:ratio(unders),push:ratio(totalPushes),line:lines.total}:null,
   sampleGames:histories.map(list=>list.length)};
 }
 const api={project,simulate,version};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.Unit501NBAModel=api;
})(typeof window!=='undefined'?window:globalThis);
