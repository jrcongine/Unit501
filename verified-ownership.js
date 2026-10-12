'use strict';
const {clean,key}=require('./player-name-match');
const reviews=[
 {id:'1836',name:'Noah Igbinoghene',position:'CB',destination:'Cleveland Browns'},
 {id:'2733',name:'Cody White',position:'WR',destination:'Las Vegas Raiders'},
 {id:'10639',name:'Avery Smith',position:'CB',destination:'Seattle Seahawks'},
 {id:'17010',name:'Jared Ivey',position:'LB',destination:'Atlanta Falcons'}
];
function parseRoster(html){
 const rows=[];
 for(const table of String(html).matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)){
  const headers=[...table[1].matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/gi)].map(m=>clean(m[1]));
  if(headers[0]!=='Player'||headers[1]!=='#'||headers[2]!=='Pos')continue;
  for(const tr of table[1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)){
   const c=[...tr[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(m=>clean(m[1]));
   if(c.length>=3)rows.push({name:c[0],position:c[2]});
  }
 }
 if(rows.length<40)throw Error('Official roster incomplete');
 return rows;
}
function createVerifiedOwnership(now=Date.now,fetchPage=async url=>{
 const r=await fetch(url,{signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error();return r.text();
}){
 const cache=new Map();
 async function roster(name){
  const domain=require('./depth-charts').domains[name];if(!domain)throw Error();
  const url='https://www.'+domain+'/team/players-roster/';
  let item=cache.get(url);
  if(!item||now()<item.at||now()-item.at>=3600000){
   item={at:now(),pending:fetchPage(url).then(html=>({rows:parseRoster(html),url,checkedAt:now()}))};cache.set(url,item);
   item.pending.catch(()=>{if(cache.get(url)===item)cache.delete(url);});
  }
  return item.pending;
 }
 return async(q,conflicts,reports,teamNames)=>{
  // Reviewed identity scope expires; new seasons or changed identities need review.
  const reviewedAt=Date.parse('2026-10-12T01:50:00Z');
  if(q.league!=='1'||q.season!=='2026'||now()<reviewedAt||now()-reviewedAt>7*86400000)return [];
  const resolutions=[];
  for(const review of reviews){
   const conflict=conflicts.find(c=>c.id===review.id);if(!conflict)continue;
   try{
    const checks=[];
    for(const teamId of conflict.teamIds){
     const rows=reports.find(t=>t.id===teamId)?.rows||[];
     const identity=rows.filter(p=>String(p.id)===review.id||key(p.name)===key(review.name));
     if(identity.length!==1||String(identity[0].id)!==review.id||key(identity[0].name)!==key(review.name)||identity[0].position!==review.position)throw Error();
     const name=teamNames.get(teamId),official=await roster(name);
     const matches=official.rows.filter(p=>key(p.name)===key(review.name));
     checks.push({teamId,name,official,matches});
    }
    const present=checks.filter(c=>c.matches.length);
    if(present.length!==1||present[0].matches.length!==1||present[0].matches[0].position!==review.position||present[0].name!==review.destination)continue;
    resolutions.push({id:review.id,name:review.name,position:review.position,teamId:present[0].teamId,teamIds:conflict.teamIds,destination:review.destination,reviewedAt,checkedAt:Math.min(...checks.map(c=>c.official.checkedAt)),sources:checks.map(c=>({teamId:c.teamId,url:c.official.url}))});
   }catch{/* Failed, partial or changed sources retain the original conflict. */}
  }
  return resolutions;
 };
}
module.exports={createVerifiedOwnership,parseRoster};
