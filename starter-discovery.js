'use strict';
const {readArticles,digest}=require('./starter-sources');
const clean=value=>String(value||'').replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/&#39;|&apos;/g,"'").replace(/&quot;/g,'"').replace(/\s+/g,' ').trim();
const normalize=value=>clean(value).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const contains=(body,phrase)=>(' '+normalize(body)+' ').includes(' '+normalize(phrase)+' ');
function newsLinks(html,indexUrl,qbs){
 const links=new Map();
 for(const m of String(html).matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)){
  let url;try{url=new URL(m[1],indexUrl);}catch{continue;}
  if(url.origin!==new URL(indexUrl).origin||!/^\/news\/[^/]+$/.test(url.pathname)||url.search||url.hash)continue;
  const title=clean(m[2]);
  if(!title||title.length>600||!(/\bqb\b|quarterback|starter|\bqb1\b/i.test(title)||qbs.some(p=>contains(title,p.name)||contains(title,p.name.split(' ').at(-1)))))continue;
  if(!links.has(url.href))links.set(url.href,{url:url.href,title});
 }
 return [...links.values()].slice(0,3);
}
function createStarterDiscovery(now,fetchPage){
 const cache=new Map();
 const read=async url=>{
  let item=cache.get(url);
  if(!item||now()<item.at||now()-item.at>=900000){
   item={at:now(),pending:fetchPage(url).then(html=>({html,checkedAt:now()}))};cache.set(url,item);
   if(cache.size>200)cache.delete(cache.keys().next().value);
   item.pending.catch(()=>{if(cache.get(url)===item)cache.delete(url);});
  }
  return item.pending;
 };
 return async(indexUrl,roster,opponent,kickoff)=>{
  const unknown=message=>({available:false,url:indexUrl,rows:[],message});
  if(!indexUrl||!Number.isFinite(kickoff)||kickoff<=now()||kickoff>now()+7*86400000||!roster?.available||!Number.isFinite(roster.checkedAt)||roster.checkedAt>now()||now()-roster.checkedAt>3600000)return unknown('Starter article discovery needs a fresh roster and upcoming matchup within seven days.');
  const qbs=(roster.rows||[]).filter(p=>p.position==='QB'&&p.id&&p.name&&(roster.rows||[]).filter(r=>normalize(r.name)===normalize(p.name)).length===1);
  if(!qbs.length)return unknown('No uniquely matched roster quarterbacks available for article discovery.');
  try{
   const index=await read(indexUrl),links=newsLinks(index.html,indexUrl,qbs),rows=[];let failed=0,checkedAt=index.checkedAt;
   const results=await Promise.allSettled(links.map(async link=>({link,page:await read(link.url)})));
   for(const result of results){
    if(result.status!=='fulfilled'){failed++;continue;}
    const {link,page}=result.value;checkedAt=Math.min(checkedAt,page.checkedAt);
    const articles=readArticles(page.html,link.url);if(articles.length!==1)continue;
    const a=articles[0],published=Date.parse(a.datePublished),modified=Date.parse(a.dateModified);
    if(!Number.isFinite(published)||published>now()||now()-published>7*86400000||!Number.isFinite(modified)||modified<published||modified>now()||typeof a.articleBody!=='string'||!contains(a.articleBody+' '+(a.description||''),opponent)||!(/\bstart(?:er|ing)?\b|\bqb1\b/i.test(clean(a.articleBody))))continue;
    const players=qbs.filter(p=>contains(a.articleBody,p.name));if(!players.length)continue;
    rows.push({url:link.url,title:clean(a.headline)||link.title,publishedAt:a.datePublished,modifiedAt:a.dateModified,bodyHash:digest(a.articleBody),players:players.map(p=>({id:p.id,name:p.name})),state:'unreviewed'});
   }
   return {available:true,url:indexUrl,checkedAt,rows,failed,message:'Possible starter articles from the official team news page — unreviewed. Up to three relevant articles are checked per refresh; coverage is incomplete. These links do not confirm starters or change projections.'};
  }catch{return unknown('Official team news page unavailable; new starter article discovery is incomplete.');}
 };
}
module.exports={newsLinks,createStarterDiscovery};
