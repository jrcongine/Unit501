'use strict';
const fs=require('node:fs'),path=require('node:path');
const {publish}=require('./forecast-store');
const model=require('./public/nba-player-model');
const {extractBox,extractInactive}=require('./nba-player-history');
const college=require('./ncaab-players');
const {positiveId}=require('./provider-id');
const DAY=86400000,AGE=1800000;
const markets=new Set(['player_points','player_rebounds','player_assists','player_threes']);
const name=s=>String(s||'').trim().toLowerCase().replace(/\s+/g,' ');
function settle(f,data){
 const game=f.game,c=college.verify(data,game);
 if(c.status?.type?.completed!==true||c.status.type.state!=='post'||!/^STATUS_FINAL(?:_OT)?$/.test(c.status.type.name||''))return null;
 const scores=['away','home'].map(side=>{
  const value=c.competitors.find(t=>t.homeAway===side)?.score;
  return /^\d+$/.test(String(value))?Number(value):null;
 });
 if(scores.some(s=>s===null)||scores[0]===scores[1])return null;
 const away=f.teamId===game.awayId;
 if(!away&&f.teamId!==game.homeId)return null;
 const active=f.league==='nba'?extractBox(data,{id:game.id,tipoff:game.tipoff,opponentId:away?game.homeId:game.awayId,
  venue:away?'away':'home',for:scores[away?0:1],against:scores[away?1:0]},f.teamId,game.season-1,game.stage):college.extract(data,game,f.teamId);
 const valid=p=>p.id===f.playerId&&name(p.name)===name(f.player);
 const player=active.find(valid);
 if(!player)return extractInactive(data,f.teamId,active).some(valid)?{outcome:'dnp'}:null;
 const actual=(player.values||player)[f.market];
 if(!(player.minutes>0)||player.available===false||!Number.isInteger(actual)||actual<0)return null;
 const outcome=f.projection===f.line?'noLean':actual===f.line?'push':(actual>f.line)===(f.projection>f.line)?'win':'loss';
 return {outcome,actual};
}
function createPropGrades({directory,revision='local',now=Date.now,fetcher=fetch}={}){
 const recent=new Map();let cursor='',busy=false;
 function observe(league,game,season,kind,value){
  if(!directory||!['nba','ncaab'].includes(league)||game.status!=='Scheduled'||game.stage!==2||!positiveId(game.id)||
    !(Date.parse(game.tipoff)>now())||Date.parse(game.tipoff)>now()+7*DAY||String(value?.gameId)!==String(game.id)||game.tipoff!==value.tipoff)return;
  const id=JSON.stringify([league,game.provider,game.id,game.tipoff,game.awayId,game.homeId,season]);
  for(const [k,v] of recent)if(now()-v.at>AGE)recent.delete(k);
  const item=recent.get(id)||{};item[kind]=value;item.at=now();recent.set(id,item);
  if(recent.size>80)recent.delete(recent.keys().next().value);
  const {history,quotes}=item;
  if(!history||!Array.isArray(history.teams)||history.teams.length!==2||history.teams.some(t=>!t.available||!positiveId(t.id)||!Array.isArray(t.players))||
     quotes?.bookmaker!=='FanDuel'||!Array.isArray(quotes.props))return;
  const checked=now(),nba=league==='nba';
  const target=nba?history.publicGame:{id:game.id,awayId:game.awayId,homeId:game.homeId,tipoff:game.tipoff,stage:game.stage,season};
  if(!target||![target.id,target.awayId,target.homeId].every(positiveId)||String(target.awayId)===String(target.homeId)||
     !Number.isFinite(Date.parse(target.tipoff))||Math.abs(Date.parse(target.tipoff)-Date.parse(game.tipoff))>900000||Date.parse(target.tipoff)<=checked||
     target.stage!==2||target.season!==(nba?season+1:season))return;
  if(history.teams.some((t,i)=>String(t.id)!==String(i===0?target.awayId:target.homeId)))return;
  const all=history.teams.flatMap(team=>team.players.map(p=>({...p,teamId:String(team.id)})));
  for(const q of quotes.props){
   if(!markets.has(q.market)||!Number.isFinite(q.line)||q.line<0||!Number.isInteger(q.line*2)||
      !Number.isFinite(q.updatedAt)||q.updatedAt>checked||checked-q.updatedAt>=AGE)continue;
   const player=model.matchPlayer(all,q.name).player;if(!player||!positiveId(player.id))continue;
   const file=path.join(directory,[league,target.id,player.teamId,player.id,q.market].join('-')+'.forecast');
   if(fs.existsSync(file))continue;
   const estimate=model.project(history,q,game,null,checked,{regulationMinutes:nba?48:40});
   if(!estimate.available||!Number.isFinite(estimate.baseline))continue;
   const forecastAt=now();if(forecastAt>=Math.min(Date.parse(game.tipoff),Date.parse(target.tipoff)))return;
   fs.mkdirSync(directory,{recursive:true});
   publish(file,{league,revision,game:{...target,id:String(target.id),awayId:String(target.awayId),homeId:String(target.homeId)},
    teamId:player.teamId,playerId:String(player.id),player:player.name,market:q.market,forecastAt,sourceAt:q.updatedAt,line:q.line,
    projection:Number(estimate.baseline.toFixed(1)),over:q.over,under:q.under});
  }
 }
 function files(){return directory&&fs.existsSync(directory)?fs.readdirSync(directory).filter(n=>/^(nba|ncaab)-\d+-\d+-\d+-player_(points|rebounds|assists|threes)\.forecast$/.test(n)):[];}
 function summary(){return require('./prop-grade-summary').summary(directory,files(),now(),f=>Date.parse(f.game.tipoff));}
 async function refresh(){
  if(busy||!directory)return;busy=true;
  try{
   const due=new Map();
   for(const n of files()){
    const file=path.join(directory,n);if(fs.existsSync(file+'.result'))continue;
    const f=JSON.parse(fs.readFileSync(file,'utf8')),age=now()-Date.parse(f.game.tipoff);if(age<3*3600000||age>21*DAY)continue;
    const key=f.league+'/'+f.game.id;if(!due.has(key))due.set(key,[]);due.get(key).push({file,f});
   }
   const keys=[...due.keys()].sort();if(!keys.length)return;cursor=keys.find(k=>k>cursor)||keys[0];
   const rows=due.get(cursor),first=rows[0].f,sport=first.league==='nba'?'nba':'mens-college-basketball';
   const r=await fetcher('https://site.api.espn.com/apis/site/v2/sports/basketball/'+sport+'/summary?event='+first.game.id,{signal:AbortSignal.timeout(12000),redirect:'error'});
   if(!r.ok)return;const data=await r.json();
   for(const {file,f} of rows){let result;try{result=settle(f,data);}catch{continue;}if(result)publish(file+'.result',{...result,checkedAt:now()});}
  }finally{busy=false;}
 }
 return {observe,refresh,summary};
}
module.exports={createPropGrades,settle};
