'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {verifySource,createStarterVerifier,digest}=require('../starter-sources');
const now=Date.parse('2026-10-10T20:00:00Z');
const review={url:'https://www.commanders.com/news/example',publishedAt:'2026-10-09T16:00:00Z',reviewedModifiedAt:'2026-10-09T17:00:00Z',reviewedBodyHash:digest('Reviewed test body')};
const article={'@type':'NewsArticle',url:review.url,datePublished:review.publishedAt,dateModified:review.reviewedModifiedAt,articleBody:'Reviewed test body'};
const page=data=>'<script type="application/ld+json">'+JSON.stringify(data)+'</script>';
test('only uniquely identified, unchanged reviewed articles verify; navigation text cannot confirm a starter',()=>{
 assert.equal(verifySource(page(article),review,now).checkedAt,now);
 for(const changed of [{articleBody:'Updated test body'},{dateModified:'2026-10-10T19:00:00Z'},{datePublished:'2026-10-08T16:00:00Z'},{url:review.url+'-other'},{dateModified:'bad'},{dateModified:'2026-10-11T17:00:00Z'}])assert.throws(()=>verifySource(page({...article,...changed}),review,now));
 assert.throws(()=>verifySource('Reviewed test body',review,now));
 assert.throws(()=>verifySource(page([article,article]),review,now));
 assert.equal(verifySource(page({'@graph':[article]}),review,now).checkedAt,now);
});
test('source checks share requests, retain actual check time, withdraw edits after 15 minutes and recover after review',async()=>{
 let clock=now,calls=0,body=article;
 const check=createStarterVerifier(()=>clock,async()=>{calls++;return page(body);});
 const results=await Promise.all([check(review),check(review)]);assert.equal(calls,1);
 clock+=899999;assert.equal((await check(review)).checkedAt,results[0].checkedAt);assert.equal(calls,1);
 clock++;body={...article,articleBody:'Updated test body'};await assert.rejects(check(review));assert.equal(calls,2);
 await assert.rejects(check(review));assert.equal(calls,3);
 const revised={...review,reviewedBodyHash:digest(body.articleBody)};
 assert.equal((await check(revised)).checkedAt,clock);assert.equal(calls,4);
});
test('network failure cannot retain an expired confirmation',async()=>{
 let clock=now,fail=false;
 const check=createStarterVerifier(()=>clock,async()=>{if(fail)throw Error('offline');return page(article);});
 await check(review);clock+=900000;fail=true;await assert.rejects(check(review));
 fail=false;assert.equal((await check(review)).checkedAt,clock);
});
