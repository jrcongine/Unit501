'use strict';
// Verified South Alabama Sidearm receiving tables. No inferred zeros or paid API calls.
const {clean,key}=require('./player-name-match');
const {fbsName}=require('./team-identity');
const origin='https://usajaguars.com';
const school=name=>fbsName({name},'2026');
const rows=html=>[...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(m=>m[1]);
function gameLink(html,date,opponent){
 const label=date.slice(5,7)+'/'+date.slice(8,10)+'/'+date.slice(0,4);
 const matches=[];
 for(const row of rows(html)){
  const cells=[...row.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(m=>clean(m[1]));
  if(cells[0]!==label||!['W','L','T'].includes(cells[2]))continue;
  for(const a of row.matchAll(/<a\b[^>]*href=['"]([^'"]+)['"][^>]*>([\s\S]*?)<\/a>/gi)){
   if(school(clean(a[2]))!==opponent)continue;
   const url=new URL(a[1].replace(/&amp;/g,'&'),origin);
   if(url.origin===origin&&url.pathname==='/boxscore.aspx'&&/^\d+$/.test(url.searchParams.get('id')||'')&&url.searchParams.get('path')==='football')matches.push(url.href);
  }
 }
 const unique=[...new Set(matches)];return unique.length===1?unique[0]:null;
}
function parseReceiving(html,date,opponent){
 const label=date.slice(5,7)+'/'+date.slice(8,10)+'/'+date.slice(0,4);
 if(!new RegExp('<dt[^>]*>\\s*Date:\\s*</dt>\\s*<dd[^>]*>\\s*'+label+'\\s*</dd>','i').test(html))return null;
 const heading=/<h4\b[^>]*class=['"][^'"]*main-heading[^'"]*['"][^>]*>([\s\S]*?)<\/h4>/i.exec(html);
 const teams=heading?clean(heading[1]).replace(/\([^)]*\)/g,'').split(/-VS-/i).map(s=>school(s.trim())):[];
 if(teams.length!==2||!teams.includes('South Alabama')||!teams.includes(opponent)||opponent==='South Alabama')return null;
 const tables=[...html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)].filter(m=>/<caption>\s*USA - Receiving\s*<\/caption>/i.test(m[1]));
 if(tables.length!==1)return null;
 const body=/<tbody[^>]*>([\s\S]*?)<\/tbody>/i.exec(tables[0][1]);
 const foot=/<tfoot[^>]*>([\s\S]*?)<\/tfoot>/i.exec(tables[0][1]);
 if(!body||!foot)return null;
 function stat(row,label){const m=new RegExp('<td\\b[^>]*data-label=[\'"]'+label+'\\.?[\'"][^>]*>([\\s\\S]*?)</td>','i').exec(row);const v=m?clean(m[1]):'';return /^-?\d+$/.test(v)?Number(v):null;}
 const out=[];
 for(const row of rows(body[1])){
  const link=/<a\b[^>]*href=['"]\/sports\/football\/roster\/[^'"]+['"][^>]*>([\s\S]*?)<\/a>/i.exec(row);
  if(!link)return null;
  const parts=clean(link[1]).split(',');if(parts.length!==2)return null;
  const name=parts[1].trim()+' '+parts[0].trim(),rec=stat(row,'Rec'),recYds=stat(row,'Yds'),recTD=stat(row,'TD');
  if(rec===null||rec<0||recYds===null||recTD===null||recTD<0)return null;
  out.push({name,rec,recYds,recTD});
 }
 if(!out.length||new Set(out.map(r=>key(r.name))).size!==out.length)return null;
 for(const [metric,label]of [['rec','Rec'],['recYds','Yds'],['recTD','TD']]){
  const total=stat(foot[1],label);if(total===null||out.reduce((n,r)=>n+r[metric],0)!==total)return null;
 }
 return out;
}
function createRecovery(fetcher=fetch){
 const cache=new Map();
 async function read(url){
  const hit=cache.get(url);if(hit&&hit.until>Date.now())return hit.promise;
  const promise=(async()=>{const r=await fetcher(url,{signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error('Official box score unavailable');if(r.url&&new URL(r.url).origin!==origin)throw Error('Unexpected official source');const s=await r.text();if(s.length>2500000)throw Error('Official response too large');return s;})();
  if(cache.size>=100)cache.delete(cache.keys().next().value);
  cache.set(url,{promise,until:Date.now()+15*60*1000});return promise;
 }
 return async function recover(q){
  if(q.season!=='2026'||school(q.team)!=='South Alabama')return {status:'unsupported',rows:[]};
  const opponent=school(q.opponent);
  if(!opponent||!/^2026-\d{2}-\d{2}$/.test(q.date||'')||opponent==='South Alabama')return {status:'unmatched',rows:[]};
  try{
   const url=gameLink(await read(origin+'/sports/football/stats/2026'),q.date,opponent);
   if(!url)return {status:'unmatched',rows:[]};
   const result=parseReceiving(await read(url),q.date,opponent);
   if(!result)return {status:'unverified',rows:[]};
   return {status:'verified',team:'South Alabama',opponent,date:q.date,source:url,rows:result};
  }catch{return {status:'unavailable',rows:[]};}
 };
}
module.exports={gameLink,parseReceiving,createRecovery};
