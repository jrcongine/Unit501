'use strict';
// Only Boyd's Bets publicly displayed free picks, never package previews or inferred bets.
const URLS={
  nfl:'https://www.boydsbets.com/free-nfl-picks/',
  ncaaf:'https://www.boydsbets.com/free-college-football-picks/',
  mlb:'https://www.boydsbets.com/free-baseball-picks/'
};
const SUMMARY='https://www.boydsbets.com/free-sports-picks/';
const SPORTS={nfl:'NFL',ncaaf:'NCAA-F',mlb:'MLB'};
const MONTHS={jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};
const pad=x=>String(x).padStart(2,'0');
function plain(html){
 return String(html||'').replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi,'')
  .replace(/<[^>]*>/g,' ')
  .replace(/&#(x[0-9a-f]+|\d+);/gi,(_,code)=>{const n=code[0].toLowerCase()==='x'?parseInt(code.slice(1),16):Number(code);return Number.isInteger(n)&&n>=0&&n<=0x10ffff?String.fromCodePoint(n):'';})
  .replace(/&(amp|quot|apos|lt|gt|nbsp|#0*39);/gi,(_,code)=>({amp:'&',quot:'"',apos:"'",lt:'<',gt:'>',nbsp:' ','#039':"'",'#39':"'"}[code.toLowerCase()]||''))
  .replace(/\s+/g,' ').trim();
}
function today(now){
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(now));
 const part=key=>parts.find(p=>p.type===key)?.value;
 return part('year')+'-'+part('month')+'-'+part('day');
}
function shortDate(match){
 if(!match)return '';
 const month=MONTHS[String(match[1]).slice(0,3).toLowerCase()];
 if(!month)return '';
 return '20'+match[3]+'-'+pad(month)+'-'+pad(match[2]);
}
function fullDate(match){
 if(!match)return '';
 const month=MONTHS[String(match[1]).slice(0,3).toLowerCase()];
 if(!month)return '';
 return match[3]+'-'+pad(month)+'-'+pad(match[2]);
}
// Boyd's sport pages print each free selection under a handicapper heading, with
// "Game Details", sport/matchup, "Play on", and a distinct release timestamp.
// Reject incomplete sections instead of treating surrounding paid ads as picks.
function parseSport(html,league,now=Date.now()){
 if(!SPORTS[league])return [];
 const chunks=String(html||'').split(/<h3\b[^>]*>/i).slice(1);
 const seen=new Set(),picks=[];
 for(const chunk of chunks){
  const close=chunk.search(/<\/h3\s*>/i);
  if(close<0)continue;
  const author=plain(chunk.slice(0,close));
  const body=plain(chunk.slice(close+5));
  if(!author||author.length>75||!/\bGame Details\b/i.test(body))continue;
  const event=body.match(/\bGame Details\s+((Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})\s*['’]\s*(\d{2}),?\s*\d{1,2}:\d{2}\s*(?:AM|PM))/i);
  if(!event)continue;
  const eventDate=shortDate([null,event[2],event[3],event[4]]);
  if(!eventDate||eventDate<today(now))continue;
  const selection=body.match(/\b(NFL|NCAA-F|MLB)\s*\|\s*(.{3,140}?)\s+Play on:\s*(.{3,160}?)\s+(?:Game Analysis|Pick Released on)/i);
  if(!selection||selection[1].toUpperCase()!==SPORTS[league])continue;
  const matchup=selection[2].trim(),pick=selection[3].trim();
  if(!/\bvs\.?\b|\bat\b|@/i.test(matchup)||!/[+-]\d{2,4}\b/.test(pick))continue;
  const release=body.match(/\bPick Released on\s+((Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}\s+at\s+\d{1,2}:\d{2}\s*(?:am|pm))/i);
  if(!release)continue;
  const id='boyds:'+league+':'+eventDate+':'+author.toLowerCase()+':'+matchup.toLowerCase()+':'+pick.toLowerCase();
  if(seen.has(id))continue;seen.add(id);
  picks.push({id,source:'boyds',author,league,pick,matchup,
   eventLabel:event[1]+' (source time)',eventDate,
   publishedLabel:release[1]+' (source time)',url:URLS[league]});
 }
 return picks.slice(0,60);
}
// A dedicated sport page can legitimately show no free picks, while Boyd's
// daily all-sports TABLE contains a pick for that sport. The summary does not
// show an event time, so mark that limitation explicitly and filter by the
// summary's current update date rather than guessing a kickoff.
function parseSummary(html,league,now=Date.now()){
 if(!SPORTS[league])return [];
 const updated=plain(html).match(/\bLast updated:\s*(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})/i);
 if(!updated||fullDate([null,updated[1],updated[2],updated[3]])!==today(now))return [];
 const picks=[],seen=new Set(),sourceSport=SPORTS[league];
 for(const table of String(html||'').matchAll(/<table\b[^>]*>([\s\S]*?)<\/table\s*>/gi)){
  const headers=[...table[1].matchAll(/<th\b[^>]*>([\s\S]*?)<\/th\s*>/gi)].map(m=>plain(m[1]).toLowerCase());
  const indices=['service','sport','pick'].map(h=>headers.indexOf(h));
  if(indices.some(i=>i<0))continue;
  for(const row of table[1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr\s*>/gi)){
   const cells=[...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td\s*>/gi)].map(m=>plain(m[1]));
   if(cells.length<headers.length)continue;
   const [author,sport,pick]=indices.map(i=>cells[i]);
   if(!author||author.length>75||sport!==sourceSport||!pick||pick.length>160||!/[+-]\d{2,4}\b/.test(pick))continue;
   const id='boyds:summary:'+league+':'+author.toLowerCase()+':'+pick.toLowerCase();
   if(seen.has(id))continue;seen.add(id);
   picks.push({id,source:'boyds',author,league,pick,matchup:'Game matchup not provided in summary',
    eventLabel:'Daily summary only — verify matchup and kickoff',
    publishedLabel:'Site updated '+updated[0].replace(/^Last updated:\s*/i,'')+' (pick release unverified)',
    url:SUMMARY});
  }
 }
 return picks.slice(0,60);
}
module.exports={URLS,SUMMARY,parseSport,parseSummary};
