(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.Unit501Pregame=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const stamp=v=>typeof v==='number'?v:typeof v==='string'?Date.parse(v):NaN;
 const fresh=(at,ttl,now)=>Number.isFinite(stamp(at))&&stamp(at)<=now&&now-stamp(at)<=ttl;
 const same=(report,game)=>String(report?.gameId)===String(game.id)&&report?.kickoff===game.kickoff;
 function evaluate({game,availability,quotes,inputs={},now=Date.now()}={}){
  if(!game||!Number.isFinite(game.kickoff))return {active:false,checks:[]};
  if(now>=game.kickoff)return {active:false,checks:[],message:'Kickoff reached. Pregame checks no longer apply.'};
  const checks=[],add=(id,label,status,message)=>checks.push({id,label,status,message});
  for(const [id,label,value,at] of [['spread','Spread',quotes?.awaySpread,quotes?.spreadUpdated],['total','Total',quotes?.total,quotes?.totalUpdated]]){
   const input=inputs[id];
   if(!Number.isFinite(value)){add(id,label,'unknown','No verified FanDuel quote loaded.');continue;}
   if(!fresh(at,1800000,now)){add(id,label,'review','Quote expired or timestamp unverified. Refresh lines.');continue;}
   if(input!==undefined&&(input===null||!Number.isFinite(input)||input!==value)){add(id,label,'review','Entered line differs from the loaded FanDuel quote.');continue;}
   add(id,label,'checked','Loaded FanDuel quote is within 30 minutes.');
  }
  const teams=[game.awayId,game.homeId].map(id=>{
   const found=(availability?.teams||[]).filter(t=>String(t.id)===String(id));return found.length===1?found[0]:null;
  });
  const current=availability?.current===true&&teams.every(Boolean)&&String(game.awayId)!==String(game.homeId);
  const rosters=current&&teams.every(t=>t.roster?.available&&t.roster.rows?.length&&fresh(t.roster.checkedAt,3600000,now));
  add('rosters','Team rosters',rosters?'checked':'unknown',rosters?'Both provider rosters checked within one hour.':'Missing or expired roster coverage. Refresh injuries.');
  const reports=current&&teams.every(t=>t.official?.available&&same(t.official,game)&&fresh(t.official.checkedAt,900000,now)||t.injuries?.available&&fresh(t.injuries.checkedAt,900000,now));
  add('injuries','Injury reports',reports?'checked':'unknown',reports?'Both reports checked within 15 minutes; missing names do not confirm availability.':'Missing or expired injury coverage. Refresh injuries.');
  const announcements=current?teams.reduce((count,t)=>count+(same(t.starters,game)&&fresh(t.starters.checkedAt,900000,now)&&t.starters.rows?.some(r=>fresh(r.publishedAt,7*86400000,now))?1:0),0):0;
  add('starters','Starting lineup','unknown',announcements?announcements+' team(s) have recent starter announcements. Full starting lineups and workloads remain unconfirmed.':'Full starting lineups have not been confirmed.');
  const conflicts=current&&((availability.rosterOwnership?.conflicts?.length||0)>0||teams.some(t=>t.transactions?.unverified>0||t.official?.unmatched>0||t.inactives?.unmatched>0));
  const ownership=availability?.rosterOwnership;
  const ownershipChecked=current&&game.league==='1'&&ownership?.available&&ownership.complete&&String(ownership.league)===String(game.league)&&String(ownership.season)===String(game.season)&&fresh(ownership.checkedAt,3600000,now);
  const moves=current&&teams.some(t=>t.transactions?.rows?.length);
  add('changes','Roster changes',conflicts||moves?'review':'unknown',conflicts?'Conflicting identities or unverified reports need review.':moves?'Reviewed moves are listed in Injury watch. Verify current team and replacement role.':ownershipChecked?'League ownership checked; complete trade and lineup-change coverage is not confirmed.':'Complete trade and lineup-change coverage is not confirmed.');
  return {active:true,checks,message:'Checks apply to the selected matchup and loaded data. They do not certify a pick.'};
 }
 return {evaluate};
});
