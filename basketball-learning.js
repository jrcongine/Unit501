'use strict';
const fs=require('node:fs'),path=require('node:path');
const {positiveId}=require('./provider-id');
const {centralDate,validDate}=require('./nba-feed');
const nba=require('./public/nba-model'),college=require('./public/ncaab-model');
const calibration=require('./public/nba-win-calibration');
const {seededRandom}=require('./probability-audit');
const {publish,summarize,saveForecast}=require('./forecast-store');
const DAY=86400000;
const key=g=>[g.league,g.provider,g.season,g.id].join('-');
function identify(slate,g){
 const league=slate.league,provider=league==='ncaab'?'espn':slate.provider;
 if(!['nba','ncaab'].includes(league)||!['espn','api-nba'].includes(provider)||
    league==='nba'&&g.provider!==provider||!positiveId(g.id)||!positiveId(g.awayId)||!positiveId(g.homeId)||
    String(g.awayId)===String(g.homeId)||g.stage!==2||league==='ncaab'&&!g.timeKnown)return null;
 const season=league==='nba'?slate.season:g.season,kickoff=Date.parse(g.tipoff);
 if(!/^\d{4}$/.test(String(season))||!Number.isFinite(kickoff)||!validDate(slate.date)||centralDate(kickoff)!==slate.date)return null;
 return {id:String(g.id),league,provider,season,kickoff,date:slate.date,away:g.away,home:g.home,awayId:String(g.awayId),homeId:String(g.homeId)};
}
function createBasketballLearning({directory,marketRecorder=null,revision='local',now=Date.now}={}){
 let cursor='',busy=false;
 function records(){
  if(!directory||!fs.existsSync(directory))return [];
  return fs.readdirSync(directory).filter(n=>/^(nba|ncaab)-(espn|api-nba)-\d{4}-\d+\.forecast$/.test(n))
   .map(n=>JSON.parse(fs.readFileSync(path.join(directory,n),'utf8')));
 }
 function capture(slate,selected,data){
  if(!directory||selected.status!=='Scheduled')return;
  const g=identify(slate,selected),at=now();
  if(!require('./public/unit501-shared-ui').historyFreshness(data?.checkedAt,at).fresh)return;
  if(!g||g.kickoff<=at||g.kickoff>at+7*DAY)return;
  const file=path.join(directory,key(g)+'.forecast');
  if(fs.existsSync(file))return;
  const engine=g.league==='nba'?nba:college;
  const estimate=engine.project(selected,data,'season',at);
  if(!estimate.available)return;
  const sim=engine.simulate(estimate,data,{},10000,seededRandom(key(g)));
  const decided=sim.available?sim.awayWin+sim.homeWin:0;
  const calibrated=g.league==='nba'?calibration.apply(selected,{...estimate,injury:{applied:[]}},sim):null;
  const forecastAt=now();if(forecastAt>=g.kickoff)return;
  fs.mkdirSync(directory,{recursive:true});
  saveForecast(file,{game:g,forecastAt,revision,modelVersion:[estimate.version||'ncaab-season-baseline-v1',g.provider,calibrated?.version||'baseline'].join('/'),
    away:estimate.away,home:estimate.home,awayWinIfDecided:calibrated?.away??(decided>0?sim.awayWin/decided:null)},marketRecorder);
 }
 function observe(slate){
  if(!directory||!Array.isArray(slate?.games))return;
  for(const game of slate.games){
   if(game.status!=='Final'||![game.awayScore,game.homeScore].every(n=>Number.isInteger(n)&&n>=0)||game.awayScore===game.homeScore)continue;
   const g=identify(slate,game);
   if(!g||g.kickoff>=now()||slate.games.filter(row=>String(row.id)===g.id).length!==1)continue;
   const base=path.join(directory,key(g));
   if(!fs.existsSync(base+'.forecast')||fs.existsSync(base+'.final'))continue;
   const {game:saved,forecastAt}=JSON.parse(fs.readFileSync(base+'.forecast','utf8'));
   if(saved.kickoff!==g.kickoff||forecastAt>=g.kickoff||saved.awayId!==g.awayId||saved.homeId!==g.homeId)continue;
   publish(base+'.final',{away:game.awayScore,home:game.homeScore,observedAt:now()});
  }
 }
 async function refresh(load){
  if(!directory||busy)return;busy=true;
  try{
   const pending=new Map();
   for(const {game:g} of records()){
    const age=now()-g.kickoff;
    if(age>=3*3600000&&age<=21*DAY&&!fs.existsSync(path.join(directory,key(g)+'.final')))
     pending.set([g.date,g.league,g.provider].join('/'),g);
   }
   const groups=[...pending.keys()].sort();if(!groups.length)return;
   cursor=groups.find(id=>id>cursor)||groups[0];const g=pending.get(cursor);
   observe(await load(g));
  }finally{busy=false;}
 }
 return {capture,observe,refresh,summary:()=>summarize(directory,records(),key,'Season basketball baselines for opened regular-season matchups')};
}
module.exports={createBasketballLearning};
