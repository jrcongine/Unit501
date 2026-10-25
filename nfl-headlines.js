'use strict';
// Linked, attributed publisher headlines only. No article bodies, images, scraped excerpts,
// auto-verification of player injury status, or changes to UNIT 501 predictions.
// Use only the publisher's dedicated NFL RSS feed; if the feed blocks access, fail closed.
const FEED='https://www.espn.com/espn/rss/nfl/news';
const MORE='https://www.espn.com/nfl/';
function decode(value){
 return String(value||'').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1')
 .replace(/&(#x[0-9a-f]+|#[0-9]+|amp|lt|gt|quot|apos|nbsp);/gi,(match,entity)=>{
  const known={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '};
  if(entity[0]==='#'){
   const n=entity[1]?.toLowerCase()==='x'?parseInt(entity.slice(2),16):parseInt(entity.slice(1),10);
   return n>0&&n<=0x10ffff&&! (n>=0xd800&&n<=0xdfff)?String.fromCodePoint(n):'';
  }
  return known[entity.toLowerCase()]??match;
 }).replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim();
}
function field(item,name){
 const matched=item.match(new RegExp('<'+name+'(?:\\s[^>]*)?>([\\s\\S]*?)<\\/'+name+'>','i'));
 return matched?decode(matched[1]):'';
}
function newsCategory(title){
 if(/\b(injur|hurt|ankle|knee|concussion|questionable|out for|ruled out|surgery|hamstring|acl|mcl)\w*/i.test(title))
  return 'Injury headline';
 if(/\b(coach|fired|hot seat|staff|coordinator|mccarthy)\b/i.test(title))
  return 'Coaching';
 if(/\b(trad(e|ed|es)|deal|sign|contract|release|free agent)\b/i.test(title))
  return 'Roster move';
 return 'League news';
}
function parseFeed(xml,now){
 if(typeof xml!=='string'||xml.length<80||xml.length>1600000||
   !/<rss[\s>]/i.test(xml)||!/<channel[\s>]/i.test(xml))return null;
 const items=[],used=new Set();
 for(const match of xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)){
  const raw=match[1];
  const title=field(raw,'title'),link=field(raw,'link'),published=Date.parse(field(raw,'pubDate'));
  if(!title||title.length>230||title.length<6||!Number.isFinite(published)||
    published>now+300000||now-published>7*86400000)continue;
  let uri;
  try{
   uri=new URL(link);
   if(uri.protocol!=='https:'||!(uri.hostname==='espn.com'||uri.hostname.endsWith('.espn.com')))
     continue;
  }catch{continue;}
  if(used.has(uri.href))continue;
  used.add(uri.href);
  items.push({title,url:uri.href,source:'ESPN',category:newsCategory(title),
    publishedAt:new Date(published).toISOString()});
 }
 return items.sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt)).slice(0,8);
}
function createNFLHeadlines(opts={}){
 const now=opts.now||Date.now,ttl=opts.ttlMs??20*60000,request=opts.request||(
  async()=>{
   const response=await fetch(FEED,{signal:AbortSignal.timeout(10000),
     headers:{Accept:'application/rss+xml, application/xml, text/xml'}});
   if(!response.ok)throw Error('Publisher headline feed unavailable: HTTP '+response.status);
   return response.text();
  }
 );
 let cached=null,pending=null;
 return async function getNFLHeadlines(){
  const stamp=now();
  if(cached&&stamp-cached.at<ttl)return cached.data;
  if(pending)return pending;
  const job=Promise.resolve().then(async()=>{
   const items=parseFeed(await request(),now());
   if(!items)throw Error('Publisher feed format was not valid.');
   return {available:items.length>0,source:'ESPN',sourceUrl:MORE,
     checkedAt:new Date(now()).toISOString(),items,
     message:items.length?'Linked publisher headlines; headlines are not verified roster or injury statuses.':
       'No recent ESPN NFL headlines were available. Open the source for the latest news.'};
  }).catch(()=>({available:false,source:'ESPN',sourceUrl:MORE,
    checkedAt:new Date(now()).toISOString(),items:[],
    message:'NFL headline feed is temporarily unavailable. Open ESPN for the latest news.'}));
  pending=job;
  try{
   const data=await job;
   cached={at:now(),data};
   return data;
  }finally{if(pending===job)pending=null;}
 };
}
module.exports={createNFLHeadlines,parseFeed,decode,newsCategory};
