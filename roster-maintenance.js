'use strict';
// Refresh existing guarded availability sources; never infer trades or rewrite reviewed identities.
function createRosterMaintenance(api, availability, now=Date.now) {
  let pending=null, timer=null;
  let state={running:false,lastStarted:null,lastCompleted:null,gamesChecked:0,issues:[],message:'Waiting for the first automatic roster check.'};
  const status=()=>({...state,issues:state.issues.map(x=>({...x}))});
  function run(){
    if(pending)return pending;
    state={...state,running:true,lastStarted:now(),message:'Checking upcoming NFL roster, injury and depth reports.'};
    pending=(async()=>{
      const issues=[];let gamesChecked=0;
      try{
        const date=new Date(now()),season=String(date.getUTCFullYear()-(date.getUTCMonth()<2?1:0));
        const result=await api('/games?league=1&season='+season);
        if(!Array.isArray(result.response)||Object.keys(result.errors||{}).length||result.paging?.total>1)throw Error('Schedule unavailable or incomplete.');
        const seen=new Set();
        const games=result.response.filter(g=>{
          const at=Number(g.game?.date?.timestamp)*1000,id=String(g.game?.id);
          if(String(g.league?.id)!=='1'||String(g.league?.season)!==season||!/^\d+$/.test(id)||seen.has(id)||!(at>now()&&at<=now()+7*86400000))return false;
          seen.add(id);return true;
        });
        for(const g of games){
          const game=String(g.game.id),label=g.teams?.away?.name+' at '+g.teams?.home?.name;
          const away=String(g.teams?.away?.id),home=String(g.teams?.home?.id);
          if(!/^\d+$/.test(away)||!/^\d+$/.test(home)){issues.push({game,label,reason:'Team identities unavailable.'});continue;}
          try{
            const report=await availability({league:'1',season,game,away,home});
            if(!report.current){issues.push({game,label,reason:'Current season coverage unverified.'});continue;}
            gamesChecked++;
            const ownership=report.rosterOwnership;
            if(!ownership?.complete)issues.push({game,label,reason:'League roster ownership check incomplete.'});
            for(const team of report.teams||[]){
              const teamName=team.id===home?g.teams.home.name:g.teams.away.name;
              for(const [field,title] of [['roster','Roster'],['official','Official injuries'],['depth','Depth chart']]){
                const source=team[field];
                if(!source?.available)issues.push({game,label:teamName,reason:title+' unavailable; status remains unknown.'});
                else if(Number(source.unmatched)>0)issues.push({game,label:teamName,reason:title+': '+source.unmatched+' unmatched entries.'});
              }
              const conflicts=(ownership?.conflicts||[]).filter(x=>x.teamIds.includes(team.id));
              if(conflicts.length)issues.push({game,label:teamName,reason:conflicts.length+' conflicting player ownership entries; review required.'});
              if(team.transactions?.unverified)issues.push({game,label:teamName,reason:team.transactions.unverified+' expired or unverified transaction reviews.'});
            }
          }catch{issues.push({game,label,reason:'Availability refresh failed; retry at the next sweep or open the matchup.'});}
        }
        state={...state,lastCompleted:now(),gamesChecked,issues,message:games.length?'Upcoming NFL reports checked. Unresolved items require review; no trades or workloads are guessed.':'No NFL games scheduled in the next seven days.'};
      }catch(error){state={...state,gamesChecked,issues,message:error.message};}
      finally{state.running=false;pending=null;}
      return status();
    })();
    return pending;
  }
  function start(){if(timer)return;void run();timer=setInterval(()=>void run(),6*3600000);timer.unref?.();}
  function stop(){clearInterval(timer);timer=null;}
  return {run,status,start,stop};
}
module.exports={createRosterMaintenance};
