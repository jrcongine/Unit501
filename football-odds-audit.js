'use strict';
const fs=require('node:fs/promises');
const path=require('node:path');
const {sports,selectLines}=require('./fanduel');
const {markets}=require('./fanduel-props');
const {matches}=require('./odds-matching');
const {auditProps}=require('./prop-quotes');
const {centralDate}=require('./nba-feed');
const {footballSeason}=require('./public/unit501-shared-ui');
const requested=['h2h','spreads','totals',...Object.keys(markets)];

// One opt-in observation per league and audit ID, on the existing volume.
// Use the metered schedule client and inspect remaining odds capacity before requesting quotes.
async function run({api,env=process.env,fetcher=fetch,files=fs,now=Date.now}={}){
 const token=env.UNIT501_FOOTBALL_ODDS_AUDIT;
 if(!/^[a-z0-9-]{1,64}$/.test(token||'')||!env.ODDS_API_KEY||!env.API_SPORTS_KEY||!env.UNIT501_LINE_HISTORY_FILE)return {status:'disabled'};
 const marker=path.join(path.dirname(env.UNIT501_LINE_HISTORY_FILE),'football-odds-audit-'+token+'.json');
 try{const file=await files.open(marker,'wx');await file.close();}
 catch(error){return {status:error.code==='EEXIST'?'already-run':'storage-unavailable'};}
 const report={checkedAt:new Date(now()).toISOString(),leagues:[]};
 for(const [league,sport] of Object.entries(sports)){
  const row={league:sport};report.leagues.push(row);
  try{
   const base='https://api.the-odds-api.com/v4/sports/'+sport+'/events';
   const params=new URLSearchParams({apiKey:env.ODDS_API_KEY});
   const listing=await fetcher(base+'?'+params,{signal:AbortSignal.timeout(12000)});
   const remaining=listing.headers.get('x-requests-remaining');
   if(!listing.ok||!/^\d+$/.test(remaining||'')||Number(remaining)<2*requested.length){row.status='events-or-capacity-unavailable';continue;}
   const events=(await listing.json()).filter(e=>e?.sport_key===sport&&typeof e.id==='string'&&e.id&&Date.parse(e.commence_time)>now()).sort((a,b)=>Date.parse(a.commence_time)-Date.parse(b.commence_time));
   if(!events.length){row.status='no-upcoming-events';continue;}
   const date=centralDate(events[0].commence_time),season=footballSeason(date);
   const slate=await api('/games?'+new URLSearchParams({league,date,season,timezone:'America/Chicago'}));
   if(!Array.isArray(slate.response)||slate.cache?.stale||Object.keys(slate.errors||{}).length){row.status='schedule-unavailable';continue;}
   const pairs=slate.response.filter(g=>String(g.league?.id)===league&&String(g.league?.season)===season&&g.game?.status?.short==='NS').map(g=>{
    const q={away:(g.teams?.away||g.teams?.visitors)?.name,home:g.teams?.home?.name,kickoff:Number(g.game.date?.timestamp)*1000,league};
    return {q,found:events.filter(e=>matches(e,q))};
   }).filter(p=>p.q.kickoff>now()&&p.found.length===1);
   const pair=pairs.find(p=>pairs.filter(other=>other.found[0].id===p.found[0].id).length===1);
   if(!pair){row.status='no-unique-schedule-match';continue;}
   const {q,found:[event]}=pair;
   params.set('bookmakers','fanduel');params.set('markets',requested.join(','));params.set('oddsFormat','american');
   const response=await fetcher(base+'/'+encodeURIComponent(event.id)+'/odds?'+params,{signal:AbortSignal.timeout(12000)});
   require('./odds-monitor').observe(response);
   if(!response.ok){row.status='odds-unavailable';continue;}
   const body=await response.json();
   if(body?.id!==event.id||body.sport_key!==sport||!matches(body,q)){row.status='identity-mismatch';continue;}
   const lines=selectLines([body],q,now());
   const props={...body,bookmakers:(body.bookmakers||[]).map(b=>({...b,markets:(b.markets||[]).filter(m=>m?.key?.startsWith('player_'))}))};
   const {audit}=auditProps(props,markets,now());
   Object.assign(row,{status:'verified-response',away:q.away,home:q.home,kickoff:q.kickoff,moneyline:!!lines.moneyline,spread:lines.awaySpread!=null,total:lines.total!=null,received:audit.quotesReceived,accepted:audit.accepted,rejected:audit.rejected,reasons:audit.reasons,missingMarkets:audit.missingMarkets});
  }catch{row.status='source-unavailable';}
 }
 await files.writeFile(marker,JSON.stringify(report)).catch(()=>{});
 return report;
}
module.exports={run};
