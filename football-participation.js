'use strict';
const {fbsName}=require('./team-identity');
const {createGamebooks}=require('./football-gamebook');
const {createDiscovery}=require('./football-official-discovery');
const ROOT='https://site.api.espn.com/apis/site/v2/sports/football/';
const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const integer=v=>typeof v==='number'&&Number.isInteger(v)?v:typeof v==='string'&&/^-?\d+$/.test(v)?Number(v):null;
const specs={passing:{'completions/passingAttempts':'attempts',passingYards:'passYds',passingTouchdowns:'passTD'},rushing:{rushingAttempts:'carries',rushingYards:'rushYds',rushingTouchdowns:'rushTD'},receiving:{receptions:'rec',receivingYards:'recYds',receivingTouchdowns:'recTD',receivingTargets:'targets'}};
const day=time=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(time));
function sameTeam(publicTeam,provider,league,season){
 if(league==='1')return normalize(publicTeam?.displayName)===normalize(provider?.name);
 const a=fbsName({name:publicTeam?.displayName},season),b=fbsName(provider,season);return !!a&&a===b;
}
function matchedEvent(e,g,q){
 const c=e?.competitions?.length===1?e.competitions[0]:null,teams=c?.competitors;
 if(!/^\d{1,12}$/.test(String(e?.id))||Number(e.season?.year)!==Number(q.season)||Number(e.season?.type)!==2||c?.status?.type?.completed!==true||c.status.type.state!=='post'||Math.abs(Date.parse(c.date)-g.game.date.timestamp*1000)>15*60000||!Array.isArray(teams)||teams.length!==2)return false;
 return ['away','home'].every(side=>{const found=teams.filter(t=>t.homeAway===side);return found.length===1&&sameTeam(found[0].team,g.teams?.[side],q.league,q.season)&&integer(found[0].score)!==null&&integer(found[0].score)===integer(g.scores?.[side]?.total);});
}
function parseBox(data,event,g,q){
 const h=data?.header;if(String(h?.id)!==String(event.id)||!matchedEvent(h,g,q)||Date.parse(h.competitions[0].date)!==Date.parse(event.competitions[0].date))throw Error('Secondary game identity unverified');
 const teams=[];
 for(const side of ['away','home']){
  const identity=h.competitions[0].competitors.find(t=>t.homeAway===side),boxes=data.boxscore?.players?.filter(t=>String(t.team?.id)===String(identity.id));
  if(boxes?.length!==1||!Array.isArray(boxes[0].statistics))throw Error('Secondary box score unavailable');
  const groups=boxes[0].statistics,players=new Map();
  // A positive/nonzero recorded event, or explicit participation flag, proves
  // appearance. Merely being absent from a receiving table never does.
  for(const group of groups)for(const row of group.athletes||[]){
   const id=String(row.athlete?.id||''),name=row.athlete?.displayName;
   if(!/^\d{1,12}$/.test(id)||!name||!Array.isArray(row.stats))continue;
   const evidence=row.stats.some(v=>typeof v==='string'&&/^-?\d+(?:\.\d+)?$/.test(v)&&Number(v)!==0||typeof v==='string'&&/^\d+\/\d+$/.test(v)&&v.split('/').some(n=>Number(n)>0));
   if(row.didNotPlay===true&&evidence)throw Error('Conflicting secondary participation');
   if(!evidence&&row.didNotPlay!==false&&row.didNotPlay!==true)continue;
   const participation=row.didNotPlay===true?'dnp':'played',old=players.get(id);
   if(old&&(old.name!==name||old.participation!==participation))throw Error('Ambiguous secondary player');
   if(!old)players.set(id,{name,participation,markets:[]});
  }
  for(const [category,fields]of Object.entries(specs)){
   const matches=groups.filter(s=>s.name===category);if(matches.length!==1)continue;
   const group=matches[0],keys=group.keys,rows=group.athletes,totals=group.totals;
   if(!Array.isArray(keys)||new Set(keys).size!==keys.length||!Array.isArray(rows)||!Array.isArray(totals)||rows.length>150||new Set(rows.map(r=>String(r.athlete?.id))).size!==rows.length)continue;
   for(const [field,market]of Object.entries(fields)){
    const index=keys.indexOf(field);if(index<0)continue;
    const read=v=>{if(field==='completions/passingAttempts'){const pair=/^(\d+)\/(\d+)$/.exec(String(v));return pair&&Number(pair[1])<=Number(pair[2])?Number(pair[2]):null;}const n=integer(v);return n!==null&&(market.endsWith('Yds')||n>=0)?n:null;};
    const total=read(totals[index]),values=rows.map(r=>read(r.stats?.[index]));
    if(total===null||values.some(v=>v===null)||values.reduce((a,b)=>a+b,0)!==total)continue;
    for(const [id,p]of players){if(p.participation!=='played')continue;const i=rows.findIndex(r=>String(r.athlete?.id)===id);p[market]=i<0?0:values[i];p.markets.push(market);}
   }
  }
  teams.push({id:String(g.teams[side].id),name:g.teams[side].name,scored:integer(g.scores[side].total),allowed:integer(g.scores[side==='away'?'home':'away'].total),players:[...players.values()]});
 }
 return {available:true,gameId:String(q.game),gameDate:Number(g.game.date.timestamp),league:q.league,season:q.season,source:ROOT+(q.league==='1'?'nfl':'college-football')+'/summary?event='+event.id,nameFormat:'full',teams};
}
function createParticipation({api,fetcher=fetch,now=Date.now,official,ncaa}={}){
 const cache=new Map();
 async function read(url){const old=cache.get(url);if(old&&now()-old.at<6*3600000)return old.pending;
  const item={at:now(),pending:(async()=>{const r=await fetcher(url,{signal:AbortSignal.timeout(12000),redirect:'error'});if(!r.ok||Number(r.headers?.get?.('content-length')||0)>8000000)throw Error('Secondary statistics unavailable');const text=await r.text();if(text.length>8000000)throw Error('Secondary response too large');return JSON.parse(text);})()};cache.set(url,item);item.pending.catch(()=>{if(cache.get(url)===item)cache.delete(url);});if(cache.size>150)cache.delete(cache.keys().next().value);return item.pending;
 }
 const discover=createDiscovery({fetcher,now});
 const gamebooks=official||createGamebooks({api,fetcher,now,discover});
 return async q=>{
  const no={available:false,gameId:String(q.game),reason:'Participation or statistics could not be verified.'};
  if(!['1','2'].includes(q.league)||!/^20\d{2}$/.test(q.season)||!/^\d{4}-\d{2}-\d{2}$/.test(q.date)||!/^\d{1,12}$/.test(q.game))return no;
  if(q.league==='1'&&!q.fullNamesOnly){const result=await gamebooks(q);if(result.available)return result;}
  try{
   const r=await api('/games?id='+encodeURIComponent(q.game)),g=r.response?.[0],time=Number(g?.game?.date?.timestamp);
   if(r.errors&&Object.keys(r.errors).length||r.paging?.total>1||r.response?.length!==1||String(g.game?.id)!==q.game||String(g.league?.id)!==q.league||String(g.league?.season)!==q.season||!['FT','AOT','FINAL'].includes(g.game?.status?.short)||!/^regular season$/i.test(g.game?.stage||'')||!Number.isFinite(time)||time*1000>=now()||day(time*1000)!==q.date)throw Error('Completed game unverified');
   if(q.league==='2'&&ncaa&&!q.fullNamesOnly){const result=await ncaa({sport:'MFB',id:q.game,season:Number(q.season),tipoff:new Date(time*1000).toISOString(),teams:['away','home'].map(side=>({side,id:String(g.teams[side].id),name:g.teams[side].name,score:integer(g.scores[side].total)}))});if(result.available)return result;}
   const root=ROOT+(q.league==='1'?'nfl':'college-football'),utc=new Date(time*1000).toISOString().slice(0,10);
   const slates=await Promise.all([...new Set([q.date,utc])].map(date=>read(root+'/scoreboard?dates='+date.replaceAll('-','')+'&limit=1000'+(q.league==='2'?'&groups=80':''))));
   if(slates.some(s=>!Array.isArray(s.events)||s.events.length>=1000))throw Error('Schedule unavailable');
   const matches=[];for(const slate of slates){const found=slate.events.filter(e=>matchedEvent(e,g,q));if(found.length>1)throw Error('Secondary matchup ambiguous');for(const e of found)if(!matches.some(m=>String(m.id)===String(e.id)))matches.push(e);}
   if(matches.length!==1)throw Error('Secondary matchup ambiguous');
   const report=parseBox(await read(root+'/summary?event='+matches[0].id),matches[0],g,q);return {...report,checkedAt:now()};
  }catch{return no;}
 };
}
module.exports={specs,matchedEvent,parseBox,createParticipation};
