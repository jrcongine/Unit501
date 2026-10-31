'use strict';
const {fbsName}=require('./team-identity');
const {matchPlayer}=require('./player-name-match');
const sources={B12:'https://big12sports.com/sports/2025/8/14/FBreporting.aspx',SEC:'https://www.secsports.com/fbreports',ACC:'https://theacc.com/sports/2025/8/28/availability-reporting-football.aspx',B10:'https://bigten.org/sports/2026/9/10/FB_Availability_Reports.aspx',American:'https://theamerican.org/sports/2026/8/6/football_player_availability.aspx',MAC:'https://getsomemaction.com/sports/2026/7/28/FB_0728265050.aspx.aspx'};
const reportAliases={'Fla. Atlantic':'Florida Atlantic','South Fla.':'South Florida','Army West Point':'Army','Western Mich.':'Western Michigan'};
const reportSchool=(name,season)=>fbsName({name:reportAliases[name]||name},season)||fbsName({name:String(name||'').replace(/\bSt\.$/,'State')},season);
const nameKey=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
function localEpoch(date,time,zone){
 const tz={CT:'America/Chicago',ET:'America/New_York'}[zone];
 if(!tz||!/^\d{4}-\d{2}-\d{2}$/.test(date||'')||!/^\d{1,2}:\d{2}:\d{2}$/.test(time||''))return NaN;
 const [y,m,d]=date.split('-').map(Number),[h,min,sec]=time.split(':').map(Number);
 if(h>23||min>59||sec>59)return NaN;
 const target=Date.UTC(y,m-1,d,h,min,sec);if(new Date(target).toISOString().slice(0,10)!==date)return NaN;
 const format=new Intl.DateTimeFormat('en-US',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
 const wall=t=>{const p=Object.fromEntries(format.formatToParts(t).map(p=>[p.type,p.value]));return Date.UTC(Number(p.year),Number(p.month)-1,Number(p.day),Number(p.hour),Number(p.minute),Number(p.second));};
 let result=target;for(let i=0;i<3;i++)result+=target-wall(result);
 return wall(result)===target?result:NaN;
}
function matchReports(payload,g,season,now){
 const kickoff=Number(g.game.date.timestamp)*1000;
 const wanted=[g.teams.away,g.teams.home].map(t=>fbsName(t,season));
 if(wanted.some(n=>!n)||wanted[0]===wanted[1])return [];
 if(!payload||typeof payload!=='object'||Array.isArray(payload))throw Error('Invalid official report.');
 return Object.values(payload).filter(r=>{
  const gameTime=localEpoch(r?.footer?.date,r?.footer?.time,r?.conferenceTimeZone);
  const publishedAt=localEpoch(r?.publishDate,r?.postedTime,r?.conferenceTimeZone);
  const names=(r?.games||[]).map(t=>reportSchool(t.teamName,season));
  return gameTime===kickoff && Number.isFinite(publishedAt) && publishedAt<=now && publishedAt<=kickoff && kickoff-publishedAt<=7*86400000 &&
   names.length===2 && wanted.every(n=>names.includes(n)) && r.games.every(t=>Array.isArray(t.rows));
 }).map(r=>({...r,publishedAt:localEpoch(r.publishDate,r.postedTime,r.conferenceTimeZone)}));
}
function createCollegeAvailability(api,now=Date.now,readPublic=async conference=>{
 const response=await fetch('https://app.hdintelligence.com/api/get-publish-public',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sport:'Football',organization:conference,conference}),signal:AbortSignal.timeout(8000)});
 if(!response.ok)throw Error('Official college report unavailable.');return response.json();
}){
 const cache=new Map();
 async function read(conf){let item=cache.get(conf);if(!item||now()-item.at>=900000){item={at:now(),pending:readPublic(conf).then(data=>({data,checkedAt:now()}))};cache.set(conf,item);item.pending.catch(()=>cache.delete(conf));}return item.pending;}
 return async(q,teams)=>{
  if(q.league!=='2')return;
  const unavailable=()=>({available:false,rows:[],message:'Official Big 12/SEC/ACC/Big Ten/American/MAC report not verified for this exact matchup. Other conference coverage is unsupported; availability remains unknown.'});
  for(const team of teams)team.official=unavailable();
  if(!/^\d{1,6}$/.test(q.game||''))return;
  try{
   const response=await api(`/games?id=${q.game}`),g=response.response?.length===1?response.response[0]:null,kickoff=Number(g?.game?.date?.timestamp)*1000;
   if(response.errors&&Object.keys(response.errors).length)throw Error();
   if(String(g?.league?.id)!==q.league||String(g?.league?.season)!==q.season||String(g?.teams?.away?.id)!==q.away||String(g?.teams?.home?.id)!==q.home||!Number.isFinite(kickoff)||kickoff<=now()||kickoff>now()+7*86400000)throw Error();
   const results=await Promise.allSettled(Object.keys(sources).map(async conf=>{const report=await read(conf);return {conf,...report,matches:matchReports(report.data,g,q.season,now())};}));
   const candidates=results.filter(r=>r.status==='fulfilled').flatMap(r=>r.value.matches.map(m=>({report:m,conf:r.value.conf,checkedAt:r.value.checkedAt})));
   const diagnostics=results.map((r,i)=>({source:Object.keys(sources)[i],
    state:r.status==='rejected'?'fetch-or-parse-failed':r.value.matches.length?'matched':'no-exact-match'}));
   for(const team of teams)team.official.diagnostics=diagnostics;
   if(!candidates.length){
    const failed=diagnostics.filter(d=>d.state==='fetch-or-parse-failed').map(d=>d.source);
    for(const team of teams){team.official.reasonCode=failed.length===diagnostics.length?'sources-unavailable':'no-matching-report';
     team.official.message='No verified report for this exact matchup in Big 12/SEC/ACC/Big Ten/American/MAC coverage.'+
      (failed.length?' Fetch or parse failed: '+failed.join(', ')+'.':' All configured sources checked; no exact matchup report found.')+
      ' Other conferences are unsupported. Availability remains unknown.';}
    return;
   }
   const latest=Math.max(...candidates.map(c=>c.report.publishedAt)),current=candidates.filter(c=>c.report.publishedAt===latest);
   // Multiple published snapshots at the same time are ambiguous, even across sources.
   if(current.length!==1){for(const team of teams){team.official.reasonCode='ambiguous-report';team.official.message='Conflicting reports share the latest publication time; availability remains unknown.';}return;}
   const {report,conf,checkedAt}=current[0];
   for(const team of teams){
    const identity=fbsName(String(team.id)===q.away?g.teams.away:g.teams.home,q.season);
    const sections=report.games.filter(t=>reportSchool(t.teamName,q.season)===identity);if(sections.length!==1)continue;
    const rows=[],unresolved=[];let unmatched=0;
    for(const r of sections[0].rows){
     const match=/^([A-Z]{1,5})\s+#\d+\s+(.+)$/.exec(r.name||'');if(!match||typeof r.status!=='string'){unmatched++;unresolved.push({name:r.name,status:r.status});continue;}
     const player=matchPlayer({name:match[2],position:match[1]},team.roster?.rows||[],team.id,q);
     if(!player){unmatched++;unresolved.push({name:match[2],position:match[1],status:r.status});continue;}
     rows.push({id:player.id,teamId:String(team.id),name:match[2],position:match[1],status:r.status,description:'Conference availability report',date:new Date(report.publishedAt).toISOString()});
    }
    team.official={available:true,diagnostics,source:conf,publisher:conf==='B10'?'Big Ten':conf==='B12'?'Big 12':conf,checkedAt,publishedAt:report.publishedAt,gameId:String(q.game),kickoff,season:q.season,url:sources[conf],rows,unmatched,unresolved,message:'Exact-matchup conference availability report. Available does not establish starting role or workload. Partial-game exclusions remain conditional.'};
   }
  }catch{for(const team of teams){team.official.reasonCode='game-verification-failed';team.official.message='Game identity, timing, or provider response could not be verified; availability remains unknown.';}}
 };
}
module.exports={createCollegeAvailability,matchReports,localEpoch,sources};
