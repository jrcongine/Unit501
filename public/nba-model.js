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
 const api={project,version};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.Unit501NBAModel=api;
})(typeof window!=='undefined'?window:globalThis);
