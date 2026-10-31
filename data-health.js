'use strict';
// Passive request telemetry. Never fetches providers or retains URLs/payloads.
const SPORTS={nfl:'NFL',ncaaf:'College football',nba:'NBA',ncaab:'College basketball'};
const KINDS={games:'Schedule',odds:'FanDuel lines',props:'FanDuel props',injuries:'Availability',context:'Team history','player-history':'Player history',participation:'Player participation'};
const SOURCES={covers:'Covers',wagertalk:'WagerTalk',boyds:'Boyd’s Bets',pickswise:'Pickswise'};
function route(url){
 const p=url.pathname,q=url.searchParams;
 const sport=q.get('league')==='1'?'nfl':q.get('league')==='2'?'ncaaf':null;
 const football={'/api/games':'games','/api/fanduel':'odds','/api/fanduel-props':'props','/api/football/player-lines':'props','/api/availability':'injuries','/api/football/participation':'participation','/api/team-games':'context','/api/player-stats':'player-history','/api/team-stats':'team-boxes','/api/rankings':'rankings','/api/player-ratings':'ratings','/api/football/comparison':'comparison','/api/game-venue':'venue'};
 if(football[p]&&sport)return sport+':'+football[p];
 const match=p.match(/^\/api\/(nba|ncaab)\/(games|odds|props|injuries|context|player-history|comparison|travel|live-watch)$/);
 if(match)return match[1]+':'+match[2];
 if(p==='/api/weather')return 'weather';
 return null;
}
function time(value){
 if(value===null||value===undefined||value==='')return null;
 const n=typeof value==='number'?value:Date.parse(value);
 return Number.isFinite(n)&&n>0?n:null;
}
function assessment(data,kind,now){
 if(!data||typeof data!=='object'||data.error||data.errors&&Object.keys(data.errors).length)return {status:'failed',at:null};
 if(data.state==='error')return {status:'failed',at:null};
 if(data.state==='loading')return {status:'loading',at:null};
 const times=[];
 // Only explicit source/check timestamps; never manufacture a source update.
 function collect(item,depth=0){
  if(!item||typeof item!=='object'||depth>4)return;
  for(const [key,value] of Object.entries(item)){
   if(['checkedAt','fetchedAt','reportAt','updatedAt','spreadUpdated','totalUpdated','asOf'].includes(key)){
    const at=time(value);if(at!==null&&at<=now+60000)times.push(at);
   }else if(typeof value==='object')collect(value,depth+1);
  }
 }
 collect(data);
 const at=times.length?Math.min(...times):null;
 let status='working';
 if(kind==='travel'){const sides=[data.away,data.home];status=sides.every(t=>t?.available===true)?'working':sides.some(t=>t?.available===true)?'partial':'unavailable';}
 if(kind==='context'&&[data.away,data.home].some(t=>t?.available===false||t?.conflicts>0||t?.unverifiedGames>0||t?.coverage?.conflictingGames>0||t?.coverage?.unverifiedGames>0||t?.coverage?.invalid>0))status='partial';
 if(kind==='participation'&&(!Array.isArray(data.response)||data.response.length!==1||data.response[0].available!==true))status='unavailable';
 if(data.available===false||data.current===false)status='unavailable';
 if(data.available!==false && (kind==='props'&&Array.isArray(data.props)&&!data.props.length||kind==='games'&&Array.isArray(data.games)&&!data.games.length||Array.isArray(data.response)&&!data.response.length))status='empty';
 if(kind==='props'&&Array.isArray(data.props)&&data.props.length&&data.audit&&(data.audit.rejected>0||data.audit.missingMarkets?.length>0))status='partial';
 if(kind==='injuries'){
  if(data.available===false||data.current===false||!Array.isArray(data.teams)||!data.teams.length)status='unavailable';
  else if(data.teams.some(t=>t.available===false||t.roster?.available===false||t.injuries?.available===false||t.official?.available===false||t.official?.unmatched>0||t.official?.unresolved?.length>0))status='partial';
  else if(data.teams.every(t=>!(t.players?.length||t.injuries?.rows?.length)))status='empty';
 }
 if(kind==='player-history'&&data.teams?.some(t=>t.available===false||t.players?.some(p=>p.available===false||p.coverage?.missing>0||p.missing?.length||p.results?.some(r=>['player_points','player_rebounds','player_assists','player_threes'].some(k=>!Number.isInteger(r[k])||r[k]<0)))))status='partial';
 return {status,at};
}
function createHealth({now=Date.now,file=''}={}){
 const store=require('./health-store').createStore(file);
 const startedAt=new Date(now()).toISOString(),rows=new Map();
 const add=(id,label,ttl)=>rows.set(id,{id,label,ttl,status:'unchecked',lastResponseAt:null,lastSuccessAt:null,sourceAt:null});
 for(const [sport,label] of Object.entries(SPORTS))for(const [kind,name] of Object.entries(KINDS)){
  if(['nba','ncaab'].includes(sport)&&kind==='participation')continue;
  add(sport+':'+kind,label+' · '+name,kind==='injuries'?15*60000:['games','odds','props'].includes(kind)?30*60000:60*60000);
 }
 for(const sport of ['nfl','ncaaf'])for(const [kind,label] of Object.entries({rankings:'Team rankings',ratings:'Player ratings','team-boxes':'Team box scores',comparison:'Sportsbook comparison',venue:'Venue',roster:'Roster',official:'Official injuries',depth:'Depth chart'}))add(sport+':'+kind,SPORTS[sport]+' · '+label,15*60000);
 for(const [kind,label,ttl] of [['comparison','Sportsbook comparison',30*60000],['travel','Travel',60*60000],['live-watch','Live scoreboard',3*60000]])add('nba:'+kind,'NBA · '+label,ttl);
 for(const sport of ['nfl','ncaaf','nba','mlb','nhl'])for(const [kind,label] of [['standings','Standings'],['headlines','Headlines']])add(sport+':'+kind,(SPORTS[sport]||sport.toUpperCase())+' · '+label,60*60000);
 add('weather','Weather · Open-Meteo',30*60000);
 for(const sport of ['nfl','ncaaf','nba','ncaab','mlb','nhl'])for(const [source,label] of Object.entries(SOURCES))add(sport+':'+source,(SPORTS[sport]||sport.toUpperCase())+' · '+label,60*60000);
 const states=new Set(['working','empty','partial','failed','unavailable','loading']);
 for(const saved of store.load()){
  const row=rows.get(saved?.id);if(!row||!states.has(saved.status))continue;
  const keys=['lastResponseAt','lastSuccessAt','sourceAt'];
  if(!keys.every(k=>saved[k]===null||Number.isFinite(saved[k])&&saved[k]>0&&saved[k]<=now()+60000)||saved.lastResponseAt===null||saved.lastSuccessAt>saved.lastResponseAt)continue;
  for(const key of ['status',...keys])row[key]=saved[key];
 }
 function persist(){store.save([...rows.values()].filter(r=>r.status!=='unchecked').map(({id,status,lastResponseAt,lastSuccessAt,sourceAt})=>({id,status,lastResponseAt,lastSuccessAt,sourceAt})));}
 function record(id,result){
  const row=rows.get(id);if(!row)return;
  row.status=result.status;row.lastResponseAt=now();row.sourceAt=result.at;
  if(['working','empty','partial'].includes(result.status))row.lastSuccessAt=now();
  persist();
 }
 function observe(url,code,data){
  // Input errors and missing matchups are not evidence of provider failure.
  if(code>=400&&code<500&&code!==429)return;
  const id=route(url);
  if(id)record(id,(code>=500||code===429)?{status:'failed',at:null}:assessment(data,id.split(':')[1],now()));
  if(url.pathname==='/api/availability'){
   const sport=url.searchParams.get('league')==='1'?'nfl':url.searchParams.get('league')==='2'?'ncaaf':null;
   if(sport)for(const kind of ['roster','official','depth']){
    const records=(data?.teams||[]).map(t=>t[kind]),good=records.filter(r=>r?.available===true);
    const incomplete=good.some(r=>r.unmatched>0||r.unresolved?.length>0);
    const status=code>=500||code===429?'failed':!records.length||!good.length?'unavailable':good.length===records.length&&!incomplete?'working':'partial';
    const stamps=records.map(r=>time(r?.checkedAt)).filter(t=>t!==null&&t<=now()+60000);
    record(sport+':'+kind,{status,at:stamps.length?Math.min(...stamps):null});
   }
  }
  if(url.pathname==='/api/league-pulse'){
   const sport=url.searchParams.get('league')||'nfl';
   for(const [kind,key] of [['standings','power'],['headlines','headlines']]){
    const part=data?.[key];record(sport+':'+kind,code>=500||code===429?{status:'failed',at:null}:assessment(part,kind,now()));
   }
  }
  if(url.pathname==='/api/outside-picks'){
   const league=url.searchParams.get('league')||'nfl';
   if(code>=500||code===429){for(const source of Object.keys(SOURCES))record(league+':'+source,{status:'failed',at:null});return;}
   for(const source of data?.sources||[]){
    const status=source.status==='available'?'working':source.status==='empty'?'empty':'failed';
    record(league+':'+source.source,{status,at:time(source.checkedAt)});
   }
  }
 }
 function snapshot(){
  return {storage:store.status(),startedAt,checkedAt:new Date(now()).toISOString(),scope:'Latest requested matchup or slate per feed on this server. Unchecked feeds have no recorded observations. Saved status retains its original timestamps across restarts when storage is available. A working response does not verify every game or starting lineup.',
   feeds:[...rows.values()].map(row=>{
    const stale=['working','empty','partial','loading'].includes(row.status)&&now()-(row.sourceAt??row.lastResponseAt)>row.ttl;
    return {id:row.id,label:row.label,status:stale?'stale':row.status,
     lastResponseAt:row.lastResponseAt===null?null:new Date(row.lastResponseAt).toISOString(),
     lastSuccessAt:row.lastSuccessAt===null?null:new Date(row.lastSuccessAt).toISOString(),
     sourceAt:row.sourceAt===null?null:new Date(row.sourceAt).toISOString()};
   })};
 }
 return {observe,snapshot,flush:store.flush};
}
module.exports={createHealth,assessment,route};
