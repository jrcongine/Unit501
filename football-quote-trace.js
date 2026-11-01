'use strict';
// Keep only the latest authenticated client observation per matchup, in arrival order.
function createTraceStore(){
  const games=new Map();
  function capture(trace){
    if(!trace || !['1','2'].includes(trace.league) || !/^20\d{2}$/.test(trace.season) ||
       !/^\d{1,12}$/.test(trace.game) || !Array.isArray(trace.entries) || trace.entries.length>2000 ||
       !Number.isInteger(trace.accepted) || !Number.isInteger(trace.displayed) || trace.displayed<0)return null;
    const entries=[];
    for(const row of trace.entries){
      if(!row || !Number.isFinite(row.line) || ![row.name,row.stat,row.reason].every(v=>typeof v==='string' && v.trim() && v.length<=600))return null;
      entries.push({name:row.name,stat:row.stat,line:row.line,reason:row.reason});
    }
    const displayed=entries.filter(row=>row.reason==='Displayed').length;
    const balanced=trace.accepted===entries.length && trace.displayed===displayed;
    const {league,season,game,accepted}=trace;
    const snapshot={league,season,game,accepted,displayed:trace.displayed,balanced,capturedAt:Date.now(),entries};
    const key=[league,season,game].join(':');
    games.delete(key);games.set(key,snapshot);
    if(games.size>16)games.delete(games.keys().next().value);
    if(!balanced)console.warn('Football quote trace count mismatch',key,accepted,entries.length,trace.displayed,displayed);
    return {balanced};
  }
  return {capture,latest:()=>[...games.values()].reverse()};
}
module.exports={createTraceStore};
