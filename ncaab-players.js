'use strict';
const {retainIdentity}=require('./basketball-player-identity');
const {recordAppearance,stat,minutes,extractInactive,reconcileCoverage,conflictingDNP}=require('./nba-player-history');
const ROOT='https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/summary?event=';
const fields={player_points:'points',player_rebounds:'rebounds',player_assists:'assists',player_threes:'threePointFieldGoalsMade-threePointFieldGoalsAttempted'};
function verify(data,game){const c=data?.header?.competitions?.length===1?data.header.competitions[0]:null;
 if((game.season!==undefined&&Number(data?.header?.season?.year)!==Number(game.season))||(game.stage!==undefined&&Number(data?.header?.season?.type)!==Number(game.stage))||String(data?.header?.id)!==String(game.id)||!c||Date.parse(c.date)!==Date.parse(game.tipoff)||!Array.isArray(c.competitors)||c.competitors.length!==2||!c.competitors.some(t=>String(t.id)===game.awayId&&t.homeAway==='away')||!c.competitors.some(t=>String(t.id)===game.homeId&&t.homeAway==='home'))throw Error('College game identity unverified');return c;}
function injuries(data,game){verify(data,game);const lists=Array.isArray(data.injuries)?data.injuries:[];
 return [game.awayId,game.homeId].map((id,i)=>{const groups=lists.filter(x=>String(x?.team?.id)===id);
 const valid=groups.length===1&&Array.isArray(groups[0].injuries);
 // Preserve reported names/statuses even when duplicate sections are ambiguous.
 // Missing sections are unknown; they are never a clean bill of health.
 const rows=groups.flatMap(g=>Array.isArray(g.injuries)?g.injuries:[]);
 const players=rows.map(x=>({name:String(x?.athlete?.displayName||'').trim().slice(0,100),status:String(x?.status||x?.type?.description||'Status unconfirmed').slice(0,80),detail:String(x?.longComment||x?.shortComment||'').slice(0,300),date:x?.date||null})).filter(x=>x.name);
 const malformed=players.length!==rows.length;
 return {team:[game.away,game.home][i],teamId:id,available:valid&&!malformed,players,
 message:groups.length>1?'Conflicting team report sections; player availability is unverified.':!valid?'Team injury report missing or malformed; availability is unknown.':malformed?'Some injury rows have no verified player name; coverage is incomplete.':'Provider report checked; this does not confirm full health or starting roles.'};});}
function extract(data,game,teamId){const c=verify(data,game);if(c.status?.type?.completed!==true||c.status.type.state!=='post')throw Error('Game not final');
 const boxes=(data.boxscore?.players||[]).filter(b=>String(b.team?.id)===teamId);if(boxes.length!==1||boxes[0].statistics?.length!==1)throw Error('Box score unavailable');
 const group=boxes[0].statistics[0],keys=group.keys,rows=group.athletes;if(!Array.isArray(keys)||!Array.isArray(rows)||rows.length>40||new Set(keys).size!==keys.length||!keys.includes('minutes'))throw Error('Invalid box score');
 const seen=new Set(),out=[];for(const row of rows){
 const id=String(row.athlete?.id||''),name=String(row.athlete?.displayName||'').trim();
 if(!/^\d{1,12}$/.test(id)||!name||seen.has(id)||typeof row.didNotPlay!=='boolean')throw Error('Player identity or participation unverified');
 seen.add(id);if(conflictingDNP(row,keys))throw Error('Conflicting college participation');if(row.didNotPlay)continue;
 const min=minutes(row.stats?.[keys.indexOf('minutes')]);
 const values={};for(const [market,k] of Object.entries(fields))values[market]=stat(row.stats?.[keys.indexOf(k)],market==='player_threes');out.push({id,name,minutes:min,...values,...(min===null||min===0?{available:false}:{})});}return out;}

function createPlayers({feed,fetcher=fetch,now=Date.now,official}={}){const cache=new Map();async function box(id){const old=cache.get(id);if(old&&now()-old.at<300000)return old.pending;const item={at:now()};item.pending=(async()=>{const r=await fetcher(ROOT+id,{signal:AbortSignal.timeout(12000),redirect:'error'});if(!r.ok||Number(r.headers?.get?.('content-length')||0)>5000000)throw Error('College basketball summary unavailable');return r.json();})();cache.set(id,item);item.pending.catch(()=>{if(cache.get(id)===item)cache.delete(id);});if(cache.size>200)cache.delete(cache.keys().next().value);return item.pending;}
 return {injuries:async game=>({gameId:game.id,tipoff:game.tipoff,checkedAt:now(),source:'ESPN game report',teams:injuries(await box(game.id),game)}),history:async game=>{
 const context=await feed.context(game),sides=[context.away,context.home],jobs=new Map();for(const side of sides)if(!(side.conflicts>0||side.unverifiedGames>0))for(const g of side.recentGames||[])jobs.set(g.id,g);
 let next=0;const ids=[...jobs.keys()],results=new Map(),officialReports=new Map();await Promise.all(Array.from({length:Math.min(4,ids.length)},async()=>{while(next<ids.length){const id=ids[next++];try{const data=await box(id);results.set(id,data);if(official)officialReports.set(String(id),await official(data));}catch{}}}));
 const teams=sides.map(side=>{const players=new Map();if(side.conflicts>0||side.unverifiedGames>0)return {name:side.name,available:false,games:0,players:[]};let games=0;for(const prior of side.recentGames||[]){try{const data=results.get(prior.id),header=data?.header?.competitions?.[0],competitors=header?.competitors;if(!Array.isArray(competitors)||competitors.length!==2)continue;
 const own=competitors.find(t=>String(t.id)===side.id),other=competitors.find(t=>String(t.id)!==side.id);if(!own||!other||Number(own.score)!==prior.scored||Number(other.score)!==prior.allowed||String(other.id)!==prior.opponentId)continue;
 const historical={id:prior.id,tipoff:prior.tipoff,season:game.season,stage:game.stage,awayId:String(competitors.find(t=>t.homeAway==='away')?.id),homeId:String(competitors.find(t=>t.homeAway==='home')?.id)};
 const rows=extract(data,historical,side.id);for(const row of rows){const old=players.get(row.id);if(!retainIdentity(old,row))throw Error('Player identity changed');const p=old||{id:row.id,name:row.name,available:true,results:[],inactive:[]};recordAppearance(p,{...row,values:Object.fromEntries(Object.keys(fields).map(k=>[k,row[k]]))},prior);players.set(row.id,p);}
 for(const row of extractInactive(data,side.id,rows)){
 const old=players.get(row.id);if(!retainIdentity(old,row))throw Error('Player identity changed');
 const p=old||{id:row.id,name:row.name,available:true,results:[],inactive:[]};p.inactive.push({gameId:prior.id,tipoff:prior.tipoff});players.set(row.id,p);
 }games++;}catch{}}
 const verification=require('./nba-official-history').reconcile(players,side.recentGames||[],officialReports,side.id);
 reconcileCoverage(players,side.recentGames||[]);
 return {name:side.name,available:games>=2&&games===(side.recentGames||[]).length,games,verification,players:[...players.values()]};});return {gameId:game.id,tipoff:game.tipoff,checkedAt:now(),teams,source:official?'NCAA official reconciliation with ESPN completed college basketball box scores':'ESPN completed college basketball box scores'};}};
}
module.exports={verify,injuries,extract,createPlayers};
