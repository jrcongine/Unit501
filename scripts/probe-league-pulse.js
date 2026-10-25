'use strict';
const leagues={
 nfl:['football','nfl',2026,'nfl'],
 ncaaf:['football','college-football',2026,'college-football'],
 nba:['basketball','nba',2027,'nba'],
 mlb:['baseball','mlb',2026,'mlb'],
 nhl:['hockey','nhl',2027,'nhl']
};
async function get(url){
 try{
  const r=await fetch(url,{headers:{'User-Agent':'Unit501-Sports-Pulse-Diagnostics/1.0','Accept':'application/json, application/rss+xml, application/xml;q=0.9'},signal:AbortSignal.timeout(12000)});
  let str=await r.text();
  if(!r.ok)return {status:r.status,url};
  if(str.trim().startsWith('<')){
   return {status:r.status,url,kind:'xml',bytes:str.length,items:(str.match(/<item>/gi)||[]).length,firstTitle:str.match(/<item>[\s\S]{0,1200}?<title>([\s\S]*?)<\/title>/i)?.[1]?.slice(0,130)};
  }
  let j=JSON.parse(str);
  const schema={status:r.status,url,kind:'json',bytes:str.length,
   keys:Object.keys(j).slice(0,20),children:j.children?.length,standings:j.standings?.entries?.length,
   articles:j.articles?.length,teams:j.sports?.[0]?.leagues?.[0]?.teams?.length};
  function findEntries(obj,prefix='',depth=0){
   if(depth>6||!obj||typeof obj!=='object')return;
   if(Array.isArray(obj)){
    if(obj.length&&obj[0]?.stats&&obj[0]?.team&&!(schema.example)){
     schema.example={path:prefix,keys:Object.keys(obj[0]).slice(0,12),
      team:obj[0].team?.displayName||obj[0].team?.name,
      stats:(obj[0].stats||[]).map(s=>({name:s.name,value:s.value,displayValue:s.displayValue})).slice(0,35)};
    }
    for(let i=0;i<Math.min(obj.length,2);i++)findEntries(obj[i],prefix+'['+i+']',depth+1);
   }else for(let [k,v]of Object.entries(obj).slice(0,18))findEntries(v,prefix+'.'+k,depth+1);
  }
  findEntries(j);
  if(j.articles?.length)schema.articleExample={keys:Object.keys(j.articles[0]),headline:j.articles[0].headline,links:j.articles[0].links?.web?.href,published:j.articles[0].published};
  return schema;
 }catch(e){return {url,error:String(e.message).slice(0,160)}}
}
(async()=>{
 for(let [league,[sport,code,year,rss]] of Object.entries(leagues)){
  const urls=[
   'https://site.web.api.espn.com/apis/v2/sports/'+sport+'/'+code+'/standings?season='+year,
   'https://site.api.espn.com/apis/site/v2/sports/'+sport+'/'+code+'/standings?season='+year,
   'https://site.api.espn.com/apis/site/v2/sports/'+sport+'/'+code+'/news?limit=6',
   'https://www.espn.com/espn/rss/'+(league==='ncaaf'?'ncf':rss)+'/news',
   'https://www.cbssports.com/rss/headlines/'+rss+'/'
  ];
  const results=await Promise.all(urls.map(get));
  for(let i=0;i<results.length;i++)console.log('PULSE PROBE',league,i,JSON.stringify(results[i]));
 }
  // Diagnose FBS inclusion and stat completeness without printing entire provider payloads.
  const fbs=require('../fbs-2026.json');
  const normalize=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
  const alias=new Map(fbs.teams.flatMap(t=>t.aliases.map(a=>[normalize(a),t.name])));
  const raw=await (await fetch('https://site.web.api.espn.com/apis/v2/sports/football/college-football/standings?season=2026&level=2')).json();
  const entries=[];
  function dig(n){if(n?.standings?.entries)entries.push(...n.standings.entries);for(const x of n?.children||[])dig(x)}
  dig(raw);
  const valid=[],invalid=[],skipped=[];
  for(const e of entries){
    const name=e.team?.displayName||e.team?.name,canon=alias.get(normalize(name));
    if(!canon){skipped.push(name);continue;}
    const stats=e.stats||[],get=k=>stats.find(x=>x.name===k)?.value;
    const w=get('wins'),l=get('losses'),f=get('pointsFor'),a=get('pointsAgainst'),diff=get('pointDifferential');
    const missing=(!Number.isInteger(w)||!Number.isInteger(l)||!Number.isFinite(f)||!Number.isFinite(a)||!Number.isFinite(diff)||Math.abs(f-a-diff)>1.001);
    if(missing)invalid.push({name,canon,w,l,f,a,diff});else valid.push({name,canon,w,l,f,a,diff,id:e.team.id});
  }
  const present=new Set(valid.map(x=>x.canon)),missing=fbs.teams.map(x=>x.name).filter(x=>!present.has(x));
  console.log('PULSE FBS',JSON.stringify({expected:fbs.teams.length,entries:entries.length,
    matches:valid.length,uniqueMatched:present.size,missed:missing,invalid:invalid.slice(0,25),
    skipped:skipped.length,skippedSample:skipped.slice(0,14)}));
  const app=require('../league-pulse').createLeaguePulse();
  for(const league of Object.keys(leagues)){
    const result=await app(league);
    console.log('PULSE LIVE',league,JSON.stringify({count:result.power?.teams?.length||0,
      message:result.power?.message||null,headlines:result.headlines.items.length,
      sample:result.power?.teams?.[0]||null}));
  }
})().catch(e=>{console.error('Probe failed',e.message);process.exitCode=1});
