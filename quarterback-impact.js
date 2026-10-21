'use strict';
const {accumulate}=require('./public/player-stats');
const {assess,starterStatus}=require('./public/injury-model');
const fresh=(r,age,now)=>r?.available&&Number.isFinite(r.checkedAt)&&r.checkedAt<=now&&now-r.checkedAt<=age;
const scoped=(r,q)=>String(r?.gameId)===String(q.game)&&r.kickoff===q.kickoff;
// Passing-only estimate. Backups are shrunk toward the team's passing average,
// not assigned a universal QB penalty. Missing history never means zero ability.
function estimate(games,boxes,team,original,replacement){
 const records=new Map();
 for(const g of games){const t=boxes.get(String(g.game.id))?.find(t=>String(t.team?.id)===String(team.id));if(!t)throw Error('Missing team box score');accumulate(records,t,String(g.game.id),g.game.date.timestamp,'');}
 const history=id=>records.get(String(team.id)+':'+id)?.games||new Map();
 const from=history(original.id),to=history(replacement.id),latest=String(games[0]?.game.id);
 const paired=h=>games.map(g=>h.get(String(g.game.id))).filter(r=>r&&Number.isFinite(r.attempts)&&r.attempts>0&&Number.isFinite(r.passYds)&&r.passYds>=0);
 const a=paired(from),b=paired(to),sum=(rows,k)=>rows.reduce((s,r)=>s+r[k],0);
 const attempts=sum(a,'attempts'),backupAttempts=sum(b,'attempts');
 const recent=games.slice(0,3).map(g=>from.get(String(g.game.id))).filter(r=>r?.attempts>=15&&Number.isFinite(r.passYds));
 const totalLatest=[...records.values()].filter(r=>r.teamId===String(team.id)).reduce((n,r)=>n+(r.games.get(latest)?.attempts||0),0);
 if(recent.length<2||!(from.get(latest)?.attempts>=15)||from.get(latest).attempts<totalLatest*.6)return null;
 if(a.length<2||b.length<2||attempts<40||backupAttempts<20)return null;
 const baseline=sum(a,'passYds')/attempts;
 const backup=(sum(b,'passYds')+baseline*50)/(backupAttempts+50);
 const usage=sum(recent,'attempts')/recent.length;
 return {yardChange:Math.max(-100,Math.min(100,(backup-baseline)*usage)),attempts:usage,starterAttempts:attempts,backupAttempts,starterYPA:baseline,backupYPA:backup,passingOnly:true};
}
function createQuarterbackImpact(api,now=Date.now){
 const cache=new Map();
 async function read(path){let old=cache.get(path);if(old&&now()-old.at<3600000)return old.pending;const item={at:now(),pending:Promise.resolve().then(()=>api(path)).then(d=>{if(!Array.isArray(d.response)||d.errors&&Object.keys(d.errors).length||d.paging?.total>1)throw Error('Incomplete QB history');return d.response;})};cache.set(path,item);item.pending.catch(()=>{if(cache.get(path)===item)cache.delete(path);});if(cache.size>200)cache.delete(cache.keys().next().value);return item.pending;}
 return async(q,teams,rosterOwnership)=>Promise.all(teams.map(async t=>{
  const report=t.official,scope={gameId:String(q.game),league:q.league,season:q.season,kickoff:report?.kickoff};
  t.quarterback={...scope,available:false,checkedAt:now(),rows:[],message:'QB replacement data unavailable.'};
  if(!fresh(report,900000,now())||String(report.gameId)!==String(q.game)||!fresh(t.roster,3600000,now())||report.kickoff<=now()||report.kickoff>now()+7*86400000)return;
  const game={id:String(q.game),league:q.league,season:q.season,kickoff:report.kickoff},data={current:true,teams,rosterOwnership};
  const qbs=t.roster.rows.filter(p=>p.position==='QB');
  const outs=qbs.filter(p=>report.rows.some(r=>String(r.id)===String(p.id)&&String(r.status).toLowerCase()==='out')&&['unavailable','nonstarter'].includes(assess(data,game,t.id,p.id,now(),true).state));
  if(!outs.length){t.quarterback={...scope,available:true,checkedAt:now(),rows:[]};return;}
  try{
   const all=await read(`/games?team=${t.id}&season=${q.season}`);
   const games=all.filter(g=>String(g.league?.id)===q.league&&String(g.league?.season)===q.season&&[g.teams?.home?.id,g.teams?.away?.id].map(String).includes(String(t.id))&&['FT','AOT','FINAL'].includes(g.game?.status?.short)&&Number(g.game?.date?.timestamp)>0&&Number(g.game.date.timestamp)*1000<Math.min(now(),report.kickoff)).sort((a,b)=>b.game.date.timestamp-a.game.date.timestamp).slice(0,8);
   if(games.length<2)throw Error('Too few games');
   const boxes=new Map();
   // Keep provider requests bounded; shared box-score cache avoids repeat charges.
   for(let i=0;i<games.length;i+=2)await Promise.all(games.slice(i,i+2).map(async g=>boxes.set(String(g.game.id),await read('/games/statistics/players?id='+g.game.id))));
   const eligible=p=>{const s=assess(data,game,t.id,p.id,now(),true);return !s.blocked&&!['conditional','conflict'].includes(s.state)&&!report.rows.some(r=>String(r.id)===String(p.id)&&String(r.status).toLowerCase()==='exempt');};
   const rows=[];
   for(const original of outs){
    const starter=starterStatus(data,game,t.id,now());
    if(['conflict','unresolved'].includes(starter.state))continue;
    const announced=starter.rows.filter(r=>String(r.id)!==String(original.id));
    let candidates=[],role='estimated';
    if(announced.length===1){candidates=qbs.filter(p=>String(p.id)===String(announced[0].id)&&eligible(p));role='announced';}
    else if(announced.length>1)continue;
    else if(fresh(t.depth,3600000,now())&&scoped(t.depth,{...q,kickoff:report.kickoff})){
     const slots=t.depth.rows.filter(r=>String(r.id)===String(original.id)&&r.position==='QB'&&r.rank===1);
     if(slots.length!==1)continue;
     if((t.depth.unresolved||[]).some(r=>r.position==='QB'))continue;
     const ordered=t.depth.rows.filter(r=>r.position==='QB'&&r.rank>1&&(!slots[0].slot||r.slot===slots[0].slot)).sort((a,b)=>a.rank-b.rank);
     for(const r of ordered){const p=qbs.find(p=>String(p.id)===String(r.id));if(p&&eligible(p)){if(ordered.filter(x=>x.rank===r.rank).length===1)candidates=[p];break;}}
    }else{
     // Without depth charts, require one uniquely experienced eligible backup.
     candidates=qbs.filter(p=>String(p.id)!==String(original.id)&&eligible(p)&&estimate(games,boxes,t,original,p));
     role='recent backup estimate';
    }
    if(candidates.length!==1)continue;
    const replacement=candidates[0],impact=estimate(games,boxes,t,original,replacement);
    if(impact)rows.push({playerId:String(original.id),name:original.name,replacementId:String(replacement.id),replacement:replacement.name,role,...impact,source:role==='announced'?announced[0].url:t.depth?.url||report.url});
   }
   t.quarterback={...scope,available:true,checkedAt:now(),rows,message:rows.length?'Estimated passing impact.':'No unique eligible backup with enough passing history.'};
  }catch{}
 }));
}
module.exports={estimate,createQuarterbackImpact};
