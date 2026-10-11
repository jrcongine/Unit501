'use strict';
// Positive duplicate ownership evidence from current NFL provider rosters.
function createRosterOwnership(read,now=Date.now){
 const cache=new Map();
 return async function(q){
  if(q.league!=='1')return {available:false,complete:false,conflicts:[],message:'League-wide roster ownership is not checked for this league.'};
  const key=q.league+':'+q.season;let item=cache.get(key);
  if(item&&item.result&&now()>=item.result.checkedAt&&now()-item.result.checkedAt<3600000&&item.result.complete)return item.result;
  if(item?.pending)return item.pending;
  item={};cache.set(key,item);
  item.pending=(async()=>{
   try{
    const schedule=await read(`/games?league=${q.league}&season=${q.season}`,3600000);
    const ids=[...new Set(schedule.rows.filter(g=>String(g.league?.id)===q.league&&String(g.league?.season)===q.season&&g.game?.stage==='Regular Season').flatMap(g=>[g.teams?.away?.id,g.teams?.home?.id]).map(String))];
    if(ids.length!==32||ids.some(id=>!/^\d+$/.test(id)))throw Error('NFL team pool unverified');
    const reports=[];let failed=0,index=0;
    await Promise.all(Array.from({length:4},async()=>{while(index<ids.length){const id=ids[index++];try{const report=await read(`/players?team=${id}&season=${q.season}`,3600000);if(!report.rows.length||!Number.isFinite(report.checkedAt)||report.checkedAt>now()||now()-report.checkedAt>=3600000)throw Error();reports.push({id,...report});}catch{failed++;}}}));
    const owners=new Map();
    for(const t of reports)for(const p of t.rows){if(!/^\d+$/.test(String(p.id)))continue;const id=String(p.id);if(!owners.has(id))owners.set(id,new Set());owners.get(id).add(t.id);}
    return {available:reports.length>0,complete:failed===0,checkedAt:reports.length?Math.min(...reports.map(r=>r.checkedAt)):now(),season:q.season,league:q.league,
      checkedTeams:reports.length,expectedTeams:32,conflicts:[...owners].filter(([,teams])=>teams.size>1).map(([id,teams])=>({id,teamIds:[...teams].sort()})),
      message:failed?'Partial league roster check; verified duplicates are withheld, unchecked teams remain unresolved.':'Current provider roster ownership checked across all NFL teams. Duplicate listings do not establish a trade.'};
   }catch{return {available:false,complete:false,checkedAt:now(),league:q.league,season:q.season,checkedTeams:0,expectedTeams:32,conflicts:[],message:'League roster ownership could not be checked.'};}
  })();
  try{item.result=await item.pending;return item.result;}finally{item.pending=null;}
 };
}
module.exports={createRosterOwnership};
