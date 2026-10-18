'use strict';
const {accumulate}=require('./public/player-stats');
function buildUsage(games,boxes,teamId,roster){
 const records=new Map();
 for(const g of games){const rows=boxes.get(String(g.game.id));const t=rows.find(t=>String(t.team?.id)===String(teamId));if(!t)throw Error('Team box score missing');accumulate(records,t,String(g.game.id),Number(g.game.date.timestamp),'');}
 const latest=String(games[0].game.id),rows=[];
 for(const p of roster){
  const metric=p.position==='RB'?'carries':['WR','TE'].includes(p.position)?'rec':null;
  if(!metric)continue;
  const history=records.get(String(teamId)+':'+p.id)?.games;
  const values=games.map(g=>history?.get(String(g.game.id))?.[metric]);
  const threshold=metric==='carries'?8:3;
  if(values.filter(v=>Number.isFinite(v)&&v>=threshold).length>=2&&Number.isFinite(history?.get(latest)?.[metric])&&history.get(latest)[metric]>=threshold)
   rows.push({id:String(p.id),position:p.position,metric,values,role:'recent regular contributor'});
 }
 return rows;
}
function createCollegeInjuryUsage(api,now=Date.now){
 const cache=new Map();
 async function read(path){const old=cache.get(path);if(old&&now()-old.at<3600000)return old.pending;const item={at:now(),pending:api(path).then(d=>{if(d.errors&&Object.keys(d.errors).length||!Array.isArray(d.response)||d.paging?.total>1)throw Error('Incomplete usage data');return d.response;})};cache.set(path,item);item.pending.catch(()=>cache.delete(path));if(cache.size>250)cache.delete(cache.keys().next().value);return item.pending;}
 return async(q,teams)=>{
  if(!['1','2'].includes(q.league))return;
  await Promise.all(teams.map(async t=>{
   t.injuryUsage={available:false,rows:[],checkedAt:now(),message:'Recent workload unavailable.'};
   if(!t.official?.available)return;
   const scope={gameId:String(q.game),kickoff:t.official.kickoff,league:q.league,season:q.season};
   if(!t.official.rows.some(p=>String(p.status).toLowerCase()==='out'&&(q.league!=='1'||(t.roster?.rows||[]).some(r=>String(r.id)===String(p.id)&&['RB','WR','TE'].includes(r.position))))){t.injuryUsage={available:true,checkedAt:now(),rows:[],...scope};return;}
   try{
    const all=await read(`/games?team=${t.id}&season=${q.season}`);
    const games=all.filter(g=>String(g.league?.id)===q.league&&String(g.league?.season)===q.season&&[g.teams?.home?.id,g.teams?.away?.id].map(String).includes(String(t.id))&&(q.league!=='1'||g.game?.stage==='Regular Season')&&['FT','AOT','FINAL'].includes(g.game?.status?.short)&&Number(g.game?.date?.timestamp)*1000<Math.min(now(),scope.kickoff)&&Number(g.game?.date?.timestamp)*1000>scope.kickoff-60*86400000).sort((a,b)=>b.game.date.timestamp-a.game.date.timestamp).slice(0,3);
    if(games.length<2)throw Error('Too few games');
    const boxes=new Map(await Promise.all(games.map(async g=>[String(g.game.id),await read('/games/statistics/players?id='+g.game.id)])));
    t.injuryUsage={available:true,checkedAt:now(),...scope,rows:buildUsage(games,boxes,t.id,t.roster?.rows||[]),message:'Recent offensive workload only; not confirmed starters. Other positions need depth or replacement evidence.'};
   }catch{}
  }));
 };
}
module.exports={createCollegeInjuryUsage,buildUsage};
