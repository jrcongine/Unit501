'use strict';
const {matchPlayer}=require('./public/nba-player-model');
const {teamCode}=require('./nba-injuries');
const nameKey=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const fields={player_points:'points',player_rebounds:'reboundsTotal',player_assists:'assists',player_threes:'threePointersMade'};
function pageData(html){const matches=[...html.matchAll(/<script\b[^>]*\bid="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/g)];if(matches.length!==1)throw Error('Official NBA data unavailable');return JSON.parse(matches[0][1]).props?.pageProps;}
function duration(s){const m=/^PT(\d+)M(\d+(?:\.\d+)?)S$/.exec(s||'');return m&&Number(m[2])<60?Number(m[1])+Number(m[2])/60:null;}
function expectation(data){const h=data?.header,c=h?.competitions?.length===1?h.competitions[0]:null;if(c?.status?.type?.completed!==true||c.status.type.state!=='post'||!Array.isArray(c.competitors)||c.competitors.length!==2||![2,3].includes(Number(h.season?.type)))throw Error('Completed NBA identity required');
 const out={id:String(h.id),season:Number(h.season.year)-1,stage:Number(h.season.type),tipoff:c.date};
 if(!/^\d{1,12}$/.test(out.id)||!Number.isInteger(out.season)||!Number.isFinite(Date.parse(c.date)))throw Error('NBA identity unavailable');
 for(const side of ['away','home']){const rows=c.competitors.filter(t=>t.homeAway===side),t=rows[0];if(rows.length!==1||!teamCode(t.team?.displayName)||!/^\d+$/.test(String(t.score)))throw Error('NBA team identity unavailable');out[side]={id:String(t.id),code:teamCode(t.team.displayName),score:Number(t.score)};}
 if(out.away.code===out.home.code)throw Error('Duplicate NBA team');return out;
}
function findCard(data,e){const cards=(data?.gameCardFeed?.modules||[]).flatMap(m=>(m.cards||[]).map(c=>c.cardData));const matches=cards.filter(c=>c?.gameStatus===3&&c.seasonYear===`${e.season}-${String(e.season+1).slice(-2)}`&&c.seasonType===(e.stage===2?'Regular Season':'Playoffs')&&Date.parse(c.gameTimeUtc)===Date.parse(e.tipoff)&&['away','home'].every(s=>c[s+'Team']?.teamTricode===e[s].code&&c[s+'Team']?.score===e[s].score));if(matches.length!==1)throw Error('Official NBA matchup ambiguous');
 const c=matches[0],links=c.actions?.filter(a=>a.title==='Box Score').map(a=>a.resourceLocator?.resourceUrl)||[];
 if(!/^00[24]\d{7}$/.test(c.gameId)||links.length!==1||!new RegExp('^/game/[a-z]{2,3}-vs-[a-z]{2,3}-'+c.gameId+'/box-score$').test(links[0]))throw Error('Official NBA box score link unavailable');return {card:c,url:'https://www.nba.com'+links[0]};
}
function parseGame(game,card,e){
 if(game?.gameId!==card.gameId||game.gameStatus!==3||Date.parse(game.gameTimeUTC)!==Date.parse(e.tipoff))throw Error('Official NBA box identity mismatch');
 const teams=[];
 for(const side of ['away','home']){const t=game[side+'Team'],expected=e[side];if(t?.teamId!==card[side+'Team'].teamId||t.teamTricode!==expected.code||t.score!==expected.score||!Array.isArray(t.players)||t.players.length<5||t.players.length>25||!Array.isArray(t.inactives)||t.inactives.length>20)throw Error('Official NBA roster unavailable');
  const players=[],seen=new Set();
  for(const p of t.players){const id=String(p.personId),name=p.name,stats=p.statistics,min=duration(stats?.minutes);if(!/^\d+$/.test(id)||!name||seen.has(id)||!['0','1'].includes(p.played)||min===null||min>75||Object.values(fields).some(k=>!Number.isInteger(stats?.[k])||stats[k]<0))throw Error('Official NBA player invalid');seen.add(id);
   if(p.played==='0'&&(min!==0||Object.values(stats).some(v=>typeof v==='number'&&v!==0)))throw Error('Official NBA DNP conflict');
   players.push({name,participation:p.played==='1'?'played':'dnp',minutes:min,values:Object.fromEntries(Object.entries(fields).map(([market,k])=>[market,stats[k]]))});
  }
  for(const p of t.inactives){const id=String(p.personId),name=[p.firstName,p.familyName].filter(Boolean).join(' ');if(!/^\d+$/.test(id)||!name||seen.has(id))throw Error('Official NBA inactive invalid');seen.add(id);players.push({name,participation:'dnp'});}
  for(const [market,key]of Object.entries(fields)){const total=t.statistics?.[market==='player_rebounds'?'reboundsPersonal':key];if(!Number.isInteger(total)||players.filter(p=>p.participation==='played').reduce((n,p)=>n+p.values[market],0)!==total)throw Error('Official NBA totals do not reconcile');}
  if(t.statistics.points!==t.score)throw Error('Official NBA points mismatch');
  const totalMinutes=duration(t.statistics.minutes);if(totalMinutes===null||Math.abs(players.filter(p=>p.participation==='played').reduce((n,p)=>n+p.minutes,0)-totalMinutes)>players.filter(p=>p.participation==='played').length/60)throw Error('Official NBA minutes do not reconcile');
  teams.push({id:expected.id,players});
 }
 return {available:true,gameId:e.id,tipoff:e.tipoff,season:e.season,stage:e.stage,teams};
}
function reconcile(players,games,reports,teamId){let verified=0,filled=0,conflicts=0;
 const people=[...players.values()];
 for(const g of games){const report=reports.get(String(g.id));if(!report?.available||String(report.gameId)!==String(g.id)||Date.parse(report.tipoff)!==Date.parse(g.tipoff))continue;const teams=report.teams.filter(t=>String(t.id)===String(teamId));if(teams.length!==1)continue;
  for(const p of people){if(matchPlayer(people,p.name).player!==p)continue;const row=matchPlayer(teams[0].players,p.name).player;if(!row)continue;if(!['played','dnp'].includes(row.participation))continue;const active=(p.results||[]).filter(r=>String(r.gameId)===String(g.id)),inactive=(p.inactive||[]).filter(r=>String(r.gameId)===String(g.id)),unverified=(p.unverified||[]).filter(r=>String(r.gameId)===String(g.id));
   const conflict=unverified.length>1||unverified.length&&(active.length||inactive.length||row.participation==='dnp')||unverified.some(r=>Object.keys(fields).some(k=>Number.isFinite(r[k])&&r[k]!==row.values?.[k]))||active.length>1||inactive.length>1||active.length&&inactive.length||row.participation==='dnp'&&active.length||row.participation==='played'&&inactive.length||active.some(r=>Object.keys(fields).some(k=>Number.isFinite(r[k])&&r[k]!==row.values[k])||Number.isFinite(r.minutes)&&Math.abs(r.minutes-row.minutes)>=1);
   if(conflict){p.available=false;conflicts++;continue;}
   if(row.participation==='played'){if(unverified.length)p.unverified=p.unverified.filter(r=>String(r.gameId)!==String(g.id));if(active.length)Object.assign(active[0],{minutes:row.minutes,...row.values,source:report.source});else{p.results.push({gameId:g.id,tipoff:g.tipoff,minutes:row.minutes,...row.values,source:report.source});filled++;}}
   else if(!inactive.length){p.inactive=p.inactive||[];p.inactive.push({gameId:g.id,tipoff:g.tipoff,source:report.source});filled++;}verified++;
  }
 }
 return {verified,filled,conflicts};
}
function createOfficialNBA({fetcher=fetch,now=Date.now}={}){const cache=new Map();
 async function read(url){const old=cache.get(url);if(old&&now()-old.at<6*3600000)return old.pending;const item={at:now(),pending:(async()=>{const r=await fetcher(url,{signal:AbortSignal.timeout(12000),redirect:'error'});if(!r.ok||Number(r.headers?.get?.('content-length')||0)>5000000)throw Error('Official NBA page unavailable');const text=await r.text();if(text.length>5000000)throw Error('Official NBA page too large');return pageData(text);})()};cache.set(url,item);item.pending.catch(()=>{if(cache.get(url)===item)cache.delete(url)});if(cache.size>200)cache.delete(cache.keys().next().value);return item.pending;}
 return async data=>{try{const e=expectation(data);if(Date.parse(e.tipoff)>=now())throw Error('Game not historical');const date=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(e.tipoff)),found=findCard(await read('https://www.nba.com/games?date='+date),e);return {...parseGame((await read(found.url)).game,found.card,e),source:found.url};}catch{return {available:false};}};
}
module.exports={nameKey,pageData,duration,expectation,findCard,parseGame,reconcile,createOfficialNBA};
