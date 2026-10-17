/* Small optional market scenario, not a fitted probability or verified sharp feed. */
(function(root){
 'use strict';
 function evaluate(report,game,awaySpread,enabled=true,now=Date.now()){
  const result={applied:false,margin:0,reason:'No split adjustment.',lean:null};
  if(!enabled)return {...result,reason:'Split adjustment off.'};
  if(!report?.available||String(report.gameId)!==String(game?.id)||String(report.league)!==String(game?.league)||String(report.season)!==String(game?.season)||report.kickoff!==game.kickoff||game.kickoff<=now||game.kickoff>now+7*86400000||!Number.isFinite(report.fetchedAt)||report.fetchedAt>now||now-report.fetchedAt>300000)return {...result,reason:'Waiting for fresh splits.'};
  const s=report.spread;
  if(!s||!['awayBets','homeBets','awayMoney','homeMoney'].every(k=>Number.isFinite(s[k])&&s[k]>=0&&s[k]<=100)||Math.abs(s.awayBets+s.homeBets-100)>1||Math.abs(s.awayMoney+s.homeMoney-100)>1)return {...result,reason:'Complete bet and money percentages needed.'};
  const gap=s.homeMoney-s.homeBets;
  if(Math.abs(gap)>=10&&((gap>0&&s.homeMoney>50)||(gap<0&&s.awayMoney>50)))result.lean=gap>0?'home':'away';
  if(!Number.isFinite(awaySpread)||s.awayLine!==awaySpread||s.homeLine!==-awaySpread)return {...result,reason:'Different spread—no adjustment.'};
  // A refresh timestamp alone cannot establish the freshness of source numbers.
  if(!Number.isFinite(report.sourceAt)||report.sourceAt>now||now-report.sourceAt>1800000)return {...result,reason:'Source time unverified—display only.'};
  if(!result.lean)return result;
  result.margin=Math.sign(gap)*Math.min(.5,(Math.abs(gap)-5)/100);
  result.applied=true;result.reason='Experimental money-vs-bets lean; maximum 0.5 point to the margin.';
  return result;
 }
 const api={evaluate};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.Unit501BettingSplitsModel=api;
})(typeof globalThis!=='undefined'?globalThis:this);
