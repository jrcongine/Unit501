'use strict';
const {summarize}=require('./public/player-form');
const {fbsName,canonicalizeGames}=require('./team-identity');
const normalize=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const numeric=v=>typeof v==='number' && Number.isFinite(v)?v:typeof v==='string' && /^-?\d+(\.\d+)?$/.test(v.trim())?Number(v):null;
function role(position) {
 const p=String(position||'').toUpperCase();
 if(p==='PK')return 'K';
 if(['QB','RB','WR','TE','K','P','FB'].includes(p))return p;
 if(['C','G','OG','OT','T','LG','RG','LT','RT','OL'].includes(p))return 'OL';
 if(p==='LS')return 'LS';
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
function buildRatings(games,boxes,rosters,before,league='1') {
 const calendar=new Map();
 for(const g of games){const time=Number(g.game?.date?.timestamp)*1000;
  if(time>0&&time<before&&['FT','AOT','FINAL'].includes(g.game?.status?.short)&&(league!=='1'||g.game?.stage==='Regular Season'))
   for(const t of [g.teams?.away,g.teams?.home]){const id=String(t?.id);if(!calendar.has(id))calendar.set(id,new Map());calendar.get(id).set(String(g.game.id),time/1000);}}

 const players=new Map();
 for(const [teamId,rows] of rosters)for(const p of rows)if(p.id){
  const id=String(p.id);players.set(`${teamId}:${id}`,{id,teamId,name:p.name||'Unknown',position:p.position||'Unknown',role:role(p.position),history:new Map()});
 }
 for(const g of games){
  const stamp=Number(g.game?.date?.timestamp)*1000,id=String(g.game?.id);
  if(!Number.isFinite(stamp)||stamp<=0||stamp>=before||(league==='1'&&g.game?.stage!=='Regular Season')||!['FT','AOT','FINAL'].includes(g.game?.status?.short))continue;
  for(const row of boxes.get(id)||[])for(const group of row.groups||[])for(const p of group.players||[]){
   const player=players.get(`${row.team?.id}:${p.player?.id}`);if(!player)continue;
   if(!player.history.has(id))player.history.set(id,{gameDate:stamp/1000});
   const line=player.history.get(id);
   for(const s of p.statistics||[]){
    const groupKey=normalize(group.name),name=normalize(s.name),value=numeric(s.value);
    const aliases={receptions:'totalreceptions',passingtouchdowns:'passingtouchdowns',rushingtouchdowns:'rushingtouchdowns',receivingtouchdowns:'receivingtouchdowns',qbhits:'qbhts'};
    if(value!==null)line[groupKey+':'+(aliases[name]||name)]=value;
    if(groupKey==='passing'&&name==='compatt'){const m=String(s.value).match(/^\s*\d+\s*\/\s*(\d+)\s*$/);if(m)line['passing:attempts']=Number(m[1]);}
   }
  }
 }
 const candidates=[...players.values()].map(p=>{
  const history=[...(calendar.get(String(p.teamId))||new Map()).entries()].map(([id,date])=>p.history.get(id)||{gameDate:date});
  const profiles={};
  for(const [key,group,aliases]of [['passing','passing',['attempts','passing attempts']],['rushing','rushing',['total rushes','rushing attempts','rush attempts','carries','attempts']],['receiving','receiving',['total receptions','receptions']]]){
   const rows=history.map(g=>{const yards=g[normalize(group)+':yards'],usage=aliases.map(name=>g[normalize(group)+':'+normalize(name)]).find(Number.isFinite);return {...g,usage:Number.isFinite(yards)?usage:undefined,yards};});
   const paired=rows.filter(g=>g.usage>0&&Number.isFinite(g.yards));
   const usage=summarize(rows,'usage');
   if(usage&&paired.length>=2){const total=paired.reduce((v,g)=>v+g.usage,0),rates=paired.map(g=>g.yards/g.usage).sort((a,b)=>a-b),mid=Math.floor(rates.length/2),median=rates.length%2?rates[mid]:(rates[mid-1]+rates[mid])/2;profiles[key]={usage:usage.weighted,efficiency:(paired.reduce((v,g)=>v+g.yards,0)/total+median)/2,games:paired.length,totalGames:rows.length,latestMissing:!Number.isFinite(rows.sort((a,b)=>b.gameDate-a.gameDate)[0]?.usage),coverage:usage.coverage};}
  }
  const components=(specs[p.role]||[]).map(([group,name,direction])=>({name,direction,key:normalize(group)+':'+normalize(name)}))
   .map(c=>({...c,form:summarize(history,c.key)})).filter(c=>c.form);
  return {...p,components,profiles};
 });
 const peerMetrics=new Map();
 for(const p of candidates)for(const c of p.components){const key=p.role+':'+c.key;if(!peerMetrics.has(key))peerMetrics.set(key,[]);peerMetrics.get(key).push(c.form.weighted*c.direction);}
 for(const values of peerMetrics.values())values.sort((a,b)=>a-b);
 const bound=(values,target,inclusive)=>{let low=0,high=values.length;while(low<high){const mid=(low+high)>>>1;if(values[mid]<target||(inclusive&&values[mid]===target))low=mid+1;else high=mid;}return low;};
 return candidates.map(p=>{
  const out={id:p.id,teamId:p.teamId,name:p.name,position:p.position,role:p.role,rating:null,trend:null,games:p.history.size,profiles:p.profiles,coverage:[],reason:''};
  if(!specs[p.role])return {...out,reason:'Position lacks supported production metrics; blocking and coverage grades are not available.'};
  const components=[];
  for(const c of p.components){
   const values=peerMetrics.get(p.role+':'+c.key)||[];
   if(values.length<8)continue;
   const rank=value=>(bound(values,value*c.direction,false)+bound(values,value*c.direction,true))/(2*values.length);
   const raw=rank(c.form.weighted)*99;
   const count=c.form.values.length;
   const score=49.5+(raw-49.5)*count/(count+4);
   components.push({name:c.name,direction:c.direction,score,count,peers:values.length,average:c.form.average,baseline:c.form.weighted});
  }
  if(components.length<2)return {...out,reason:'Need at least two recorded games for two metrics and eight same-position peers per metric.'};
  const rating=Math.round(components.reduce((s,c)=>s+c.score,0)/components.length);
  const change=components.reduce((s,c)=>s+c.direction*(c.baseline-c.average)/(Math.abs(c.average)||1),0)/components.length;
  return {...out,rating,trend:change>.03?'Rising':change<-.03?'Falling':'Steady',coverage:components,
   reason:'Experimental box-score production rating among same-position league peers; not a talent, blocking or coverage grade. Four neutral pseudo-games soften small samples.'};
 });
}
function createRatings(api,{delayMs=1000}={}){
 const jobs=new Map(),boxCache=new Map(),rosterCache=new Map();let active=false;
 async function read(endpoint){const data=await api(endpoint);if(!Array.isArray(data.response)||data.paging?.total>1||(data.errors&&Object.keys(data.errors).length))throw new Error('Player rating feed is incomplete or unavailable.');return data.response;}
 async function paced(endpoint){try{return await read(endpoint);}finally{await new Promise(r=>setTimeout(r,delayMs));}}
 async function build(job,q){active=true;try{
  const league=q.league||'1';
  const raw=await paced(`/games?league=${league}&season=${q.season}`);
  const all=league==='2'?canonicalizeGames(raw,raw,q.season):raw;
  const teamRows=new Map(all.filter(g=>String(g.league?.id)===league&&String(g.league?.season)===q.season&&(league!=='1'||g.game?.stage==='Regular Season')).flatMap(g=>[g.teams?.away,g.teams?.home]).filter(t=>t?.id&&(league==='1'||fbsName(t,q.season))).map(t=>[String(t.id),t]));
  const teamIds=new Set(teamRows.keys());
  if(teamIds.size!==(league==='1'?32:138)||(league==='2'&&new Set([...teamRows.values()].map(t=>fbsName(t,q.season))).size!==138))throw new Error('Complete verified league team pool is required; conflicting provider school IDs remain unresolved.');
  const games=[...new Map(all.filter(g=>String(g.league?.id)===league&&String(g.league?.season)===q.season&&(league!=='1'||g.game?.stage==='Regular Season')&&['FT','AOT','FINAL'].includes(g.game?.status?.short)&&Number(g.game?.date?.timestamp)>0&&Number(g.game?.date?.timestamp)*1000<q.before&&[g.teams?.away?.id,g.teams?.home?.id].some(id=>teamIds.has(String(id)))).map(g=>[String(g.game?.id),g])).values()];
  if(games.some(g=>!/^\d+$/.test(String(g.game?.id))))throw new Error('Invalid game identifier in schedule.');
  job.total=teamIds.size+games.length;const rosters=new Map(),boxes=new Map();
  for(const id of teamIds){const key=league+':'+q.season+':'+id;const cached=rosterCache.get(key);const rows=cached&&Date.now()-cached.at<3600000?cached.rows:await paced(`/players?team=${id}&season=${q.season}`);if(!rows.length)throw new Error('A team roster is unavailable; league player ratings withheld.');rosterCache.set(key,{at:Date.now(),rows});rosters.set(id,rows);job.completed++;}
  for(const g of games){const id=String(g.game.id);const cached=boxCache.get(id);const rows=cached&&Date.now()-cached.at<86400000?cached.rows:await paced('/games/statistics/players?id='+id);
   const ids=new Set(rows.map(r=>String(r.team?.id)));if(![g.teams.away.id,g.teams.home.id].every(id=>ids.has(String(id))))throw new Error('A player box score is missing a team; league ratings withheld.');
   boxCache.set(id,{at:Date.now(),rows});boxes.set(id,rows);job.completed++;}
  job.data={league,season:q.season,before:q.before,players:buildRatings(games,boxes,rosters,q.before,league),builtAt:Date.now()};job.state='ready';
 }catch(e){job.state='error';job.message=e.message;}finally{job.finishedAt=Date.now();active=false;}}
 return q=>{const key=(q.league||'1')+':'+q.season+':'+q.before;for(const [k,j]of jobs)if(j.finishedAt&&Date.now()-j.finishedAt>(j.state==='error'?60000:3600000))jobs.delete(k);if(jobs.has(key))return jobs.get(key);if(active)return {state:'loading',completed:0,total:0,message:'Another league player rating build is running. This matchup will follow.'};const job={state:'loading',completed:0,total:0};jobs.set(key,job);void build(job,q);return job;};
}
module.exports={buildRatings,createRatings,role};
