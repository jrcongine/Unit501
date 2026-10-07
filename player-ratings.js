'use strict';
const {summarize}=require('./public/player-form');
const normalize=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const numeric=v=>typeof v==='number' && Number.isFinite(v)?v:typeof v==='string' && /^\d+(\.\d+)?$/.test(v.trim())?Number(v):null;
function role(position) {
 const p=String(position||'').toUpperCase();
 if(['QB','RB','WR','TE','K','P','FB'].includes(p))return p;
 if(['DE','DT','NT','DL'].includes(p))return 'DL';
 if(['LB','ILB','OLB','MLB'].includes(p))return 'LB';
 if(['CB','DB','S','FS','SS'].includes(p))return 'DB';
 return null;
}
const specs={
 QB:[['passing','yards',1],['passing','rating',1],['passing','passing touch downs',1],['passing','interceptions',-1]],
 RB:[['rushing','yards',1],['rushing','average',1],['rushing','rushing touch downs',1],['receiving','yards',1]],
 FB:[['rushing','yards',1],['receiving','yards',1]],
 WR:[['receiving','yards',1],['receiving','total receptions',1],['receiving','average',1],['receiving','receiving touch downs',1]],
 TE:[['receiving','yards',1],['receiving','total receptions',1],['receiving','average',1],['receiving','receiving touch downs',1]],
 DL:[['defensive','sacks',1],['defensive','qb hts',1],['defensive','tfl',1],['defensive','tackles',1]],
 LB:[['defensive','tackles',1],['defensive','tfl',1],['defensive','sacks',1],['defensive','passes defended',1]],
 DB:[['defensive','passes defended',1],['defensive','tackles',1],['defensive','ff',1],['interceptions','total interceptions',1]],
 K:[['kicking','pct',1],['kicking','points',1]],
 P:[['punting','average',1],['punting','in20',1],['punting','touchbacks',-1]]
};
function buildRatings(games,boxes,rosters,before) {
 const players=new Map();
 for(const [teamId,rows] of rosters)for(const p of rows)if(p.id){
  const id=String(p.id);players.set(`${teamId}:${id}`,{id,teamId,name:p.name||'Unknown',position:p.position||'Unknown',role:role(p.position),history:new Map()});
 }
 for(const g of games){
  const stamp=Number(g.game?.date?.timestamp)*1000,id=String(g.game?.id);
  if(!Number.isFinite(stamp)||stamp<=0||stamp>=before||g.game?.stage!=='Regular Season'||!['FT','AOT','FINAL'].includes(g.game?.status?.short))continue;
  for(const row of boxes.get(id)||[])for(const group of row.groups||[])for(const p of group.players||[]){
   const player=players.get(`${row.team?.id}:${p.player?.id}`);if(!player)continue;
   if(!player.history.has(id))player.history.set(id,{gameDate:stamp/1000});
   const line=player.history.get(id);
   for(const s of p.statistics||[]){const value=numeric(s.value);if(value!==null)line[normalize(group.name)+':'+normalize(s.name)]=value;}
  }
 }
 const candidates=[...players.values()].map(p=>{
  const components=(specs[p.role]||[]).map(([group,name,direction])=>({name,direction,key:normalize(group)+':'+normalize(name)}))
   .map(c=>({...c,form:summarize([...p.history.values()],c.key)})).filter(c=>c.form);
  return {...p,components};
 });
 return candidates.map(p=>{
  const out={id:p.id,teamId:p.teamId,name:p.name,position:p.position,role:p.role,rating:null,trend:null,games:p.history.size,coverage:[],reason:''};
  if(!p.role)return {...out,reason:'Position lacks supported production metrics; blocking and coverage grades are not available.'};
  const peers=candidates.filter(t=>t.role===p.role);
  const components=[];
  for(const c of p.components){
   const values=peers.map(t=>t.components.find(x=>x.key===c.key)?.form.weighted).filter(Number.isFinite);
   if(values.length<8)continue;
   const rank=value=>(values.filter(x=>x*c.direction<value*c.direction).length+values.filter(x=>Math.abs(x-value)<1e-9).length/2)/values.length;
   const raw=rank(c.form.weighted)*99;
   const count=c.form.values.length;
   const score=49.5+(raw-49.5)*count/(count+4);
   components.push({name:c.name,direction:c.direction,score,count,peers:values.length,average:c.form.average,baseline:c.form.weighted});
  }
  if(components.length<2)return {...out,reason:'Need at least two recorded games for two metrics and eight same-position peers per metric.'};
  const rating=Math.round(components.reduce((s,c)=>s+c.score,0)/components.length);
  const change=components.reduce((s,c)=>s+c.direction*(c.baseline-c.average)/(Math.abs(c.average)||1),0)/components.length;
  return {...out,rating,trend:change>.03?'Rising':change<-.03?'Falling':'Steady',coverage:components,
   reason:'Experimental box-score production rating among same-position NFL peers; not a talent, blocking or coverage grade. Four neutral pseudo-games soften small samples.'};
 });
}
function createRatings(api,{delayMs=1000}={}){
 const jobs=new Map(),boxCache=new Map(),rosterCache=new Map();let active=false;
 async function read(endpoint){const data=await api(endpoint);if(!Array.isArray(data.response)||data.paging?.total>1||(data.errors&&Object.keys(data.errors).length))throw new Error('Player rating feed is incomplete or unavailable.');return data.response;}
 async function paced(endpoint){try{return await read(endpoint);}finally{await new Promise(r=>setTimeout(r,delayMs));}}
 async function build(job,q){active=true;try{
  const all=await paced(`/games?league=1&season=${q.season}`);
  const teamIds=new Set(all.filter(g=>String(g.league?.id)==='1'&&String(g.league?.season)===q.season&&g.game?.stage==='Regular Season').flatMap(g=>[g.teams?.away?.id,g.teams?.home?.id]).filter(Boolean).map(String));
  if(teamIds.size!==32)throw new Error('Complete 32-team NFL schedule is required.');
  const games=[...new Map(all.filter(g=>String(g.league?.id)==='1'&&String(g.league?.season)===q.season&&g.game?.stage==='Regular Season'&&['FT','AOT','FINAL'].includes(g.game?.status?.short)&&Number(g.game?.date?.timestamp)>0&&Number(g.game?.date?.timestamp)*1000<q.before).map(g=>[String(g.game?.id),g])).values()];
  if(games.some(g=>!/^\d+$/.test(String(g.game?.id))))throw new Error('Invalid game identifier in schedule.');
  job.total=32+games.length;const rosters=new Map(),boxes=new Map();
  for(const id of teamIds){const key=q.season+':'+id;const cached=rosterCache.get(key);const rows=cached&&Date.now()-cached.at<3600000?cached.rows:await paced(`/players?team=${id}&season=${q.season}`);if(!rows.length)throw new Error('A team roster is unavailable; league player ratings withheld.');rosterCache.set(key,{at:Date.now(),rows});rosters.set(id,rows);job.completed++;}
  for(const g of games){const id=String(g.game.id);const cached=boxCache.get(id);const rows=cached&&Date.now()-cached.at<86400000?cached.rows:await paced('/games/statistics/players?id='+id);
   const ids=new Set(rows.map(r=>String(r.team?.id)));if(![g.teams.away.id,g.teams.home.id].every(id=>ids.has(String(id))))throw new Error('A player box score is missing a team; league ratings withheld.');
   boxCache.set(id,{at:Date.now(),rows});boxes.set(id,rows);job.completed++;}
  job.data={season:q.season,before:q.before,players:buildRatings(games,boxes,rosters,q.before),builtAt:Date.now()};job.state='ready';
 }catch(e){job.state='error';job.message=e.message;}finally{job.finishedAt=Date.now();active=false;}}
 return q=>{const key=q.season+':'+q.before;for(const [k,j]of jobs)if(j.finishedAt&&Date.now()-j.finishedAt>(j.state==='error'?60000:3600000))jobs.delete(k);if(jobs.has(key))return jobs.get(key);if(active)return {state:'loading',completed:0,total:0,message:'Another NFL player rating build is running. This matchup will follow.'};const job={state:'loading',completed:0,total:0};jobs.set(key,job);void build(job,q);return job;};
}
module.exports={buildRatings,createRatings,role};
