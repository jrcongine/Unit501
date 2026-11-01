'use strict';
// Opt-in, once per audit ID on the persistent volume. No credentials or raw
// provider responses leave the service. At most two event-odds requests (7
// market credits each), only after the free events endpoint confirms capacity.
const fs=require('node:fs/promises'),path=require('node:path');
const {centralDate}=require('./nba-feed');
async function run({env=process.env,fetcher=fetch,now=Date.now,files=fs,sources}={}){
 const token=env.UNIT501_BASKETBALL_ODDS_AUDIT;
 if(!/^[a-z0-9-]{1,64}$/.test(token||'')||!env.UNIT501_LINE_HISTORY_FILE||!env.ODDS_API_KEY)return {status:'disabled'};
 const marker=path.join(path.dirname(env.UNIT501_LINE_HISTORY_FILE),'basketball-audit-'+token+'.json');
 try{const handle=await files.open(marker,'wx');await handle.close();}catch(e){return {status:e.code==='EEXIST'?'already-run':'storage-unavailable'};}
 const result={status:'checked',checkedAt:new Date(now()).toISOString(),leagues:[]};
 const key=env.ODDS_API_KEY.trim();
 for(const league of ['nba','ncaab']){
  const row={league};result.leagues.push(row);
  try{
   const sport='basketball_'+league;
   const response=await fetcher('https://api.the-odds-api.com/v4/sports/'+sport+'/events?'+new URLSearchParams({apiKey:key}),{signal:AbortSignal.timeout(15000)});
   row.eventsStatus=response.status;
   const raw=response.headers?.get('x-requests-remaining');row.remaining=typeof raw==='string'&&/^\d+$/.test(raw)?Number(raw):null;
   if(!response.ok){row.status='provider-error';continue;}
   const events=await response.json();if(!Array.isArray(events)){row.status='invalid-events';continue;}
   row.providerEvents=events.length;
   if(row.remaining===null||row.remaining<14){row.status='capacity-unverified-or-low';continue;}
   const source=sources?.[league]||(league==='nba'?require('./nba-public').createPublicNBA({fetcher,now}):require('./ncaab-feed').createNCAAB({fetcher,now}));
   const today=centralDate(new Date(now()).toISOString());
   let slate=await source.games(today),date=today;
   let games=slate.games.filter(g=>g.status==='Scheduled'&&Date.parse(g.tipoff)>now()&&(league==='nba'||g.timeKnown));
   if(!games.length){date=centralDate(new Date(now()+86400000).toISOString());slate=await source.games(date);games=slate.games.filter(g=>g.status==='Scheduled'&&Date.parse(g.tipoff)>now()&&(league==='nba'||g.timeKnown));}
   row.date=date;row.scheduledGames=games.length;
   const matching=require(league==='nba'?'./nba-odds':'./ncaab-markets').matches;
   const pairs=games.map(game=>({game,found:events.filter(e=>matching(e,game))}));
   row.matchedGames=pairs.filter(p=>p.found.length===1).length;
   // Names/times are public sporting information, never provider URLs or keys.
   row.unmatched=pairs.filter(p=>p.found.length!==1).slice(0,3).map(p=>({away:p.game.away,home:p.game.home,tipoff:p.game.tipoff,matches:p.found.length}));
   const pair=pairs.find(p=>p.found.length===1);
   if(!pair){row.status='no-matched-game';row.providerSample=events.slice(0,3).map(e=>({away:e.away_team,home:e.home_team,tipoff:e.commence_time}));continue;}
   const {game,found}=pair;row.game={away:game.away,home:game.home,tipoff:game.tipoff};
   const r=await fetcher('https://api.the-odds-api.com/v4/sports/'+sport+'/events/'+encodeURIComponent(found[0].id)+'/odds?'+new URLSearchParams({apiKey:key,bookmakers:'fanduel',markets:'h2h,spreads,totals,player_points,player_rebounds,player_assists,player_threes',oddsFormat:'american'}),{signal:AbortSignal.timeout(15000)});
   require('./odds-monitor').observe(r);row.oddsStatus=r.status;
   if(!r.ok){row.status='odds-request-failed';continue;}
   const data=await r.json();if(data.id!==found[0].id||!matching(data,game)){row.status='identity-mismatch';continue;}
   const propData={...data,bookmakers:(data.bookmakers||[]).map(b=>({...b,markets:(b.markets||[]).filter(m=>m?.key?.startsWith('player_'))}))};
   const {props,audit}=require('./nba-odds').auditPlayerLines(propData,now());
   const lines=require('./game-quotes').gameQuotes(data,now());
   row.status='verified-response';row.gameLines={moneyline:!!lines.moneyline,spread:!!lines.spread,total:!!lines.total};
   row.bookmakers=(data.bookmakers||[]).map(b=>b.key);row.returnedMarkets=[...new Set((data.bookmakers||[]).flatMap(b=>(b.markets||[]).map(m=>m.key)))];
   row.props={received:audit.quotesReceived,accepted:props.length,rejected:audit.rejected,reasons:audit.reasons,missingMarkets:audit.missingMarkets};
   row.sample=props.slice(0,3).map(p=>({name:p.name,market:p.market,line:p.line,over:p.over,under:p.under}));
  }catch{row.status='source-unavailable';}
 }
 try{await files.writeFile(marker,JSON.stringify(result));}catch{}
 return result;
}
module.exports={run};
