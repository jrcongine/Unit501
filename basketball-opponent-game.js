'use strict';
const {positiveId}=require('./provider-id');
const sports={nba:'nba',ncaab:'mens-college-basketball'};
const statKeys={player_points:'points',player_rebounds:'rebounds',player_assists:'assists',player_threes:'threePointFieldGoalsMade-threePointFieldGoalsAttempted'};
function latest(log,sport,season,opponent,cutoff){
 const filter=(name,value)=>log.filters?.filter(f=>f.name===name&&String(f.value)===String(value)).length===1;
 if(!filter('league',sport)||!filter('season',season)||!log.events||!Array.isArray(log.seasonTypes))throw Error('Unverified player log');
 const games=Object.values(log.events);
 if(games.some(e=>!positiveId(e?.id)||!positiveId(e.opponent?.id)||!Number.isFinite(Date.parse(e.gameDate))))throw Error('Incomplete player log');
 const matches=games.filter(e=>String(e.opponent.id)===opponent&&Date.parse(e.gameDate)<cutoff).sort((a,b)=>Date.parse(b.gameDate)-Date.parse(a.gameDate));
 if(!matches.length)return null;
 const event=matches[0],time=Date.parse(event.gameDate);
 if(matches[1]&&Date.parse(matches[1].gameDate)===time)throw Error('Ambiguous meeting');
 const rows=log.seasonTypes.flatMap(t=>t.categories.flatMap(c=>c.events.filter(e=>String(e.eventId)===String(event.id))));
 if(rows.length!==1||!Array.isArray(rows[0].stats)||!Array.isArray(log.names))throw Error('Unverified appearance');
 return {event,row:rows[0],keys:log.names};
}
function stats(keys,values,rebound){
 const result={};
 for(const [market,field] of Object.entries(statKeys)){
  const key=market==='player_rebounds'?rebound:field,index=keys.indexOf(key);
  if(index<0||keys.lastIndexOf(key)!==index)throw Error('Invalid box columns');
  const raw=String(values[index]),made=market==='player_threes';
  if(!(made?/^\d+-\d+$/:/^\d+$/).test(raw))throw Error('Missing player stat');
  const [value,attempts]=raw.split('-').map(Number);
  if(made&&value>attempts)throw Error('Invalid shots');
  result[market]=value;
 }
 return result;
}
function verifyBox(box,match,player,opponent,season){
 const {event,row,keys}=match,h=box.header,c=h?.competitions?.length===1?h.competitions[0]:null;
 if(!c||String(h.id)!==String(event.id)||Number(h.season?.year)!==season||c.status?.type?.state!=='post'||c.status.type.completed!==true||Math.abs(Date.parse(c.date)-Date.parse(event.gameDate))>3600000||!Number.isFinite(Date.parse(c.date)))throw Error('Final game identity unavailable');
 const team=String(event.team?.id),sides=c.competitors||[];
 if(team===opponent||sides.length!==2||![team,opponent].every(id=>sides.some(t=>String(t.team?.id)===id)))throw Error('Opponent mismatch');
 const groups=(box.boxscore?.players||[]).filter(t=>String(t.team?.id)===team);
 if(groups.length!==1||groups[0].statistics?.length!==1)throw Error('Missing player box');
 const section=groups[0].statistics[0],athletes=section.athletes.filter(p=>String(p.athlete?.id)===player);
 if(athletes.length!==1||athletes[0].didNotPlay!==false||!athletes[0].athlete.displayName||!Array.isArray(athletes[0].stats)||!section.keys.includes('minutes')||!(Number(athletes[0].stats[section.keys.indexOf('minutes')])>0))throw Error('Participation unavailable');
 const values=stats(section.keys,athletes[0].stats,'rebounds'),logValues=stats(keys,row.stats,'totalRebounds');
 if(Object.keys(values).some(k=>values[k]!==logValues[k]))throw Error('Conflicting game statistics');
 const stage={1:'Preseason',2:'Regular season',3:'Postseason',5:'Play-in'}[Number(h.season.type)]||'';
 return {player,name:athletes[0].athlete.displayName,opponent,gameId:String(event.id),time:Date.parse(c.date),stage,values};
}
function createLookup({fetcher=fetch,now=Date.now}={}){
 const cache=new Map();
 async function read(url){const r=await fetcher(url,{signal:AbortSignal.timeout(9000),redirect:'error'});if(!r.ok)throw Error('Source unavailable');return r.json();}
 return async function lookup(league,player,opponent,kickoff){
  if(!Object.hasOwn(sports,league)||!/^\d{1,12}$/.test(player)||!/^\d{1,12}$/.test(opponent)||!Number.isSafeInteger(kickoff)||kickoff<=now()||kickoff>now()+45*86400000)return null;
  const key=[league,player,opponent,kickoff].join('/'),cached=cache.get(key);
  if(cached&&now()-cached.at<300000)return cached.pending;
  const sport=sports[league],date=new Date(kickoff),year=date.getUTCFullYear()+(date.getUTCMonth()>=6?1:0);
  const pending=(async()=>{
   for(const season of [year,year-1]){
    const log=await read('https://site.web.api.espn.com/apis/common/v3/sports/basketball/'+sport+'/athletes/'+player+'/gamelog?season='+season);
    const match=latest(log,sport,season,opponent,Math.min(kickoff,now()));
    if(match){
     const box=await read('https://site.api.espn.com/apis/site/v2/sports/basketball/'+sport+'/summary?event='+match.event.id);
     return verifyBox(box,match,player,opponent,season);
    }
   }
   return null;
  })().catch(()=>null);
  if(cache.size>=200)cache.delete(cache.keys().next().value);
  cache.set(key,{at:now(),pending});return pending;
 };
}
module.exports={createLookup,latest,verifyBox};
