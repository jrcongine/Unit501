'use strict';
const MAX_AGE=30*60000,ARRIVAL_WINDOW=60000;
const finite=Number.isFinite;
function identity(g){
 const football=['1','2'].includes(g.league);
 if(!football&&!['nba','ncaab'].includes(g.league)||!g.away||!g.home||g.away===g.home||!finite(g.kickoff))return null;
 if(!football&&(!g.id||!g.provider))return null;
 return JSON.stringify([g.league,g.away,g.home,g.kickoff,football?'':g.provider,football?'':String(g.id)]);
}
function marketLean(market,away,home,line){
 const difference=market==='spread'?away-home+line:away+home-line;
 if(Math.abs(difference)<1e-8)return null;
 return market==='spread'?(difference>0?'away':'home'):(difference>0?'over':'under');
}
function createMarketRecorder({now=Date.now}={}){
 const games=new Map();
 function entry(g){
  const id=identity(g),time=now();
  if(!id||time>=g.kickoff)return null;
  for(const [key,s] of games)if(s.until<=time)games.delete(key);
  if(!games.has(id)){
   if(games.size>=500)games.delete(games.keys().next().value);
   games.set(id,{quotes:{},until:time+MAX_AGE});
  }
  return games.get(id);
 }
 function join(state){
  const pending=state.pending;if(!pending)return;
  const {forecast,save}=pending,time=now();
  if(time>=forecast.game.kickoff||time-forecast.forecastAt>ARRIVAL_WINDOW){delete state.pending;return;}
  for(const market of ['spread','total']){
   const q=state.quotes[market];if(!q||q.conflict||pending.done.has(market))continue;
   if(q.at>forecast.forecastAt||forecast.forecastAt-q.at>=MAX_AGE)continue;
   save(market,{bookmaker:'FanDuel',line:q.line,sourceAt:q.at,observedAt:q.observedAt,forecastAt:forecast.forecastAt,
    lean:marketLean(market,forecast.away,forecast.home,q.line)});
   pending.done.add(market);
  }
  if(pending.done.size===2)delete state.pending;
 }
 function quote(g,result){
  const state=entry(g);if(!state||!result?.available)return;
  const fb=['1','2'].includes(g.league);
  for(const market of ['spread','total']){
   const value=fb?(market==='spread'?result.awaySpread:result.total):(market==='spread'?result.spread?.away:result.total?.line);
   const stamp=fb?result[market+'Updated']:result[market]?.updatedAt;
   const at=typeof stamp==='string'?Date.parse(stamp):stamp,time=now();
   if(!finite(value)||!Number.isInteger(value*2)||market==='total'&&value<=0||!finite(at)||at>time||time-at>=MAX_AGE)continue;
   const old=state.quotes[market];
   if(old&&at<=old.at){if(at===old.at&&value!==old.line)old.conflict=true;continue;}
   state.quotes[market]={line:value,at,observedAt:time};
  }
  state.until=now()+MAX_AGE;join(state);
 }
 function forecast(f,save){
  const state=entry(f.game);if(!state)return;
  state.pending={forecast:f,save,done:new Set()};join(state);
 }
 return {quote,forecast};
}
function grade(market,record,final){
 if(!record.lean)return 'noLean';
 const winner=marketLean(market,final.away,final.home,record.line);
 return !winner?'pushes':winner===record.lean?'wins':'losses';
}
module.exports={createMarketRecorder,grade};
