'use strict';
const {accumulate,applyParticipation}=require('./public/player-stats');
const {reconcileGames}=require('./football-schedule-integrity');
const defensive=new Set(['CB','DB','S','FS','SS','DE','EDGE','EDG','DT','NT','DL','LB','ILB','OLB','MLB']);
const numeric=v=>typeof v==='number'&&Number.isFinite(v)?v:typeof v==='string'&&/^\d+(?:\.\d+)?$/.test(v.trim())?Number(v):null;
function tackles(team,id){
 const players=(team.groups||[]).filter(g=>String(g.name).toLowerCase()==='defensive').flatMap(g=>g.players||[]).filter(p=>String(p.player?.id)===String(id));
 if(players.length!==1)return null;
 const stats=(players[0].statistics||[]).filter(s=>['tackles','total tackles'].includes(String(s.name).toLowerCase()));
 if(stats.length!==1)return null;
 const value=numeric(stats[0].value);return Number.isInteger(value)&&value>=0?value:null;
}
function buildUsageReport(games,boxes,teamId,roster,reports=[],scope={},absences=[]){
 const records=new Map();
 for(const g of games){const rows=boxes.get(String(g.game.id));const matches=rows.filter(t=>String(t.team?.id)===String(teamId));if(matches.length!==1)throw Error('Team box score missing or ambiguous');const t=matches[0];accumulate(records,t,String(g.game.id),Number(g.game.date.timestamp),'');}
 if(new Set(games.map(g=>String(g.game.id))).size!==games.length)throw Error('Duplicate workload games');
 // Seed missing player/game records from this team's roster, never inferred zeros.
 // The shared reconciler verifies source, matchup, score and unique player name.
 const calendar=new Map();
 for(const g of games){
  const side=['away','home'].find(side=>String(g.teams?.[side]?.id)===String(teamId));
  if(!side)continue;
  const other=side==='away'?'home':'away',name=g.teams[side].name;
  calendar.set(String(g.game.id),{date:Number(g.game.date.timestamp),teams:new Map([[String(teamId),{name:g.teams[other].name,scored:g.scores?.[side]?.total,allowed:g.scores?.[other]?.total}]])});
  for(const p of roster){
   const key=String(teamId)+':'+p.id;
   if(!records.has(key))records.set(key,{name:p.name,team:name,teamId:String(teamId),games:new Map()});
   const record=records.get(key);
   if(!record.games.has(String(g.game.id)))record.games.set(String(g.game.id),{gameDate:Number(g.game.date.timestamp)});
  }
 }
 for(const report of reports)applyParticipation(records,calendar,report,scope);

 const history=roster.map(p=>({id:String(p.id),games:games.map(g=>{
  const gameId=String(g.game.id),at=Number(g.game.date.timestamp)*1000,line=records.get(String(teamId)+':'+p.id)?.games.get(gameId);
  const teamRows=boxes.get(gameId)?.filter(t=>String(t.team?.id)===String(teamId))||[];
  const stats=teamRows.length===1?(teamRows[0].groups||[]).flatMap(g=>g.players||[]).filter(r=>String(r.player?.id)===String(p.id)):[];
  const positive=stats.some(r=>(r.statistics||[]).some(s=>{const n=numeric(s.value);return n!==null&&n>0;}));
  const official=absences.filter(r=>r.gameId===gameId&&r.at===at&&r.teamId===String(teamId)).flatMap(r=>r.rows||[]).filter(r=>r.id===String(p.id));
  const out=official.length>0&&official.every(r=>r.status==='out');
  const conflict=line?.participation==='conflict'||(out&&(positive||line?.participation==='played'))||(line?.participation==='dnp'&&positive);
  const state=conflict?'conflict':out||line?.participation==='dnp'?'absent':positive||line?.participation==='played'?'played':'unknown';
  return {id:gameId,at,state,source:out?absences.find(r=>r.gameId===gameId)?.source:line?.verification?.source||'Provider recorded statistics'};
 })}));
 const recent=games.slice(0,3),rows=[],assessments=[];
 for(const p of roster){
  const metric=p.position==='RB'?'carries':['WR','TE'].includes(p.position)?'rec':defensive.has(p.position)?'tackles':null;
  if(!metric){assessments.push({id:String(p.id),position:p.position,reason:'unsupported-position'});continue;}
  const history=records.get(String(teamId)+':'+p.id)?.games;
  const values=recent.map(g=>metric==='tackles'?tackles(boxes.get(String(g.game.id)).find(t=>String(t.team?.id)===String(teamId)),p.id):history?.get(String(g.game.id))?.[metric]);
  const threshold=metric==='carries'?8:3;
  const qualifying=values.filter(v=>Number.isFinite(v)&&v>=threshold).length;
  const eligible=qualifying>=2&&Number.isFinite(values[0])&&values[0]>=threshold;
  assessments.push({id:String(p.id),position:p.position,metric,threshold,qualifying,required:2,
   games:recent.map((g,i)=>({id:String(g.game.id),at:Number(g.game.date.timestamp)*1000,value:Number.isFinite(values[i])?values[i]:null})),
   reason:eligible?'eligible':!Number.isFinite(values[0])?'latest-stat-unverified':values[0]<threshold?'latest-below-threshold':'insufficient-repeated-workload'});
  if(eligible)
   rows.push({id:String(p.id),position:p.position,metric,values,role:metric==='tackles'?'recent defensive contributor':'recent regular contributor'});
 }
 return {rows,assessments,history};
}
function buildUsage(...args){return buildUsageReport(...args).rows;}
function createCollegeInjuryUsage(api,now=Date.now,participation=null,absenceHistory=null){
 const cache=new Map();
 async function read(path){const old=cache.get(path);if(old&&now()-old.at<3600000)return old.pending;const item={at:now(),pending:api(path).then(d=>{if(d.errors&&Object.keys(d.errors).length||!Array.isArray(d.response)||d.paging?.total>1)throw Error('Incomplete usage data');return {rows:d.response,checkedAt:now()};})};cache.set(path,item);item.pending.catch(()=>cache.delete(path));if(cache.size>250)cache.delete(cache.keys().next().value);return item.pending;}
 return async(q,teams)=>{
  if(!['1','2'].includes(q.league))return;
  await Promise.all(teams.map(async t=>{
   t.injuryUsage={baselineRequired:true,available:false,rows:[],checkedAt:now(),message:'Recent workload unavailable.'};
   if(!t.official?.available)return;
   const scope={gameId:String(q.game),kickoff:t.official.kickoff,league:q.league,season:q.season};
   if(!t.official.rows.some(p=>String(p.status).toLowerCase()==='out')&&!(q.league==='1'&&(t.roster?.rows||[]).some(p=>/\binjured reserve\b/i.test(p.group||'')))){t.injuryUsage={baselineRequired:true,available:true,checkedAt:now(),rows:[],...scope};return;}
   try{
    const schedule=await read(`/games?team=${t.id}&season=${q.season}`);
    const games=reconcileGames(schedule.rows).filter(g=>String(g.league?.id)===q.league&&String(g.league?.season)===q.season&&[g.teams?.home?.id,g.teams?.away?.id].map(String).includes(String(t.id))&&(q.league!=='1'||g.game?.stage==='Regular Season')&&['FT','AOT','FINAL'].includes(g.game?.status?.short)&&Number(g.game?.date?.timestamp)*1000<Math.min(now(),scope.kickoff)&&Number(g.game?.date?.timestamp)*1000>scope.kickoff-250*86400000).sort((a,b)=>b.game.date.timestamp-a.game.date.timestamp).slice(0,20);
    if(games.length<2)throw Error('Too few games');
    const reports=[];
    // Bounded concurrency for season participation; cached provider reads share results.
    for(let i=0;i<games.length;i+=4)reports.push(...await Promise.all(games.slice(i,i+4).map(async g=>{try{return {id:String(g.game.id),...await read('/games/statistics/players?id='+g.game.id)};}catch{return {id:String(g.game.id),checkedAt:now(),rows:[{team:{id:t.id},groups:[]}]};}})));
    // An empty response or absent team is missing data, not a reason to skip
    // independent recovery. Duplicate team records still fail closed below.
    const boxes=new Map(reports.map(r=>[r.id,r.rows.some(row=>String(row.team?.id)===String(t.id))?r.rows:[...r.rows,{team:{id:t.id},groups:[]}]]));
    const roster=t.roster?.rows||[];
    const absences=absenceHistory?await absenceHistory(games,q,t).catch(()=>[]):[];
    let usage=buildUsageReport(games,boxes,t.id,roster,[],q,absences);
    const outIds=new Set([...t.official.rows.filter(p=>String(p.status).toLowerCase()==='out'),...(q.league==='1'?roster.filter(p=>/\binjured reserve\b/i.test(p.group||'')):[])].map(p=>String(p.id)));
    // Reconcile only games with unknown participation for a confirmed Out player.
    const needsGame=g=>usage.history.some(a=>outIds.has(a.id)&&a.games.some(h=>h.id===String(g.game.id)&&h.state==='unknown'))||usage.assessments.some(a=>outIds.has(a.id)&&['carries','rec'].includes(a.metric)&&a.games.some(h=>h.id===String(g.game.id)&&h.value===null));
    if(participation&&games.some(needsGame)){
     const needed=games.filter(needsGame);
     const settled=await Promise.allSettled(needed.map(g=>participation({league:q.league,season:q.season,game:String(g.game.id),date:new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(Number(g.game.date.timestamp)*1000))})));
     usage=buildUsageReport(games,boxes,t.id,roster,settled.filter(r=>r.status==='fulfilled').map(r=>r.value),q,absences);
    }
    t.injuryUsage={baselineRequired:true,available:true,checkedAt:Math.min(schedule.checkedAt,...reports.map(r=>r.checkedAt)),...scope,...usage,message:'Recent workload plus season participation evidence. Missing rows are unknown, never assumed absent. Published depth order is separate from workload.'};
   }catch{}
  }));
 };
}
module.exports={createCollegeInjuryUsage,buildUsage,buildUsageReport};
