'use strict';
// Public NFL weekly reports. A fetch time is not a publication time or a starter confirmation.
const {clean,key,matchPlayer}=require('./player-name-match');
function parseReport(html, season, week) {
  const title=clean(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]);
  if(!title.includes(`Week ${week} of the ${season} Season`)) throw new Error('Official report week could not be verified.');
  const teams=[];
  const sections=/<div class="d3-o-section-sub-title"><span>([^<]+)<\/span><\/div>[\s\S]*?<table\b[^>]*>([\s\S]*?)<\/table>/g;
  for(const match of html.matchAll(sections)) {
    if(!/Game Status/.test(match[2])) continue;
    const rows=[];
    for(const row of match[2].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)) {
      const cells=[...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)].map(m=>clean(m[1]));
      if(cells.length!==5)continue;
      rows.push({name:cells[0],position:cells[1],description:cells[2],practice:cells[3],status:cells[4]});
    }
    teams.push({name:clean(match[1]),rows});
  }
  if(!teams.length || new Set(teams.map(t=>key(t.name))).size!==teams.length)throw new Error('Official report layout could not be verified.');
  return teams;
}
function createOfficialInjuries(api, now=Date.now, fetchPage=async url=>{
  const response=await fetch(url,{signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw new Error('Official report unavailable.');
  return response.text();
}, attachDepth=null) {
  const inactives=require('./game-day-inactives').createGameDayInactives(now,fetchPage);
  const cache=new Map(),transactions=require('./roster-transactions').createRosterTransactions(now,fetchPage);
  return async function(q, teams) {
    const unavailable={available:false,rows:[],message:'Official NFL cross-check unavailable; starting roles remain unverified.'};
    if(q.league!=='1'||!/^\d{1,6}$/.test(q.game||''))return;
    let depthTask,transactionTask,inactiveTask;
    try {
      const result=await api(`/games?id=${q.game}`);
      if(result.errors&&Object.keys(result.errors).length)throw new Error();
      const g=result.response?.length===1?result.response[0]:null;
      const kickoff=Number(g?.game?.date?.timestamp)*1000;
      const week=Number(/^Week (\d+)$/.exec(g?.game?.week||'')?.[1]);
      if(String(g?.league?.id)!==q.league||String(g?.league?.season)!==q.season||String(g?.teams?.away?.id)!==q.away||String(g?.teams?.home?.id)!==q.home||g?.game?.stage!=='Regular Season'||week<1||week>18||!Number.isFinite(week)||!Number.isFinite(kickoff)||kickoff<=now()||kickoff>now()+7*86400000)throw new Error();
      inactiveTask=inactives(q,teams,g);
      if(attachDepth)depthTask=attachDepth(q,teams,g);
      transactionTask=transactions(q,teams,g);
      const url=`https://www.nfl.com/injuries/league/${q.season}/reg${week}`;
      let item=cache.get(url);
      if(!item||now()-item.at>=900000){item={at:now(),pending:fetchPage(url).then(html=>({teams:parseReport(html,q.season,week),checkedAt:now()}))};cache.set(url,item);item.pending.catch(()=>cache.delete(url));if(cache.size>4)cache.delete(cache.keys().next().value);}
      const report=await item.pending;
      for(const team of teams) {
        const name=String(team.id)===q.away?g.teams.away.name:g.teams.home.name;
        const matches=report.teams.filter(t=>key(name).endsWith(key(t.name)));
        if(matches.length!==1){team.official={...unavailable};continue;}
        const rows=[],unresolved=[];let unmatched=0;
        for(const r of matches[0].rows){
          const player=matchPlayer(r,team.roster?.rows||[],team.id);
          if(!player){unmatched++;unresolved.push({...r});continue;}
          rows.push({...r,id:player.id,teamId:String(team.id)});
        }
        team.official={available:true,checkedAt:report.checkedAt,gameId:String(q.game),kickoff,season:q.season,week,url,rows,unmatched,unresolved,message:'Official weekly game status; blank statuses do not confirm participation. Starters are unverified.'};
      }
    }catch{for(const team of teams)team.official={...unavailable};}
    if(inactiveTask)await inactiveTask;
    if(depthTask)await depthTask;
    if(transactionTask)await transactionTask;
  };
}
module.exports={parseReport,createOfficialInjuries,matchPlayer};
