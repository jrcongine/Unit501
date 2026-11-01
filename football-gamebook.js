'use strict';
// Reviewed game identities, parsed automatically for every unambiguous player.
// Never accept a caller-supplied PDF URL. Unsupported layouts remain unavailable.
const sources=[{league:'1',season:'2026',date:'2026-10-29',away:'Carolina Panthers',home:'Green Bay Packers',awayScore:19,homeScore:27,
 url:'https://static.clubs.nfl.com/image/upload/packers/ia7jnbokrjesqdfxqreh',
 page:'https://www.packers.com/game-day/2026/reg-week8/packers-vs-panthers/'}];
sources.push(
 {league:'1',season:'2025',date:'2025-12-25',away:'Detroit Lions',home:'Minnesota Vikings',awayScore:10,homeScore:23,url:'https://static.www.nfl.com/image/upload/v1766760008/gamecenter/f91b6ce0-311e-11f0-b670-ae1250fadad1.pdf',page:'https://www.nfl.com/games/lions-at-vikings-2025-reg-17'},
 {league:'1',season:'2026',date:'2026-10-18',away:'Dallas Cowboys',home:'Green Bay Packers',awayScore:13,homeScore:23,url:'https://static.clubs.nfl.com/image/upload/packers/fgwfiyxcsyutwuntwjcb',page:'https://www.packers.com/game-day/2026/reg-week6/packers-vs-cowboys/'},
 {league:'1',season:'2026',date:'2026-10-11',away:'Chicago Bears',home:'Green Bay Packers',awayScore:7,homeScore:31,url:'https://static.clubs.nfl.com/image/upload/packers/pqpptpb5ckujllxac1md',page:'https://www.packers.com/game-day/2026/reg-week5/packers-vs-bears/'},
 {league:'1',season:'2026',date:'2026-09-20',away:'Green Bay Packers',home:'New York Jets',awayScore:20,homeScore:17,url:'https://static.clubs.nfl.com/image/upload/packers/zu3fdftopjkj8hkcwckc',page:'https://www.packers.com/game-day/2026/reg-week2/packers-at-jets/'}
);
// Recorded official links retain access when a team changes its schedule page.
sources.push(
 {"league":"1","season":"2026","date":"2026-09-13","away":"Washington Commanders","home":"Philadelphia Eagles","awayScore":22,"homeScore":24,"url":"https://www.nflgsis.com/2026/REG/01/60191/Gamebook.pdf","page":"https://www.philadelphiaeagles.com/schedule/"},
 {"league":"1","season":"2026","date":"2026-09-20","away":"Philadelphia Eagles","home":"Tennessee Titans","awayScore":24,"homeScore":20,"url":"https://www.nflgsis.com/2026/REG/02/60202/Gamebook.pdf","page":"https://www.philadelphiaeagles.com/schedule/"},
 {"league":"1","season":"2026","date":"2026-09-28","away":"Philadelphia Eagles","home":"Chicago Bears","awayScore":7,"homeScore":27,"url":"https://www.nflgsis.com/2026/REG/03/60225/Gamebook.pdf","page":"https://www.philadelphiaeagles.com/schedule/"},
 {"league":"1","season":"2026","date":"2026-10-04","away":"Los Angeles Rams","home":"Philadelphia Eagles","awayScore":24,"homeScore":20,"url":"https://www.nflgsis.com/2026/REG/04/60234/Gamebook.pdf","page":"https://www.philadelphiaeagles.com/schedule/"},
 {"league":"1","season":"2026","date":"2026-10-11","away":"Philadelphia Eagles","home":"Jacksonville Jaguars","awayScore":17,"homeScore":19,"url":"https://www.nflgsis.com/2026/REG/05/60243/Gamebook.pdf","page":"https://www.philadelphiaeagles.com/schedule/"},
 {"league":"1","season":"2026","date":"2026-10-18","away":"Carolina Panthers","home":"Philadelphia Eagles","awayScore":25,"homeScore":14,"url":"https://www.nflgsis.com/2026/REG/06/60264/Gamebook.pdf","page":"https://www.philadelphiaeagles.com/schedule/"},
 {"league":"1","season":"2026","date":"2026-10-26","away":"Dallas Cowboys","home":"Philadelphia Eagles","awayScore":38,"homeScore":21,"url":"https://www.nflgsis.com/2026/REG/07/60284/Gamebook.pdf","page":"https://www.philadelphiaeagles.com/schedule/"}
);
const dateKey=seconds=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(seconds*1000));
function lines(items,side,width){
 const groups=[];
 for(const item of items.filter(i=>i.str?.trim()&&(side===undefined||(i.transform[4]<width/2?0:1)===side)).sort((a,b)=>b.transform[5]-a.transform[5]||a.transform[4]-b.transform[4])){
  let row=groups.find(g=>Math.abs(g.y-item.transform[5])<2);
  if(!row){row={y:item.transform[5],items:[]};groups.push(row);}row.items.push(item);
 }
 return groups.map(g=>g.items.sort((a,b)=>a.transform[4]-b.transform[4]).map(i=>i.str.trim()).join(' ').replace(/\s+/g,' ').trim());
}
function roster(rows,team){
 const start=rows.indexOf(team),sub=rows.indexOf('Substitutions'),dnp=rows.indexOf('Did Not Play'),inactive=rows.indexOf('Not Active');
 if(start<0||sub<=start||dnp<=sub||inactive<=dnp)throw Error('Participation sections unavailable');
 const positions='3QB|QB|RB|FB|WR|TE|C/G|G/T|T/G|C|G|T|OL|LT|LG|RG|RT|OLB|ILB|LB|EDGE|DE|DT|NT|DL|CB|FS|SS|S|DB|LS|K|P';
 const expression=new RegExp('(?:^|[, ]+)('+positions+')\\s+(\\d{1,2})\\s+([A-Z][a-z]{0,3}\\.[A-Za-zÀ-ž][A-Za-zÀ-ž.\x27’ -]*?)(?=,|\\s+(?:'+positions+')\\s+\\d|$)','g');
 function parse(text,participation){
  text=text.replace(/\s+/g,' ').trim();if(!text)return [];
  const out=[],matches=[...text.matchAll(expression)];
  let remainder=text;
  for(const m of matches){out.push({name:m[3].trim(),jersey:Number(m[2]),position:m[1],participation});remainder=remainder.replace(m[0],'');}
  if(remainder.replace(/[,\s]/g,''))throw Error('Unparsed participation text');
  return out;
 }
 // The right column has no field-goals heading; stop before the scoring grid.
 const end=rows.findIndex((r,i)=>i>inactive&&(/Field Goals|^1 2 3 4|^VISITOR:/.test(r)));
 if(end<0)throw Error('Participation boundary unavailable');
 const starters=parse(rows.slice(start+1,sub).filter(r=>r!=='Offense Defense').join(' '),'played');
 if(starters.length!==22)throw Error('Starting lineup incomplete');
 const players=[...starters,...parse(rows.slice(sub+1,dnp).join(' '),'played'),...parse(rows.slice(dnp+1,inactive).join(' '),'dnp'),...parse(rows.slice(inactive+1,end).join(' '),'dnp')];
 if(players.length<45||players.length>60||new Set(players.map(p=>p.jersey)).size!==players.length)throw Error('Participation roster incomplete or ambiguous');
 return players;
}
const categories=[
 {header:'RUSHING ATT YDS AVG LG TD',keys:['carries','rushYds',null,null,'rushTD'],next:'PASSING ATT CMP YDS SK/YD TD LG IN RT'},
 {header:'PASSING ATT CMP YDS SK/YD TD LG IN RT',keys:['attempts',null,'passYds',null,'passTD',null,null,null],next:'PASS RECEIVING TAR REC YDS AVG LG TD'},
 {header:'PASS RECEIVING TAR REC YDS AVG LG TD',keys:['targets','rec','recYds',null,null,'recTD'],next:'INTERCEPTIONS NO YDS AVG LG TD'}
];
function statistics(rows,players){
 const all=new Map(players.map(p=>[p.name,[]]));for(const p of players)all.get(p.name).push(p);
 for(const spec of categories){
  const start=rows.indexOf(spec.header),end=rows.indexOf(spec.next);
  if(start<0||end<=start)throw Error('Complete offensive tables unavailable');
  const body=rows.slice(start+1,end),total=body.at(-1);
  if(!total?.startsWith('Total '))throw Error('Official total unavailable');
  const parsed=body.map(row=>{const cells=row.split(' '),values=cells.splice(-spec.keys.length),name=cells.join(' ');
   if(values.length!==spec.keys.length||!name)throw Error('Malformed stat row');
   const stats={};spec.keys.forEach((k,i)=>{if(!k)return;if(!/^-?\d+$/.test(values[i]))throw Error('Invalid statistic');const value=Number(values[i]);if(!k.endsWith('Yds')&&value<0)throw Error('Negative count');stats[k]=value;});return {name,stats};});
  const sum=parsed.pop();if(sum.name!=='Total'||new Set(parsed.map(r=>r.name)).size!==parsed.length)throw Error('Duplicate statistics');
  for(const k of spec.keys.filter(Boolean))if(parsed.reduce((n,r)=>n+r.stats[k],0)!==sum.stats[k])throw Error('Official totals do not reconcile');
  for(const row of parsed){const matches=all.get(row.name);if(matches?.length!==1||matches[0].participation!=='played')throw Error('Stat player participation ambiguous');Object.assign(matches[0],row.stats);}
  // A complete official table plus verified participation supports omitted zeros.
  for(const p of players)if(p.participation==='played')for(const k of spec.keys.filter(Boolean))if(p[k]===undefined)p[k]=0;
 }
 return players;
}
async function extract(bytes){
 const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');
 const task=getDocument({data:new Uint8Array(bytes),useSystemFonts:true,isEvalSupported:false,verbosity:0});
 try{const pdf=await task.promise;if(pdf.numPages<2||pdf.numPages>80)throw Error('Invalid gamebook');
  const pages=[];for(let n=1;n<=Math.min(6,pdf.numPages);n++){const p=await pdf.getPage(n),page={width:p.view[2]-p.view[0],items:(await p.getTextContent()).items};
   if(n===1)pages.push(page);else if(lines(page.items,undefined,page.width).includes('Final Individual Statistics')){pages.push(page);break;}}
  if(pages.length!==2)throw Error('Final individual statistics unavailable');return pages;
 }finally{await task.destroy();}
}
function parse(pages,source){
 if(pages.length!==2)throw Error('Gamebook pages missing');
 const [first,second]=pages,header=lines(first.items,undefined,first.width);
 const date=source.date.split('-');
 if(!header.some(r=>r.includes('National Football League Game Summary'))||!header.some(r=>r.includes(`${source.away} at ${source.home}`))||!header.some(r=>r.includes(`Date:`)&&new RegExp('\\b0?'+Number(date[1])+'/0?'+Number(date[2])+'/'+date[0]+'\\b').test(r)))throw Error('Gamebook identity mismatch');
 for(const [label,team,score]of [['VISITOR:',source.away,source.awayScore],['HOME:',source.home,source.homeScore]]){
  const rows=header.filter(r=>r.startsWith(label+' '+team+' '));if(rows.length!==1||Number(rows[0].split(' ').at(-1))!==score)throw Error('Final score mismatch');
 }
 const statisticsHeader=lines(second.items,undefined,second.width);
 if(!statisticsHeader.includes('Final Individual Statistics')||!statisticsHeader.some(r=>r.includes(`${source.away} vs ${source.home}`))||!statisticsHeader.some(r=>new RegExp('\\b0?'+Number(date[1])+'/0?'+Number(date[2])+'/'+date[0]+'\\b').test(r)))throw Error('Final statistics missing or identity mismatch');
 const boundary=first.items.filter(i=>i.str==='Field Goals (made ( ) & missed)');
 if(boundary.length!==1)throw Error('Participation boundary unavailable');
 const participation=first.items.filter(i=>i.transform[5]>boundary[0].transform[5]+2);
 return [source.away,source.home].map((name,i)=>({name,players:statistics(lines(second.items,i,second.width),roster([...lines(participation,i,first.width),'Field Goals (made ( ) & missed)'],name))}));
}
function createGamebooks({api,fetcher=fetch,now=Date.now,extractPDF=extract,registry=sources,discover}={}){
 const cache=new Map();
 return async q=>{
  const unavailable={available:false,gameId:String(q.game),reason:'No verified official gamebook for this game.'};
  const candidates=registry.filter(s=>s.league===q.league&&s.season===q.season&&s.date===q.date);if(!candidates.length&&!discover)return unavailable;
  try{
   const response=await api('/games?id='+encodeURIComponent(q.game));
   if(response.errors&&Object.keys(response.errors).length||response.paging?.total>1||response.response?.length!==1)throw Error('Game unavailable');
   const g=response.response[0],time=Number(g.game?.date?.timestamp);
   if(String(g.game?.id)!==String(q.game)||String(g.league?.id)!==q.league||String(g.league?.season)!==q.season||!['FT','AOT','FINAL'].includes(g.game?.status?.short)||g.game?.stage!=='Regular Season'||!Number.isFinite(time)||time*1000>=now()||dateKey(time)!==q.date)throw Error('Completed game identity unverified');
   if(['away','home'].some(side=>!/^\d+$/.test(String(g.scores?.[side]?.total??''))))throw Error('Final scores unavailable');
   const matches=candidates.filter(s=>s.away===g.teams?.away?.name&&s.home===g.teams?.home?.name&&s.awayScore===Number(g.scores?.away?.total)&&s.homeScore===Number(g.scores?.home?.total));
   if(matches.length>1)throw Error('Official matchup ambiguous');
   const source=matches[0]||await discover?.({league:q.league,season:q.season,date:q.date,gameDate:time,away:g.teams?.away?.name,home:g.teams?.home?.name,awayScore:Number(g.scores?.away?.total),homeScore:Number(g.scores?.home?.total)});
   if(!source)throw Error('Official gamebook unavailable');
   let item=cache.get(source.url);
   if(!item||now()-item.at>=6*3600000){item={at:now(),pending:(async()=>{
    const r=await fetcher(source.url,{signal:AbortSignal.timeout(15000),redirect:'error'});if(!r.ok||Number(r.headers?.get?.('content-length')||0)>8000000)throw Error('Gamebook unavailable');
    const bytes=await r.arrayBuffer();if(bytes.byteLength>8000000||bytes.byteLength<100)throw Error('Invalid gamebook size');return parse(await extractPDF(bytes),source);
   })()};cache.set(source.url,item);item.pending.catch(()=>{if(cache.get(source.url)===item)cache.delete(source.url);});if(cache.size>100)cache.delete(cache.keys().next().value);}
   const teams=(await item.pending).map((t,i)=>({...t,id:String(g.teams[i?'home':'away'].id),scored:i?source.homeScore:source.awayScore,allowed:i?source.awayScore:source.homeScore}));
   return {available:true,gameId:String(q.game),league:q.league,season:q.season,gameDate:time,teams,source:source.url,checkedAt:now()};
  }catch{return {...unavailable,reason:'Official participation or statistics could not be verified.'};}
 };
}
module.exports={sources,lines,roster,statistics,extract,parse,createGamebooks};
