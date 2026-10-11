'use strict';
const {createHash}=require('node:crypto');
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
// A human-reviewed image transcription is valid only while the page still embeds
// the exact image and its bytes remain unchanged, for this upcoming matchup.
function createReviewedDepth(now=Date.now,fetchImage=async url=>{
 const r=await fetch(url,{signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error('Depth image unavailable.');
 return Buffer.from(await r.arrayBuffer());
},reviews=require('./depth-image-reviews.json')){
 const cache=new Map();
 return async(q,teamId,kickoff,url,html)=>{
  const matches=reviews.filter(r=>r.league===q.league&&r.season===q.season&&r.gameId===String(q.game)&&r.teamId===String(teamId)&&r.kickoff===kickoff&&r.url===url);
  if(matches.length!==1||!Number.isFinite(kickoff)||kickoff<=now()||kickoff>now()+7*86400000)throw Error('Reviewed image depth unavailable.');
  const review=matches[0],published=Date.parse(review.publishedDate+'T00:00:00Z'),reviewed=Date.parse(review.reviewedAt);
  if(!Number.isFinite(published)||published>now()||now()-published>7*86400000||!Number.isFinite(reviewed)||reviewed>now()||now()-reviewed>7*86400000)throw Error('Depth image review expired.');
  const images=[...String(html).matchAll(/<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi)].filter(m=>m[1]===review.imageUrl);
  if(images.length!==1)throw Error('Reviewed depth image was removed or changed.');
  if(!Array.isArray(review.rows)||!review.rows.length||review.rows.some(r=>!r.name||!['QB','RB','FB','WR','TE'].includes(r.position)||!Number.isInteger(r.rank)||r.rank<1||!r.slot)||new Set(review.rows.map(r=>r.slot+':'+r.rank)).size!==review.rows.length)throw Error('Depth image transcription invalid.');
  const key=review.imageUrl+':'+review.imageHash;let item=cache.get(key);
  if(!item||now()<item.at||now()-item.at>=3600000){
   item={at:now(),pending:fetchImage(review.imageUrl).then(bytes=>{if(digest(bytes)!==review.imageHash)throw Error('Reviewed depth image changed.');return {checkedAt:now()};})};
   cache.set(key,item);item.pending.catch(()=>{if(cache.get(key)===item)cache.delete(key);});
  }
  const source=await item.pending;
  return {rows:review.rows.map(r=>({...r})),checkedAt:source.checkedAt,imageUrl:review.imageUrl,publishedDate:review.publishedDate,reviewedImage:true};
 };
}
module.exports={createReviewedDepth,digest};
