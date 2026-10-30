'use strict';
const {accumulate}=require('./public/player-stats');
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
function buildUsageReport(games,boxes,teamId,roster){
 const records=new Map();
 for(const g of games){const rows=boxes.get(String(g.game.id));const matches=rows.filter(t=>String(t.team?.id)===String(teamId));if(matches.length!==1)throw Error('Team box score missing or ambiguous');const t=matches[0];accumulate(records,t,String(g.game.id),Number(g.game.date.timestamp),'');}
 if(new Set(games.map(g=>String(g.game.id))).size!==games.length)throw Error('Duplicate workload games');
 const rows=[],assessments=[];
 for(const p of roster){
  const metric=p.position==='RB'?'carries':['WR','TE'].includes(p.position)?'rec':defensive.has(p.position)?'tackles':null;
  if(!metric){assessments.push({id:String(p.id),position:p.position,reason:'unsupported-position'});continue;}
  const history=records.get(String(teamId)+':'+p.id)?.games;
  const values=games.map(g=>metric==='tackles'?tackles(boxes.get(String(g.game.id)).find(t=>String(t.team?.id)===String(teamId)),p.id):history?.get(String(g.game.id))?.[metric]);
  const threshold=metric==='carries'?8:3;
  const qualifying=values.filter(v=>Number.isFinite(v)&&v>=threshold).length;
  const eligible=qualifying>=2&&Number.isFinite(values[0])&&values[0]>=threshold;
  assessments.push({id:String(p.id),position:p.position,metric,threshold,qualifying,required:2,
   games:games.map((g,i)=>({id:String(g.game.id),at:Number(g.game.date.timestamp)*1000,value:Number.isFinite(values[i])?values[i]:null})),
   reason:eligible?'eligible':!Number.isFinite(values[0])?'latest-stat-unverified':values[0]<threshold?'latest-below-threshold':'insufficient-repeated-workload'});
  if(eligible)
   rows.push({id:String(p.id),position:p.position,metric,values,role:metric==='tackles'?'recent defensive contributor':'recent regular contributor'});
 }
 return {rows,assessments};
}
function buildUsage(...args){return buildUsageReport(...args).rows;}
function createCollegeInjuryUsage(api,now=Date.now){
 const cache=new Map();
 async function read(path){const old=cache.get(path);if(old&&now()-old.at<3600000)return old.pending;const item={at:now(),pending:api(path).then(d=>{if(d.errors&&Object.keys(d.errors).length||!Array.isArray(d.response)||d.paging?.total>1)throw Error('Incomplete usage data');return {rows:d.response,checkedAt:now()};})};cache.set(path,item);item.pending.catch(()=>cache.delete(path));if(cache.size>250)cache.delete(cache.keys().next().value);return item.pending;}
 return async(q,teams)=>{
  if(!['1','2'].includes(q.league))return;
  await Promise.all(teams.map(async t=>{
   t.injuryUsage={available:false,rows:[],checkedAt:now(),message:'Recent workload unavailable.'};
   if(!t.official?.available)return;
   const scope={gameId:String(q.game),kickoff:t.official.kickoff,league:q.league,season:q.season};
   if(!t.official.rows.some(p=>String(p.status).toLowerCase()==='out'&&(q.league!=='1'||(t.roster?.rows||[]).some(r=>String(r.id)===String(p.id)&&['RB','WR','TE'].includes(r.position))))){t.injuryUsage={available:true,checkedAt:now(),rows:[],...scope};return;}
   try{
    const schedule=await read(`/games?team=${t.id}&season=${q.season}`);
    const games=reconcileGames(schedule.rows).filter(g=>String(g.league?.id)===q.league&&String(g.league?.season)===q.season&&[g.teams?.home?.id,g.teams?.away?.id].map(String).includes(String(t.id))&&(q.league!=='1'||g.game?.stage==='Regular Season')&&['FT','AOT','FINAL'].includes(g.game?.status?.short)&&Number(g.game?.date?.timestamp)*1000<Math.min(now(),scope.kickoff)&&Number(g.game?.date?.timestamp)*1000>scope.kickoff-60*86400000).sort((a,b)=>b.game.date.timestamp-a.game.date.timestamp).slice(0,3);
    if(games.length<2)throw Error('Too few games');
    const reports=await Promise.all(games.map(async g=>({id:String(g.game.id),...await read('/games/statistics/players?id='+g.game.id)})));
    const boxes=new Map(reports.map(r=>[r.id,r.rows]));
    t.injuryUsage={available:true,checkedAt:Math.min(schedule.checkedAt,...reports.map(r=>r.checkedAt)),...scope,...buildUsageReport(games,boxes,t.id,t.roster?.rows||[]),message:'Recent offensive workload or repeated defensive tackles; not confirmed starters or snap counts. Blocking positions still require depth evidence.'};
   }catch{}
  }));
 };
}
module.exports={createCollegeInjuryUsage,buildUsage,buildUsageReport};
