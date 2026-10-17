'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {parse,links}=require('../article-picks');
const now=Date.parse('2026-10-17T14:00Z'),url='https://www.sportsbettingdime.com/news/nfl/test-picks/';
const article='<meta name="author" content="Writer"><script>{"datePublished":"2026-10-17T11:00:00Z"}</script><table><thead><tr><th>Matchup</th><th>Best Bet</th><th>Price / Source</th></tr></thead><tbody><tr><td>A at B</td><td>A +3</td><td>-110 / Book</td></tr></tbody></table>';
test('article feed requires named, recent explicit picks and keeps original line/source',()=>{
 const p=parse(article,'nfl',url,now);assert.equal(p.length,1);assert.equal(p[0].pick,'A +3 (-110 / Book)');assert.equal(p[0].author,'Writer');assert.equal(p[0].url,url);
 assert.equal(parse(article.replace('Best Bet','Market Odds'),'nfl',url,now).length,0);
 assert.equal(parse(article,'nfl',url,now+37*3600000).length,0);
 assert.equal(parse(article,'nfl',url,now-4*3600000).length,0);
 assert.equal(parse(article.replace('content="Writer"','content=""'),'nfl',url,now).length,0);
});
test('discovery only follows bounded first-party article links for requested league',()=>{
 assert.deepEqual(links(`<a href="${url}">Pick</a><a href="${url}">Duplicate</a><a href="https://evil.test/news/nfl/pick/">Other</a><a href="https://www.sportsbettingdime.com/news/nfl/feed/">Feed</a>`,'nfl'),[url]);
 assert.deepEqual(links(`<a href="${url}">Wrong league</a>`,'ncaaf'),[]);
});
