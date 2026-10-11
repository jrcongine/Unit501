'use strict';
const {createHash}=require('node:crypto');
const digest=body=>createHash('sha256').update(body).digest('hex');
function readArticles(html,url){
 const articles=[];
 const visit=value=>{
  if(Array.isArray(value)){value.forEach(visit);return;}
  if(!value||typeof value!=='object')return;
  if(['NewsArticle','Article'].includes(value['@type'])&&value.url===url)articles.push(value);
  if(value['@graph'])visit(value['@graph']);
 };
 for(const script of String(html).matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){
  try{visit(JSON.parse(script[1]));}catch{}
 }
 return articles;
}
function verifySource(html,review,now){
 const articles=readArticles(html,review.url);
 if(articles.length!==1)throw Error('Reviewed article identity unavailable or ambiguous.');
 const article=articles[0],published=Date.parse(article.datePublished),modified=Date.parse(article.dateModified);
 if(!Number.isFinite(published)||published>now||published!==Date.parse(review.publishedAt)||!Number.isFinite(modified)||modified>now||modified<published||modified!==Date.parse(review.reviewedModifiedAt)||typeof article.articleBody!=='string'||!article.articleBody||digest(article.articleBody)!==review.reviewedBodyHash)
  throw Error('Reviewed article changed or publication metadata could not be verified.');
 return {checkedAt:now,publishedAt:article.datePublished,modifiedAt:article.dateModified};
}
function createStarterVerifier(now,fetchPage){
 const cache=new Map();
 return async review=>{
  const identity=JSON.stringify([review.url,review.publishedAt,review.reviewedModifiedAt,review.reviewedBodyHash]);
  let item=cache.get(identity);
  if(!item||now()<item.at||now()-item.at>=900000){
   item={at:now(),pending:fetchPage(review.url).then(html=>verifySource(html,review,now()))};
   cache.set(identity,item);item.pending.catch(()=>{if(cache.get(identity)===item)cache.delete(identity);});
  }
  return item.pending;
 };
}
module.exports={verifySource,createStarterVerifier,digest,readArticles};
