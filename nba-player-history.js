'use strict';
// Public NBA box scores only: selected matchup and every historical game must match.
const {teamCode}=require('./nba-injuries');
const ROOT='https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=';
const METRICS={player_points:'points',player_rebounds:'rebounds',player_assists:'assists',player_threes:'threePointFieldGoalsMade-threePointFieldGoalsAttempted'};
function stat(value,three=false){
 if(typeof value!=='string'&&typeof value!=='number')return null;
 const s=String(value).trim();
 if(three){const m=/^(\d+)-(\d+)$/.exec(s);return m&&Number(m[1])<=Number(m[2])?Number(m[1]):null;}
 return /^\d+$/.test(s)?Number(s):null;
}
function minutes(value){
 const m=/^(\d{1,2})(?::([0-5]\d))?$/.exec(String(value??'').trim());
 if(!m)return null;const v=Number(m[1])+(Number(m[2]||0)/60);return v<=60?v:null;
}
function conflictingDNP(row,keys){
 if(row.didNotPlay!==true||!Array.isArray(row.stats))return false;
 return keys.some((key,i)=>{
  const value=row.stats[i];
  if(key==='minutes')return minutes(value)>0;
  if(/^(\d+)-(\d+)$/.test(String(value??'').trim())){
   const pair=/^(\d+)-(\d+)$/.exec(String(value??'').trim());
   return pair&&pair.some((v,j)=>j>0&&Number(v)>0);
  }
  return stat(value)>0;
 });
}
function extractBox(data,prior,teamId,season,stage){
 const header=data?.header,competition=header?.competitions?.length===1?header.competitions[0]:null;
 if(String(header?.id)!==String(prior.id)||Number(header?.season?.year)!==season+1||Number(header?.season?.type)!==stage||
  competition?.status?.type?.completed!==true||competition.status.type.state!=='post'||
  Date.parse(competition.date)!==Date.parse(prior.tipoff)||!Array.isArray(competition.competitors)||competition.competitors.length!==2)throw Error('NBA box score game identity unverified');
 const own=competition.competitors.filter(t=>String(t.id)===String(teamId));
 const opponent=competition.competitors.filter(t=>String(t.id)===String(prior.opponentId));
 if(own.length!==1||opponent.length!==1||own[0].homeAway!==prior.venue||own[0].homeAway===opponent[0].homeAway||
  !Number.isInteger(prior.for)||!Number.isInteger(prior.against)||Number(own[0].score)!==prior.for||Number(opponent[0].score)!==prior.against)throw Error('NBA box score teams or final scores unverified');
 const boxes=data?.boxscore?.players?.filter(t=>String(t.team?.id)===String(teamId));
 if(!boxes||boxes.length!==1||!Array.isArray(boxes[0].statistics)||boxes[0].statistics.length!==1)throw Error('NBA player box score unavailable');
 const group=boxes[0].statistics[0],keys=group.keys,athletes=group.athletes;
 if(!Array.isArray(keys)||!Array.isArray(athletes)||athletes.length>40||new Set(keys).size!==keys.length||!keys.includes('minutes'))throw Error('NBA box score fields unavailable');
 const output=[],seen=new Set();
 for(const row of athletes){
  if(typeof row.didNotPlay!=='boolean')throw Error('NBA participation unavailable');
  const id=String(row.athlete?.id||''),name=String(row.athlete?.displayName||'').trim(),stats=row.stats;
  if(!/^\d{1,12}$/.test(id)||!name||name.length>100||(!row.didNotPlay&&!Array.isArray(stats)))throw Error('NBA player identity unavailable');
  if(seen.has(id))throw Error('Duplicate NBA player box score');seen.add(id);
  if(conflictingDNP(row,keys))throw Error('Conflicting NBA participation');
  if(row.didNotPlay)continue;
  const min=minutes(stats[keys.indexOf('minutes')]);
  const values=Object.fromEntries(Object.entries(METRICS).map(([market,key])=>[market,stat(stats[keys.indexOf(key)],market==='player_threes')]));
  output.push({id,name,minutes:min,values,...(min===null||min===0?{available:false}:{})});
 }
 if(!output.length)throw Error('NBA box score has no verified player appearances');
 return output;
}
// Only explicit didNotPlay rows are treated as absent; a missing player row
// may reflect a trade, roster change or incomplete source rather than injury.
function extractInactive(data,teamId,active){
 const team=data?.boxscore?.players?.filter(t=>String(t.team?.id)===String(teamId));
 const rows=team?.[0]?.statistics?.[0]?.athletes;
 if(team?.length!==1||!Array.isArray(rows))return [];
 const seen=new Set(active.map(p=>p.id)),out=[];
 for(const row of rows){
  if(row.didNotPlay!==true)continue;
  const id=String(row.athlete?.id||''),name=String(row.athlete?.displayName||'').trim();
  if(!/^\d{1,12}$/.test(id)||!name||name.length>100||seen.has(id))continue;
  seen.add(id);out.push({id,name});
 }
 return out;
}
function recordAppearance(player,row,game){
 const result={gameId:game.id,tipoff:game.tipoff,minutes:row.minutes,...row.values};
 if(row.available===false){player.unverified=player.unverified||[];player.unverified.push(result);}
 else player.results.push(result);
}
function reconcileCoverage(players,games){
 for(const p of players.values()){
  const appearances=p.results||[],inactive=p.inactive||[];
  if(p.unverified?.length)p.available=false;
  const ids=[...appearances,...inactive].map(g=>String(g.gameId));
  const expected=new Set(games.map(g=>String(g.id)));
  // Duplicate, contradictory or out-of-window rows cannot establish coverage.
  if(expected.size!==games.length||new Set(ids).size!==ids.length||ids.some(id=>!expected.has(id)))p.available=false;
  const known=new Set(ids);
  p.missing=games.filter(g=>!known.has(String(g.id))).map(g=>({gameId:g.id,tipoff:g.tipoff}));
  p.coverage={total:games.length,played:p.results.length,dnp:(p.inactive||[]).length,missing:p.missing.length};
 }
}
function createPlayerHistory({publicFeed,fetcher=fetch,now=Date.now,official}={}){
 const cache=new Map();
 async function box(id){
  const key=String(id);if(!/^\d{1,12}$/.test(key))throw Error('Invalid historical NBA game');
  const old=cache.get(key);if(old&&(!old.done||now()-old.at<(old.failed?900000:6*3600000)))return old.pending;
  const item={done:false,failed:false,at:now()};
  item.pending=(async()=>{
   const r=await fetcher(ROOT+key,{signal:AbortSignal.timeout(12000),redirect:'error'});
   if(!r.ok||Number(r.headers?.get?.('content-length')||0)>5000000)throw Error('NBA historical box score unavailable');
   const data=await r.json();if(!data||typeof data!=='object')throw Error('NBA box score malformed');return data;
  })().then(data=>{item.done=true;item.at=now();return data;}).catch(e=>{item.done=true;item.failed=true;item.at=now();throw e;});
  cache.set(key,item);
  if(cache.size>200)for(const [k,v] of cache)if(v.done){cache.delete(k);break;}
  return item.pending;
 }
 return async function get(selected,date,season){
  if(!selected||selected.statusCode!==1||!Number.isInteger(season)||!Number.isFinite(Date.parse(selected.tipoff))||Date.parse(selected.tipoff)<=now())throw Error('Scheduled NBA game required');
  const slate=await publicFeed.games(date),matches=slate.games.filter(g=>g.statusCode===1&&teamCode(g.away)===teamCode(selected.away)&&teamCode(g.home)===teamCode(selected.home)&&teamCode(g.away)&&teamCode(g.home)&&Math.abs(Date.parse(g.tipoff)-Date.parse(selected.tipoff))<=15*60000&&g.stage===selected.stage);
  if(matches.length!==1||slate.season!==season)throw Error('Public NBA matchup could not be verified');
  const match=matches[0],context=await publicFeed.context(match,season);
  const sides=[context.away,context.home],historical=sides.map(s=>s?.available&&s.coverage?.conflictingGames===0&&!(s.coverage.unverifiedGames>0)&&!(s.coverage.invalid>0)&&Array.isArray(s.recentGames)?s.recentGames.slice(0,10):[]);
  const jobs=new Map();for(const games of historical)for(const g of games)jobs.set(String(g.id),g.id);
  // Bound public-source concurrency for each matchup; all viewers share cached games.
  const ids=[...jobs.values()],results=new Map();let next=0;
  await Promise.all(Array.from({length:Math.min(4,ids.length)},async()=>{while(next<ids.length){const id=ids[next++];try{const data=await box(id);let report=null;try{if(official)report=await official(data);}catch{}results.set(String(id),{data,official:report});}catch{results.set(String(id),{error:true});}}}));
  const teams=sides.map((side,i)=>{
   const games=historical[i],players=new Map();
   if(games.length<2)return {name:side?.name||[match.away,match.home][i],available:false,games:games.length,players:[]};
   try{
    for(const game of games){const result=results.get(String(game.id));if(!result||result.error)throw Error('Missing NBA box score');
     const active=extractBox(result.data,game,side.id,season,match.stage);
     for(const row of active){
      const old=players.get(row.id);if(old&&old.name!==row.name)throw Error('Player identity changed');
      const player=old||{id:row.id,name:row.name,available:true,results:[],inactive:[]};recordAppearance(player,row,game);players.set(row.id,player);
     }
     for(const row of extractInactive(result.data,side.id,active)){
      const old=players.get(row.id);if(old&&old.name!==row.name)throw Error('Player identity changed');
      const player=old||{id:row.id,name:row.name,available:true,results:[],inactive:[]};
      player.inactive.push({gameId:game.id,tipoff:game.tipoff});players.set(row.id,player);
     }
    }
    const verification=require('./nba-official-history').reconcile(players,games,new Map([...results].map(([id,r])=>[id,r.official])),side.id);
    reconcileCoverage(players,games);
    return {name:side.name,available:true,games:games.length,gameSource:'espn',
      gameLog:games.map(g=>({id:String(g.id),tipoff:g.tipoff,opponent:g.opponent,venue:g.venue,for:g.for,against:g.against})),
      verification,players:[...players.values()]};
   }catch{return {name:side?.name||[match.away,match.home][i],available:false,games:games.length,players:[]};}
  });
  return {gameId:selected.id,tipoff:selected.tipoff,checkedAt:now(),source:official?'NBA official reconciliation with ESPN completed box scores':'ESPN completed NBA box scores',teams};
 };
}
module.exports={recordAppearance,conflictingDNP,METRICS,stat,minutes,extractBox,extractInactive,reconcileCoverage,createPlayerHistory};
