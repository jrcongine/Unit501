'use strict';
const {fbsName}=require('./team-identity');
const {matchPlayer}=require('./player-name-match');
const {sources:registry,sourceFor}=require('./college-injury-sources');
const sources=Object.fromEntries(Object.entries(registry).filter(([,s])=>s.provider).map(([key,s])=>[key,s.url]));
const reportAliases={'Western Mich.':'Western Michigan','Central Mich.':'Central Michigan','Eastern Mich.':'Eastern Michigan','Army West Point':'Army','Fla. Atlantic':'Florida Atlantic'};
const reportSchool=(name,season)=>fbsName({name:reportAliases[name]||name},season)||fbsName({name:String(name||'').replace(/\bSt\.$/,'State')},season);
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
  return !/pending/i.test(r?.ReportType||'') && gameTime===kickoff && Number.isFinite(publishedAt) && publishedAt<=now && publishedAt<=kickoff && kickoff-publishedAt<=7*86400000 &&
   names.length===2 && wanted.every(n=>names.includes(n)) && r.games.every(t=>Array.isArray(t.rows));
 }).map(r=>({...r,publishedAt:localEpoch(r.publishDate,r.postedTime,r.conferenceTimeZone)}));
}
function createCollegeAvailability(api,now=Date.now,readPublic=async conference=>{
 const response=await fetch('https://app.hdintelligence.com/api/get-publish-public',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sport:'Football',organization:conference,conference}),signal:AbortSignal.timeout(8000)});
 if(!response.ok)throw Error('Official college report unavailable.');return response.json();
}){
 const cache=new Map();
 async function read(conf){let item=cache.get(conf);if(!item||now()-item.at>=900000){item={at:now(),pending:readPublic(registry[conf].provider).then(data=>({data,checkedAt:now()}))};cache.set(conf,item);item.pending.catch(()=>cache.delete(conf));}return item.pending;}
 return async(q,teams)=>{
  if(q.league!=='2')return;
  const unavailable=()=>({available:false,coverage:'unavailable',rows:[],message:'Official report not verified for this exact matchup. Availability remains unknown; turn off Auto injuries to enter manual points.'});
  for(const team of teams)team.official=unavailable();
  if(!/^\d{1,6}$/.test(q.game||''))return;
  try{
   const response=await api(`/games?id=${q.game}`),g=response.response?.length===1?response.response[0]:null,kickoff=Number(g?.game?.date?.timestamp)*1000;
   if(response.errors&&Object.keys(response.errors).length)throw Error();
   if(String(g?.league?.id)!==q.league||String(g?.league?.season)!==q.season||String(g?.teams?.away?.id)!==q.away||String(g?.teams?.home?.id)!==q.home||!Number.isFinite(kickoff)||kickoff<=now()||kickoff>now()+7*86400000)throw Error();
   const teamSources=new Map();
   for(const team of teams){
    const source=sourceFor(String(team.id)===q.away?g.teams.away:g.teams.home,q.season);
    if(!source)continue;
    teamSources.set(String(team.id),source);
    team.official={...unavailable(),source:source.code,publisher:source.label,url:source.url,
      coverage:source.provider?'incomplete':'unsupported',gameId:String(q.game),kickoff,season:q.season,
      message:source.provider?source.label+': no published report verified for this matchup yet. Nonconference games may not be covered. Availability remains unknown; use manual points if needed.':
        source.label+' automatic availability import is not connected. Review the official '+(source.kind==='school'?'school updates':'conference report')+', then turn off Auto injuries to enter manual points. Missing coverage does not mean no injuries.'};
   }
   // An independent or nonconference opponent can be covered by a matched report
   // from the other team's conference. Do not require both teams to be members.
   const requested=[...new Set([...teamSources.values()].filter(s=>s.provider).map(s=>s.code))];
   const results=await Promise.allSettled(requested.map(async conf=>{const report=await read(conf);return {conf,...report,matches:matchReports(report.data,g,q.season,now())};}));
   for(let i=0;i<results.length;i++)if(results[i].status==='rejected')for(const team of teams){
    if(teamSources.get(String(team.id))?.code===requested[i])team.official={...team.official,coverage:'unavailable',message:registry[requested[i]].label+' report source could not be read. Availability remains unknown; use manual points if needed.'};
   }
   const candidates=results.filter(r=>r.status==='fulfilled').flatMap(r=>r.value.matches.map(m=>({report:m,conf:r.value.conf,checkedAt:r.value.checkedAt})));
   if(!candidates.length)return;
   const latest=Math.max(...candidates.map(c=>c.report.publishedAt)),current=candidates.filter(c=>c.report.publishedAt===latest);
   // Multiple published snapshots at the same time are ambiguous, even across sources.
   if(current.length!==1){for(const team of teams)team.official={...team.official,coverage:'conflict',message:'Conflicting official reports for this matchup. No automatic injury points; review reports or enter manual points.'};return;}
   const {report,conf,checkedAt}=current[0];
   for(const team of teams){
    const identity=fbsName(String(team.id)===q.away?g.teams.away:g.teams.home,q.season);
    const sections=report.games.filter(t=>reportSchool(t.teamName,q.season)===identity);if(sections.length!==1)continue;
    const rows=[],unresolved=[];let unmatched=0;
    for(const r of sections[0].rows){
     const match=/^([A-Z]{1,5})\s+#\d+\s+(.+)$/.exec(r.name||'');if(!match||typeof r.status!=='string'){unmatched++;unresolved.push({name:r.name,status:r.status});continue;}
     const player=matchPlayer({name:match[2],position:match[1]},team.roster?.rows||[],team.id);
     if(!player){unmatched++;unresolved.push({name:match[2],position:match[1],status:r.status});continue;}
     rows.push({id:player.id,teamId:String(team.id),name:match[2],position:match[1],status:r.status,description:'Conference availability report',date:new Date(report.publishedAt).toISOString()});
    }
    team.official={available:true,coverage:unmatched?'incomplete':'verified',source:conf,publisher:registry[conf].label,checkedAt,publishedAt:report.publishedAt,gameId:String(q.game),kickoff,season:q.season,url:sources[conf],rows,unmatched,unresolved,message:'Exact-matchup conference availability report. Available does not establish starting role or workload. Partial-game exclusions remain conditional.'};
   }
  }catch{}
 };
}
module.exports={createCollegeAvailability,matchReports,localEpoch,sources};
