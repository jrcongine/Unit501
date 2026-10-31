'use strict';
// NBA-published injury report. A missing team/report is unknown, not healthy.
const TEAMS={ATL:'Atlanta Hawks',BOS:'Boston Celtics',BKN:'Brooklyn Nets',CHA:'Charlotte Hornets',CHI:'Chicago Bulls',CLE:'Cleveland Cavaliers',DAL:'Dallas Mavericks',DEN:'Denver Nuggets',DET:'Detroit Pistons',GSW:'Golden State Warriors',HOU:'Houston Rockets',IND:'Indiana Pacers',LAC:'LA Clippers',LAL:'Los Angeles Lakers',MEM:'Memphis Grizzlies',MIA:'Miami Heat',MIL:'Milwaukee Bucks',MIN:'Minnesota Timberwolves',NOP:'New Orleans Pelicans',NYK:'New York Knicks',OKC:'Oklahoma City Thunder',ORL:'Orlando Magic',PHI:'Philadelphia 76ers',PHX:'Phoenix Suns',POR:'Portland Trail Blazers',SAC:'Sacramento Kings',SAS:'San Antonio Spurs',TOR:'Toronto Raptors',UTA:'Utah Jazz',WAS:'Washington Wizards'};
const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const aliases={'losangelesclippers':'LAC','laclippers':'LAC','nyknicks':'NYK','gswarriors':'GSW'};
const teamCode=name=>aliases[normalize(name)]||Object.entries(TEAMS).find(([,v])=>normalize(v)===normalize(name))?.[0]||null;
const et=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
function eastern(epoch){const p=Object.fromEntries(et.formatToParts(new Date(epoch)).map(x=>[x.type,x.value]));return {date:p.year+'-'+p.month+'-'+p.day,hour:Number(p.hour),minute:Number(p.minute)};}
function reportTime(date,hour,minute,ampm){
 const m=/^(\d{4})-(\d\d)-(\d\d)$/.exec(date);if(!m)return null;
 hour=Number(hour);minute=Number(minute);if(hour<1||hour>12||minute>59)return null;
 const h=hour%12+(ampm==='PM'?12:0),base=Date.UTC(+m[1],+m[2]-1,+m[3],h,minute);
 const matches=[4,5].map(offset=>base+offset*3600000).filter(at=>{const e=eastern(at);return e.date===date&&e.hour===h&&e.minute===minute;});
 return matches.length===1?matches[0]:null;
}
function latestReport(html,now){
 if(typeof html!=='string'||html.length>5000000)throw Error('NBA report index unavailable');
 const re=/https:\/\/ak-static\.cms\.nba\.com\/referee\/injury\/Injury-Report_(\d{4}-\d\d-\d\d)_(\d\d)_(\d\d)(AM|PM)\.pdf/g;
 const found=new Map();for(const m of html.matchAll(re)){const at=reportTime(m[1],m[2],m[3],m[4]);if(at!==null&&at<=now+60000&&now-at<=2*3600000)found.set(m[0],at);}
 return [...found].map(([url,at])=>({url,at})).sort((a,b)=>b.at-a.at)[0]||null;
}
function reportHeader(pages){
 const page=pages?.[0];if(!page?.items)return null;
 const text=page.items.filter(i=>typeof i.str==='string'&&i.transform?.[5]>520&&i.transform[5]<560)
  .sort((a,b)=>a.transform[4]-b.transform[4]).map(i=>i.str).join('').replace(/\s+/g,' ').trim();
 const m=/Injury Report:\s*(\d\d)\/(\d\d)\/(\d\d)\s+(\d\d):(\d\d)\s*(AM|PM)/.exec(text);
 return m?reportTime('20'+m[3]+'-'+m[1]+'-'+m[2],m[4],m[5],m[6]):null;
}
function groupItems(pages){
 const rows=[];
 for(const page of pages){
  if(!page||!Number.isFinite(page.width)||page.width<700||page.width>1000||!Array.isArray(page.items))throw Error('NBA PDF layout unrecognized');
  const buckets=new Map();
  for(const item of page.items){
   if(typeof item.str!=='string'||!Array.isArray(item.transform)||item.transform.length<6)continue;
   const x=item.transform[4]*842/page.width,y=item.transform[5];
   if(!Number.isFinite(x)||!Number.isFinite(y)||y<65||y>520||x<15||x>840)continue;
   const column=x<110?0:x<190?1:x<260?2:x<420?3:x<585?4:x<665?5:6;
   const key=Math.round(y*2)/2;
   if(!buckets.has(key))buckets.set(key,Array.from({length:7},()=>[]));
   buckets.get(key)[column].push({x,text:item.str});
  }
  for(const [,columns] of [...buckets].sort((a,b)=>b[0]-a[0]))rows.push(columns.map(items=>items.sort((a,b)=>a.x-b.x).map(i=>i.text).join('').replace(/\s+/g,' ').trim()));
 }
 return rows;
}
function parseRows(rows){
 const games=new Map();let date='',time='',match='',currentTeam='';
 for(const row of rows){
  const [dateCell,timeCell,matchCell,teamCell,playerCell,statusCell,reasonCell]=row;
  if(/^\d\d\/\d\d\/\d{4}$/.test(dateCell)){const [m,d,y]=dateCell.split('/');date=y+'-'+m+'-'+d;time='';match='';currentTeam='';}
  if(/^\d\d:\d\d\s*\(ET\)$/.test(timeCell))time=timeCell.match(/^\d\d:\d\d/)[0];
  if(/^[A-Z]{2,3}@[A-Z]{2,3}$/.test(matchCell)){match=matchCell;currentTeam='';}
  if(!date||!time||!match)continue;
  const [away,home]=match.split('@');if(!TEAMS[away]||!TEAMS[home]||away===home)continue;
  const key=[date,time,match].join('|');
  if(!games.has(key))games.set(key,{date,time,away,home,teams:{}});
  const game=games.get(key);
  if(teamCell){
   const code=teamCode(teamCell);currentTeam=code&&(code===away||code===home)?code:'';
   if(currentTeam&&!game.teams[currentTeam])game.teams[currentTeam]={submitted:true,confirmed:false,players:[]};
  }
  if(!currentTeam)continue;
  const team=game.teams[currentTeam];
  if(/NOT YET SUBMITTED/i.test([playerCell,statusCell,reasonCell].join(' '))){team.submitted=false;continue;}
  if(/NO INJURIES TO REPORT/i.test([playerCell,statusCell,reasonCell].join(' '))){team.confirmed=true;continue;}
  if(!playerCell)continue;
  const validStatus=['Out','Doubtful','Questionable','Probable','Available'].includes(statusCell);
  if(!validStatus)team.conflict=true;
  team.confirmed=true;
  // League prints family name first, including multi-part suffixes.
  const comma=playerCell.lastIndexOf(',');
  if(comma<1||comma===playerCell.length-1){team.conflict=true;continue;}
  const name=(playerCell.slice(comma+1).trim()+' '+playerCell.slice(0,comma).trim()).replace(/\s+/g,' ');
  if(name.length>100||!/^[\p{L}\p{M} .,'’\-]+$/u.test(name)){team.conflict=true;continue;}
  const existing=team.players.find(p=>normalize(p.name)===normalize(name));
  if(existing&&existing.status!==statusCell)team.conflict=true;
  if(!team.players.some(p=>normalize(p.name)===normalize(name)&&p.status===(validStatus?statusCell:'Unverified')))team.players.push({name,status:validStatus?statusCell:'Unverified'});
 }
 return [...games.values()];
}
function matchReport(games,game){
 const away=teamCode(game?.away),home=teamCode(game?.home),kickoff=Date.parse(game?.tipoff||'');
 if(!away||!home||away===home||!Number.isFinite(kickoff))return null;
 const e=eastern(kickoff),hour=e.hour%12||12,clock=String(hour).padStart(2,'0')+':'+String(e.minute).padStart(2,'0');
 const found=games.filter(g=>g.date===e.date&&g.time===clock&&g.away===away&&g.home===home);
 if(found.length!==1)return null;
 const report=found[0];
 return [away,home].map(code=>({code,name:TEAMS[code],available:!!report.teams[code]?.submitted&&!!report.teams[code]?.confirmed&&!report.teams[code]?.conflict,
  players:report.teams[code]?.players||[],
  message:report.teams[code]?.conflict?'Conflicting or unrecognized report rows; listed statuses are unverified.':!report.teams[code]?.submitted?'Report not submitted or unavailable.':!report.teams[code]?.confirmed?'Report incomplete; player availability is unverified.':''}));
}
async function extractPDF(bytes){
 const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');
 const task=getDocument({data:new Uint8Array(bytes),useSystemFonts:true,isEvalSupported:false,verbosity:0});
 try{const pdf=await task.promise;if(pdf.numPages<1||pdf.numPages>15)throw Error('NBA PDF page count invalid');
  const pages=[];for(let n=1;n<=pdf.numPages;n++){const p=await pdf.getPage(n),content=await p.getTextContent();pages.push({width:p.view[2]-p.view[0],items:content.items});}
  return pages;
 }finally{await task.destroy();}
}
function createNBAInjuries({fetcher=fetch,now=Date.now,extract=extractPDF}={}){
 let cache=null;
 async function snapshot(season){
  if(cache&&cache.season===season&&now()-cache.at<300000)return cache.pending;
  const item={season,at:now()};
  item.pending=(async()=>{
   const yearEnd=String((season+1)%100).padStart(2,'0');
   const url='https://official.nba.com/nba-injury-report-'+season+'-'+yearEnd+'-season/';
   const page=await fetcher(url,{signal:AbortSignal.timeout(12000),redirect:'error'});
   if(!page.ok)throw Error('NBA injury report unavailable');
   const html=await page.text(),latest=latestReport(html,now());
   if(!latest)throw Error('Recent NBA injury report unavailable');
   const response=await fetcher(latest.url,{signal:AbortSignal.timeout(12000),redirect:'error'});
   if(!response.ok||Number(response.headers?.get?.('content-length')||0)>5000000)throw Error('NBA injury report PDF unavailable');
   const bytes=await response.arrayBuffer();if(bytes.byteLength>5000000||bytes.byteLength<100)throw Error('NBA injury report PDF invalid');
   const pages=await extract(bytes);if(reportHeader(pages)!==latest.at)throw Error('NBA report timestamp mismatch');
   const rows=groupItems(pages),games=parseRows(rows);
   if(!games.length)throw Error('NBA injury report format unrecognized');
   return {reportAt:latest.at,url:latest.url,games};
  })();cache=item;item.pending.catch(()=>{if(cache===item)cache=null;});return item.pending;
 }
 return async function get(game,season){
  if(!game||game.statusCode!==1||!Number.isInteger(season)||season<2000||season>2100||!Number.isFinite(Date.parse(game.tipoff))||Date.parse(game.tipoff)<=now())throw Error('Scheduled NBA matchup required');
  const data=await snapshot(season);if(now()-data.reportAt>2*3600000)throw Error('NBA report is stale');
  const teams=matchReport(data.games,game);
  if(!teams)throw Error('NBA report does not verify this matchup');
  return {gameId:game.id,tipoff:game.tipoff,reportAt:data.reportAt,checkedAt:now(),source:'Official NBA injury report',url:data.url,teams};
 };
}
module.exports={TEAMS,teamCode,eastern,reportTime,latestReport,reportHeader,groupItems,parseRows,matchReport,extractPDF,createNBAInjuries};
