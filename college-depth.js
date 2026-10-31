'use strict';
// Independent published depth order, not confirmation of game-day starters.
const {fbsName}=require('./team-identity');
const {matchPlayer,clean}=require('./player-name-match');
const {localEpoch}=require('./college-availability');
const root='https://www.ourlads.com/ncaa-football-depth-charts/';
const {normalize:position,compatible:compatiblePosition}=require('./public/football-position');
function directory(html,season){
 const entries=new Map();
 for(const m of html.matchAll(/class=['"]ncaa-tm-school['"][^>]*>([^<]+)<\/div>[\s\S]*?href=['"]depth-chart\.aspx\?s=([a-z0-9-]+)&(?:amp;)?id=(\d+)['"]/g)){
  const school=fbsName({name:clean(m[1])},season);if(!school)continue;
  const url=root+'depth-chart/'+m[2]+'/'+m[3];
  if(!entries.has(school))entries.set(school,new Set());entries.get(school).add(url);
 }
 return entries;
}
function parse(html,school,season,now){
 const title=/<title>([\s\S]*?)<\/title>/i.exec(html)?.[1];
 const city=/<span[^>]*id="ctl00_phContent_TeamCity"[^>]*>([^<]+)<\/span>/.exec(html)?.[1];
 if(!new RegExp('^'+season+' ').test(clean(title))||fbsName({name:clean(city)},season)!==school)throw Error('Depth team or season mismatch');
 const date=/id="ctl00_phContent_DateUpd"[^>]*>Updated:\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(AM|PM) ET/.exec(html);
 if(!date)throw Error('Depth publication time missing');
 const hour=Number(date[4])%12+(date[6]==='PM'?12:0);
 const publishedAt=localEpoch(`${date[3]}-${date[1].padStart(2,'0')}-${date[2].padStart(2,'0')}`,`${hour}:${date[5]}:00`,'ET');
 if(!Number.isFinite(publishedAt)||publishedAt>now||now-publishedAt>7*86400000)throw Error('Depth publication expired');
 const rows=[];let slot=0;
 for(const body of html.matchAll(/<tbody[^>]*id="ctl00_phContent_dcTBody\d*"[^>]*>([\s\S]*?)<\/tbody>/g)){
  for(const tr of body[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)){
   const cells=[...tr[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(m=>m[1]);
   if(cells.length<3||cells.length%2!==1)throw Error('Depth columns unrecognized');
   const label=clean(cells[0]),pos=position(label),slotId=label+':'+slot++;
   for(let i=2;i<cells.length;i+=2){
    const links=[...cells[i].matchAll(/<a[^>]*href=['"]https:\/\/www\.ourlads\.com\/ncaa-football-depth-charts\/player\/[^'"]+['"][^>]*>([\s\S]*?)<\/a>/g)].filter(m=>clean(m[1]));
    if(!links.length&&!clean(cells[i]))continue;
    if(links.length!==1)throw Error('Shared or unrecognized depth cell');
    const name=clean(links[0][1]);if(!name)continue;
    const parts=name.split(',');if(parts.length!==2||parts.some(p=>!p.trim()))throw Error('Depth name format changed');
    rows.push({name:parts[1].trim()+' '+parts[0].trim(),position:pos,rank:label==='RES'?null:i/2,slot:slotId,reserve:label==='RES'});
   }
  }
 }
 if(!rows.some(r=>r.position==='QB'&&r.rank===1)||!rows.some(r=>r.position==='CB'&&r.rank===1))throw Error('Depth coverage incomplete');
 return {rows,publishedAt};
}
function createCollegeDepth(now=Date.now,fetchPage=async url=>{const r=await fetch(url,{signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('Depth unavailable');const text=await r.text();if(text.length>2000000)throw Error('Depth response too large');return text;}){
 const cache=new Map();
 async function read(url){let item=cache.get(url);if(!item||now()-item.at>=3600000){item={at:now(),pending:fetchPage(url).then(html=>({html,checkedAt:now()}))};cache.set(url,item);item.pending.catch(()=>cache.delete(url));if(cache.size>160)cache.delete(cache.keys().next().value);}return item.pending;}
 return async(q,teams)=>{
  if(q.league!=='2')return;
  await Promise.all(teams.map(async t=>{
   t.depth={available:false,checkedAt:now(),rows:[],message:'Published college depth unavailable; role remains unverified.'};
   if(!t.official?.available||!t.official.teamName)return;
   try{
    const school=fbsName({name:t.official.teamName},q.season),index=await read(root+'default.aspx');
    const urls=directory(index.html,q.season).get(school);if(urls?.size!==1)throw Error('Depth school ambiguous');
    const url=[...urls][0],page=await read(url),parsed=parse(page.html,school,q.season,now()),rows=[],unresolved=[];
    for(const row of parsed.rows){const p=matchPlayer(row,t.roster?.rows||[],t.id,q);
     if(!p||(!row.reserve&&!compatiblePosition(p.position,row.position))){unresolved.push({...row,reason:'Provider identity or position unresolved.'});continue;}
     rows.push({...row,position:String(p.position).toUpperCase(),id:String(p.id)});
    }
    t.depth={available:true,checkedAt:Math.min(index.checkedAt,page.checkedAt),publishedAt:parsed.publishedAt,gameId:String(q.game),kickoff:t.official.kickoff,league:q.league,season:q.season,source:'Ourlads',url,rows,unresolved,message:'Ourlads published depth order; not a confirmed game-day lineup or replacement-quality estimate.'};
   }catch{}
  }));
 };
}
module.exports={directory,parse,createCollegeDepth};
