'use strict';
// Offline research replay: verified ESPN box scores, observed participants only.
const {normalizeGame}=require('./nba-feed');
const {extractBox,extractInactive,reconcileCoverage,METRICS}=require('./nba-player-history');
const {project}=require('./public/nba-player-model');
const ROOT='https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=';

async function replay(raw,season,options={}){
 if(!Array.isArray(raw)||!Number.isInteger(season))throw Error('NBA games and season are required');
 const limit=options.limit??12, fetcher=options.fetcher??fetch;
 if(!Number.isInteger(limit)||limit<1||limit>24)throw Error('Game limit must be 1–24');
 const games=raw.map(normalizeGame).filter(g=>g&&g.statusCode===3&&g.stage===2&&g.awayId&&g.homeId&&g.awayScore!==null&&g.homeScore!==null)
  .sort((a,b)=>Date.parse(a.tipoff)-Date.parse(b.tipoff)||a.id-b.id);
 if(new Set(games.map(g=>g.id)).size!==games.length)throw Error('Duplicate game identities');
 // Use one late-season contiguous slice to limit public requests; do not cherry-pick outcomes.
 const end=Math.floor(games.length*.85),targets=games.slice(Math.max(0,end-limit),end);
 const cache=new Map(),officialReports=new Map();
 async function box(game){
  if(cache.has(game.id))return cache.get(game.id);
  const pending=(async()=>{
   const r=await fetcher(ROOT+game.id,{signal:AbortSignal.timeout(15000),redirect:'error'});
   if(!r.ok||Number(r.headers?.get?.('content-length')||0)>5000000)throw Error('Box score unavailable');
   const data=await r.json();try{if(options.official)officialReports.set(String(game.id),await options.official(data));}catch{}return data;
  })();cache.set(game.id,pending);return pending;
 }
 const priorFor=(game,id)=>games.filter(g=>g.id!==game.id&&(g.awayId===id||g.homeId===id)&&Date.parse(g.tipoff)+5*3600000<Date.parse(game.tipoff)).slice(-10).reverse();
 const perspective=(g,id)=>{const away=g.awayId===id;return {id:g.id,tipoff:g.tipoff,opponentId:away?g.homeId:g.awayId,venue:away?'away':'home',for:away?g.awayScore:g.homeScore,against:away?g.homeScore:g.awayScore};};
 const totals=Object.fromEntries(Object.keys(METRICS).map(m=>[m,{count:0,error:0,averageError:0,bias:0}]));
 let teamGames=0,skipped=0;
 for(const target of targets)for(const id of [target.awayId,target.homeId]){
  try{
   const prior=priorFor(target,id);if(prior.length<5)throw Error('Insufficient earlier games');
   const players=new Map();
   for(const g of prior){
    const data=await box(g),rows=extractBox(data,perspective(g,id),id,season,2);
    for(const p of rows){const item=players.get(p.id)||{id:p.id,name:p.name,available:true,results:[],inactive:[]};
     if(item.name!==p.name||p.available===false)item.available=false;
     item.results.push({gameId:g.id,tipoff:g.tipoff,minutes:p.minutes,...p.values});players.set(p.id,item);}
    for(const p of extractInactive(data,id,rows)){
     const item=players.get(p.id)||{id:p.id,name:p.name,available:true,results:[],inactive:[]};
     if(item.name!==p.name)item.available=false;
     item.inactive.push({gameId:g.id,tipoff:g.tipoff});players.set(p.id,item);
    }
   }
   require('./nba-official-history').reconcile(players,prior,officialReports,id);
   reconcileCoverage(players,prior);
   let actual=extractBox(await box(target),perspective(target,id),id,season,2);
   if(options.official){
    const observed=new Map([...players.values()].map(p=>[p.id,{id:p.id,name:p.name,available:true,results:[],inactive:[]}]));
    for(const p of actual)observed.set(p.id,{id:p.id,name:p.name,available:p.available!==false,results:[{gameId:target.id,tipoff:target.tipoff,minutes:p.minutes,...p.values}],inactive:[]});
    require('./nba-official-history').reconcile(observed,[target],officialReports,id);
    actual=[...observed.values()].filter(p=>p.available&&p.results.length===1).map(p=>({id:p.id,name:p.name,values:p.results[0]}));
   }
   const now=Date.parse(target.tipoff)-1;
   const history={gameId:target.id,tipoff:target.tipoff,checkedAt:now,teams:[{available:true,players:[...players.values()]},{available:true,players:[]}]};
   for(const p of actual){if(p.available===false)continue;
    const previous=players.get(p.id);if(!previous||previous.name!==p.name)continue;
    for(const metric of Object.keys(METRICS)){
     if(!Number.isInteger(p.values[metric]))continue;
     const estimate=project(history,{name:p.name,market:metric,line:0},{id:target.id,tipoff:target.tipoff},null,now);
     if(!estimate.available)continue;
     const row=totals[metric],observed=p.values[metric];row.count++;row.error+=Math.abs(estimate.projection-observed);row.averageError+=Math.abs(estimate.average-observed);row.bias+=estimate.projection-observed;
    }
   }
   teamGames++;
  }catch{skipped++;}
 }
 const metrics=Object.fromEntries(Object.entries(totals).map(([key,v])=>[key,{samples:v.count,mae:v.count?v.error/v.count:null,recentAverageMAE:v.count?v.averageError/v.count:null,bias:v.count?v.bias/v.count:null}]));
 return {season,selectedGames:targets.length,teamGames,skipped,boxRequests:cache.size,officialGames:[...officialReports.values()].filter(r=>r?.available).length,metrics,
  note:'Observed participants with prior appearances only. No historical lines, injury reports, projected absences, betting outcomes or calibrated probabilities.'};
}
if(require.main===module)(async()=>{const fs=require('node:fs');if(!process.argv[2])throw Error('Usage: node nba-player-backtest.js games.json [game-limit]');
 const input=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));console.log(JSON.stringify(await replay(input.response,input.season,{limit:Number(process.argv[3]||12),official:require('./nba-official-history').createOfficialNBA()}),null,2));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={replay};
