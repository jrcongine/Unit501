'use strict';
// Refresh existing guarded availability sources; never infer trades or rewrite reviewed identities.
function createRosterMaintenance(api, availability, now=Date.now) {
  let pending=null, timer=null;
  let state={running:false,lastStarted:null,lastCompleted:null,gamesChecked:0,issues:[],message:'Waiting for the first automatic roster check.'};
  const status=()=>({...state,issues:state.issues.map(x=>({...x}))});
  function run(){
    if(pending)return pending;
    state={...state,running:true,lastStarted:now(),message:'Checking upcoming NFL and college roster, injury and role reports.'};
    pending=(async()=>{
      const issues=[];let gamesChecked=0;
      try{
        const date=new Date(now()),season=String(date.getUTCFullYear()-(date.getUTCMonth()<2?1:0));
        const schedules=[];
        for(const league of ['1','2']){
          const result=await api('/games?league='+league+'&season='+season);
          if(!Array.isArray(result.response)||Object.keys(result.errors||{}).length||result.paging?.total>1)throw Error('Schedule unavailable or incomplete.');
          schedules.push(...result.response.filter(g=>String(g.league?.id)===league));
        }
        const seen=new Set();
        const games=schedules.filter(g=>{
          const at=Number(g.game?.date?.timestamp)*1000,id=String(g.game?.id);
          if(!['1','2'].includes(String(g.league?.id))||String(g.league?.season)!==season||!/^\d+$/.test(id)||seen.has(id)||!(at>now()&&at<=now()+7*86400000))return false;
          seen.add(id);return true;
        });
        for(const g of games){
          const game=String(g.game.id),label=g.teams?.away?.name+' at '+g.teams?.home?.name;
          const away=String(g.teams?.away?.id),home=String(g.teams?.home?.id);
          if(!/^\d+$/.test(away)||!/^\d+$/.test(home)){issues.push({game,label,kind:'coverage',reason:'Team identities unavailable.'});continue;}
          try{
            const league=String(g.league.id);
            const report=await availability({league,season,game,away,home});
            if(!report.current){issues.push({game,label,kind:'coverage',reason:'Current season coverage unverified.'});continue;}
            gamesChecked++;
            const ownership=report.rosterOwnership;
            if(league==='1'&&!ownership?.complete)issues.push({game,label,kind:'coverage',reason:'League roster ownership check incomplete'+(Number.isFinite(ownership?.checkedTeams)?': '+ownership.checkedTeams+' of '+ownership.expectedTeams+' teams checked':'')+'.'+(ownership?.failedTeams?.length?' Unchecked teams: '+ownership.failedTeams.map(t=>t.name).join(', ')+'.':'')});
            for(const team of report.teams||[]){
              const teamName=team.id===home?g.teams.home.name:g.teams.away.name;
              for(const [field,title] of [['roster','Roster'],['official','Official injuries'],[league==='1'?'depth':'injuryUsage',league==='1'?'Depth chart':'Recent player roles']]){
                const source=team[field];
                if(!source?.available)issues.push({game,label:teamName,kind:'coverage',reason:title+' unavailable; status remains unknown.',players:[],url:source?.url});
                else if(Number(source.unmatched)>0)issues.push({game,label:teamName,kind:field==='official'?'injury-identity':'depth-identity',reason:title+': '+source.unmatched+' unmatched entries.',url:source.url,players:(source.unresolved||[]).map(p=>({name:p.name,position:p.position,status:p.status||null,rank:p.rank||null,reason:p.reason||null}))});
              }
              const conflicts=(ownership?.conflicts||[]).filter(x=>x.teamIds.includes(team.id));
              if(conflicts.length)issues.push({game,label:teamName,kind:'ownership',reason:conflicts.length+' conflicting player ownership entries; review required.',players:conflicts.map(p=>{const matches=(team.roster?.rows||[]).filter(r=>String(r.id)===String(p.id));return {id:p.id,name:matches.length===1?matches[0].name:'Player ID '+p.id,position:matches.length===1?matches[0].position:null,teamIds:p.teamIds,teamNames:p.teamIds.map(id=>ownership.teamNames?.[id]||'Team '+id)};})});
              if(team.transactions?.unverified)issues.push({game,label:teamName,kind:'transaction',reason:team.transactions.unverified+' expired or unverified transaction reviews.'});
            }
          }catch{issues.push({game,label,kind:'coverage',reason:'Availability refresh failed; retry at the next sweep or open the matchup.'});}
        }
        for(const issue of issues){
          const urgentInjury=issue.kind==='injury-identity'&&(issue.players||[]).some(p=>/^(out|inactive)$/i.test(p.status||''));
          issue.priority=issue.kind==='ownership'||urgentInjury?1:issue.kind==='depth-identity'?3:2;
          issue.reviewLabel=issue.priority===1?'Review first':issue.priority===2?'Data needs review':'Depth details';
          const match=games.find(g=>String(g.game.id)===issue.game);if(match){issue.matchup=match.teams.away.name+' at '+match.teams.home.name;issue.kickoff=Number(match.game.date.timestamp)*1000;}}
        state={...state,lastCompleted:now(),gamesChecked,issues,message:games.length?'Upcoming NFL and college reports checked. Unresolved items require review; no trades or workloads are guessed.':'No NFL or college games scheduled in the next seven days.'};
      }catch(error){state={...state,message:error.message+(state.lastCompleted!==null?' Showing results from the last completed check; refresh failed.':'')};}
      finally{state.running=false;pending=null;}
      return status();
    })();
    return pending;
  }
  // Never spend dozens of provider calls just because Railway restarted.
  // Optional sweeps are no more frequent than daily and start after the first interval.
  function start(){
    if(timer)return;
    state={...state,message:'Automatic roster sweep scheduled daily (opt-in); first run after 24 hours. Selecting a matchup still loads its own injury reports.'};
    timer=setInterval(()=>void run(),24*3600000);
    timer.unref?.();
  }
  function stop(){clearInterval(timer);timer=null;}
  function pause(){
    stop();
    state={...state,message:'Background roster sweeps paused to conserve football API requests. Selecting a matchup still fetches its current reports.'};
  }
  return {run,status,start,stop,pause};
}
module.exports={createRosterMaintenance};
