'use strict';
const fs=require('node:fs'),path=require('node:path');
const stats=require('./public/player-stats'),form=require('./public/player-form');
const {reconcileGames,readScore}=require('./football-schedule-integrity');
const {centralDate}=require('./nba-feed'),{publish}=require('./forecast-store');
const {positiveId}=require('./provider-id');
const DAY=86400000,markets=new Set(stats.definitions.map(d=>d.key));
const valid=data=>Array.isArray(data?.response)&&!(data.errors&&Object.keys(data.errors).length)&&!(data.paging?.total>1);
function createFootballProps({directory,revision='local',now=Date.now}={}){
 const cache=new Map();let cursor='',busy=false;
 function put(key,data){
  if(!directory||!data)return;cache.delete(key);cache.set(key,{at:now(),data});
  if(cache.size>1800)cache.delete(cache.keys().next().value);
 }
 function get(key){const entry=cache.get(key);return entry&&now()-entry.at<1800000?entry.data:null;}
 function slate(data){
  if(!directory||!valid(data))return;
  for(const g of reconcileGames(data.response)){
   const away=g.teams?.away||g.teams?.visitors,home=g.teams?.home,kickoff=g.game?.date?.timestamp*1000;
   const league=String(g.league?.id),season=String(g.league?.season),id=String(g.game?.id);
   if(!['1','2'].includes(league)||!positiveId(id)||!positiveId(away?.id)||!positiveId(home?.id)||String(away.id)===String(home.id)||!/^20\d\d$/.test(season)||!Number.isFinite(kickoff))continue;
   const key=JSON.stringify([league,away.name,home.name,kickoff]);
   const prev=get(key);
   put(key,g.game.status?.short==='NS'&&kickoff>now()&&(!prev||prev.id===id)?{league,season,id,kickoff,away,home}:{blocked:true});
  }
 }
 function capture(q,quotes){
  if(!directory||!quotes?.props?.length)return;
  const game=get(JSON.stringify([q.league,q.away,q.home,q.kickoff]));
  if(!game||game.blocked||game.kickoff<=now()||game.kickoff>now()+7*DAY)return;
  const records=new Map(),calendar=new Map();
  for(const team of [game.away,game.home]){
   const schedule=get('team/'+game.league+'/'+game.season+'/'+team.id);
   if(!valid(schedule))return;
   for(const g of reconcileGames(schedule.response)){
    const date=Number(g.game?.date?.timestamp),id=String(g.game?.id),away=g.teams?.away||g.teams?.visitors,home=g.teams?.home;
    if(String(g.league?.id)!==game.league||String(g.league?.season)!==game.season||!Number.isFinite(date)||date*1000>=now()||
       !['FT','AOT','FINAL'].includes(g.game.status?.short)||/pre[ -]*season|exhibition/i.test(g.game.stage)||game.league==='1'&&!/^regular season$/i.test(g.game.stage))continue;
    const side=String(away?.id)===String(team.id)?'away':String(home?.id)===String(team.id)?'home':null;
    if(!side)continue;
    const other=side==='away'?home:away,otherSide=side==='away'?'home':'away';
    const boxes=get('box/'+id);if(!valid(boxes))return;
    const matching=boxes.response.filter(b=>String(b.team?.id)===String(team.id));
    if(matching.length!==1||!positiveId(other?.id)||!Array.isArray(matching[0].groups))return;
    const past=calendar.get(id)||{date,teams:new Map()};if(past.date!==date)return;
    past.teams.set(String(team.id),{id:String(other.id),name:other.name,scored:readScore(g.scores?.[side]?.total),allowed:readScore(g.scores?.[otherSide]?.total)});
    calendar.set(id,past);stats.accumulate(records,matching[0],id,date,other.name);
   }
  }
  stats.completeCalendar(records,calendar);stats.applyReviewedHistory(records,calendar,game);
  for(const id of calendar.keys())stats.applyParticipation(records,calendar,get('participation/'+id),game);
  const candidates=[...records.values()];
  for(const quote of quotes.props){
   const time=now();
   if(time>=game.kickoff||!markets.has(quote.stat)||!Number.isFinite(quote.updatedAt)||quote.updatedAt>time||time-quote.updatedAt>=1800000||
      !Number.isFinite(quote.line)||!Number.isInteger(quote.line*2))continue;
   const matches=stats.quotePlayers(quote,candidates,game);if(matches.length!==1)continue;
   const p=matches[0];if(!positiveId(p.playerId)||!positiveId(p.teamId))continue;
   const estimate=form.project([...p.games.values()],quote.stat);
   if(!estimate||estimate.withheld||!Number.isFinite(estimate.baseline))continue;
   const file=path.join(directory,[game.league,game.id,p.teamId,p.playerId,quote.stat].join('-')+'.forecast');
   if(fs.existsSync(file))continue;
   fs.mkdirSync(directory,{recursive:true});
   publish(file,{league:game.league,game,revision,teamId:p.teamId,playerId:p.playerId,player:p.name,market:quote.stat,
    projection:Number(estimate.baseline.toFixed(1)),line:quote.line,forecastAt:time,sourceAt:quote.updatedAt,over:quote.over,under:quote.under});
  }
 }
 function files(){return directory&&fs.existsSync(directory)?fs.readdirSync(directory).filter(n=>/^[12]-\d+-\d+-\d+-[a-zA-Z]+\.forecast$/.test(n)):[];}
 async function refresh(load){
  if(!directory||busy)return;busy=true;
  try{
   const due=new Map();for(const n of files()){
    const file=path.join(directory,n);if(fs.existsSync(file+'.result'))continue;
    const f=JSON.parse(fs.readFileSync(file)),age=now()-f.game.kickoff;
    if(age<4*3600000||age>21*DAY)continue;
    const id=f.league+'/'+f.game.id;if(!due.has(id))due.set(id,[]);due.get(id).push({file,f});
   }
   const keys=[...due.keys()].sort();if(!keys.length)return;
   cursor=keys.find(k=>k>cursor)||keys[0];const rows=due.get(cursor),g=rows[0].f.game;
   const report=await load({league:g.league,game:g.id,season:g.season,date:centralDate(g.kickoff),fullNamesOnly:true});
   if(!report?.available||report.nameFormat!=='full'||String(report.gameId)!==g.id||report.gameDate*1000!==g.kickoff||String(report.season)!==g.season||String(report.league)!==g.league||
      ![g.away,g.home].every(team=>report.teams?.filter(t=>String(t.id)===String(team.id)&&t.name===team.name).length===1))return;
   for(const {file,f} of rows){
    const team=report.teams.find(t=>String(t.id)===f.teamId);
    const players=team?.players?.filter(p=>p.name?.trim().toLowerCase()===f.player.trim().toLowerCase());if(players?.length!==1)continue;
    const p=players[0];let result;
    if(p.participation==='dnp')result={outcome:'dnp'};
    else if(p.participation==='played'&&p.markets?.includes(f.market)&&Number.isSafeInteger(p[f.market])){
     const value=p[f.market];result={actual:value,outcome:f.projection===f.line?'noLean':value===f.line?'push':(value>f.line)===(f.projection>f.line)?'win':'loss'};
    }
    if(result)publish(file+'.result',{...result,checkedAt:now()});
   }
  }finally{busy=false;}
 }
 return {put,slate,capture,refresh,summary:()=>require('./prop-grade-summary').summary(directory,files(),now(),f=>f.game.kickoff)};
}
module.exports={createFootballProps};
