/* Scope complete snapshots without changing archived forecasts or results. */
(function(root){
 'use strict';
 function dateKey(timestamp){
  if(!Number.isFinite(timestamp))return '';
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(timestamp).map(p=>[p.type,p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
 }
 function filter(snapshots,filters={}){
  return snapshots.filter(snapshot=>{
   const records=snapshot.records||[];
   if(filters.from||filters.to){
    const date=dateKey(snapshot.game?.kickoff);
    if(!date||(filters.from&&date<filters.from)||(filters.to&&date>filters.to))return false;
   }
   return records.length>0&&records.every(record=>
    ['league','season','modelVersion'].every(key=>
     !filters[key]||String(record[key])===String(filters[key])));
  });
 }
 function diagnosis(metric){
  if(!metric.games||!Number.isFinite(metric.adjustedBias))return 'Awaiting final outcomes';
  const direction=Math.abs(metric.adjustedBias)<0.005?'No net bias':metric.adjustedBias>0?'Running high':'Running low';
  return `${direction}${direction==='No net bias'?'':` by ${Math.abs(metric.adjustedBias).toFixed(2)} on average`} · ${metric.games<30?'small sample; insufficient evidence':'observed sample only'}`;
 }
 function report(snapshots,filters,audit,generatedAt=Date.now()){
  return {schema:1,generatedAt:new Date(generatedAt).toISOString(),timezone:'America/Chicago',filters:{...filters},
   snapshots:snapshots.length,forecastSnapshots:snapshots.filter(s=>!s.selection).length,selectedPickSnapshots:snapshots.filter(s=>s.selection).length,
   accuracy:audit,note:'Forecast accuracy excludes selected picks. Dates refer to game kickoff in America/Chicago. Browser-local history only; not reconstructed season history. Descriptive errors are not betting profit or proof of future accuracy.'};
 }
 function latestDay(snapshots,compare,selectionResult){
  // The latest game day with at least one recorded final statistic. No historical reconstruction.
  const completed=snapshots.filter(s=>!s.selection&&Array.isArray(s.records)&&
    s.records.some(r=>Number.isFinite(r?.actual)&&Number.isFinite(r?.resultKnownAt)));
  const dates=completed.map(s=>dateKey(s.game?.kickoff)).filter(Boolean).sort();
  if(!dates.length)return null;
  const date=dates[dates.length-1];
  const scoped=snapshots.filter(s=>dateKey(s.game?.kickoff)===date);
  const audit=compare(scoped.filter(s=>!s.selection).flatMap(s=>s.records||[]));
  const markets=[];
  for(const league of ['1','2']){
   const values=[['Team points',audit.scores[league]],
     ...Object.entries(audit.props[league]).map(([market,m])=>[market,m])];
   for(const [market,m] of values)if(m.games)markets.push({
    league,market,games:m.games,targets:m.pairs,pending:m.pending,
    averageMiss:m.adjustedMAE,bias:m.adjustedBias,baselineMiss:m.baselineMAE
   });
  }
  const pickStats={wins:0,losses:0,pushes:0,pending:0};
  for(const snap of scoped.filter(s=>s.selection)){
   const outcome=selectionResult(snap);
   if(outcome==='Win by statistic')pickStats.wins++;
   else if(outcome==='Loss by statistic')pickStats.losses++;
   else if(outcome==='Push by statistic')pickStats.pushes++;
   else pickStats.pending++;
  }
  return {date,matchedTargets:audit.accepted,excluded:audit.skips,markets,selected:pickStats};
 }
 function upsetHistory(snapshots,now=Date.now()){
  const compare=typeof module!=='undefined'&&module.exports?require('./injury-backtest').compare:root.Unit501InjuryBacktest.compare;
  const candidates=snapshots.filter(s=>!s.selection&&(!s.kind||s.kind==='score'));
  const key=s=>JSON.stringify([s.game?.league,s.game?.season,s.game?.id].map(String));
  const counts=new Map();for(const s of candidates)counts.set(key(s),(counts.get(key(s))||0)+1);
  const groups=new Map();let excluded=0,missingLine=0,pickem=0;
  for(const s of candidates){
   const g=s.game,rs=s.records,line=s.inputs?.marketContext?.awaySpread;
   if(counts.get(key(s))!==1||!g||!Array.isArray(rs)||rs.length!==2||
     !Number.isFinite(s.forecastAt)||s.forecastAt>now||s.forecastAt>=g.kickoff||
     String(g.awayId)===String(g.homeId)||rs.some(r=>!r||r.kind!=='score'||
      String(r.gameId)!==String(g.id)||String(r.league)!==String(g.league)||String(r.season)!==String(g.season)||
      r.forecastAt!==s.forecastAt||r.kickoff!==g.kickoff||
      (r.resultKnownAt!==null&&r.resultKnownAt>now))){excluded++;continue;}
   const away=rs.find(r=>String(r.teamId)===String(g.awayId)),home=rs.find(r=>String(r.teamId)===String(g.homeId));
   if(!away||!home||away.modelVersion!==home.modelVersion){excluded++;continue;}
   const check=compare(rs);
   if(check.skips.invalid||check.skips.late||check.skips.ambiguous||check.skips.version||check.accepted+check.skips.pending!==2){excluded++;continue;}
   if(!Number.isFinite(line)||!Number.isInteger(line*2)){missingLine++;continue;}
   if(line===0){pickem++;continue;}
   const groupKey=JSON.stringify([String(g.league),String(g.season),away.modelVersion]);
   if(!groups.has(groupKey))groups.set(groupKey,{league:String(g.league),season:String(g.season),modelVersion:away.modelVersion,
    forecasts:0,projectedUpsets:0,pending:0,completed:0,actualUpsets:0,calledUpsets:0,missedUpsets:0,falseAlarms:0,actualTies:0});
   const out=groups.get(groupKey),sign=line>0?1:-1;
   const predicted=(away.adjusted-home.adjusted)*sign>0;
   out.forecasts++;if(predicted)out.projectedUpsets++;
   if(check.skips.pending){out.pending++;continue;}
   out.completed++;
   const margin=(away.actual-home.actual)*sign;
   if(margin===0){out.actualTies++;continue;}
   if(margin>0){out.actualUpsets++;if(predicted)out.calledUpsets++;else out.missedUpsets++;}
   else if(predicted)out.falseAlarms++;
  }
  return {groups:[...groups.values()],excluded,missingLine,pickem};
 }
 const api={filter,dateKey,diagnosis,report,latestDay,upsetHistory};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 else root.Unit501ForecastDashboard=api;
})(typeof globalThis!=='undefined'?globalThis:this);
