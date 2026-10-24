(function(root){
 'use strict';
 function candidate(game){
  if(game?.statusCode!==2||![1,2].includes(game.period)||game.halftime===true||
    !Number.isFinite(game.homeScore)||!Number.isFinite(game.awayScore))return null;
  const deficit=Math.abs(game.homeScore-game.awayScore);
  if(deficit<20)return null;
  return {id:String(game.id),team:game.homeScore<game.awayScore?game.home:game.away,
    deficit,period:game.period,score:game.away+' '+game.awayScore+' — '+game.home+' '+game.homeScore};
 }
 function createTracker(){
  const seen=new Set();
  return games=>games.map(candidate).filter(alert=>{
   if(!alert)return false;
   const key=alert.id+':'+alert.team;
   if(seen.has(key))return false;
   seen.add(key);return true;
  });
 }
 const api={candidate,createTracker};
 if(root)root.Unit501NBAAlerts=api;
 if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?null:window);
