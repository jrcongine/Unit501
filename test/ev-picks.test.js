'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {articleLinks,parseArticle,fetchEv,AUTHOR_URL}=require('../ev-picks');
const {text,createFeed}=require('../outside-picks');
const {build}=require('../public/pick-consensus');
const now=Date.parse('2026-10-16T19:00Z'),url='https://guybostonsports.com/nfl-test/';
const article=`<h1 class="entry-title">NFL Picks Week 6 2026</h1><a href="${AUTHOR_URL}" rel="author"><span>Ev Singleton</span></a><meta property="article:published_time" content="2026-10-16T13:00:00Z"><h2 class="wp-block-heading">Plays:</h2><ul><li>Example Over 20.5 Rec Yards (0.5 units, -110 Book)</li><li>Other ML (-110)✅</li><li>✅ = Win | ❌ = Loss | 🅿️ = Push/Void</li></ul><ul><li>Advertiser Over 9.5</li></ul>`;
const index=`<h2 class="entry-title"><a href="${url}">NFL picks</a></h2>`;
test('reads only Ev authored recent written Plays, excludes grades and unrelated lists',()=>{
 const picks=parseArticle(article,url,'nfl',now,text);assert.equal(picks.length,1);assert.match(picks[0].pick,/0.5 units, -110/);assert.equal(picks[0].requiresReview,true);assert.equal(build([{name:'EV',picks,checkedAt:new Date(now).toISOString()}]).groups.length,0);
 for(const html of [article.replace('Ev Singleton','Tasos'),article.replace('2026-10-16T13','2026-10-01T13'),article.replace('2026-10-16T13','2026-10-17T13'),article.replace('Plays:','Video:')])assert.deepEqual(parseArticle(html,url,'nfl',now,text),[]);
 assert.deepEqual(parseArticle(article,url,'ncaaf',now,text),[]);
});
test('discovery is bounded, league-specific and restricted to same-origin article links',()=>{
 const extra=index.replace(url,'https://evil.test/nfl/')+index.replace('NFL picks','MLB picks');
 assert.deepEqual(articleLinks(index+extra,'nfl',text),[url]);assert.deepEqual(articleLinks(index,'ncaaf',text),[]);
});
test('article failures preserve other results and remain explicit',async()=>{
 const result=await fetchEv('nfl',async u=>{if(u===AUTHOR_URL)return index;throw Error('offline');},null,now,text);
 assert.equal(result.status,'unavailable');assert.deepEqual(result.picks,[]);assert.match(result.message,/could not/);
});
test('actual feed fetches and caches Ev index and article and refreshes later posts',async()=>{
 let clock=now,calls=0,graded=false;
 const feed=createFeed({now:()=>clock,fetcher:async u=>{calls++;return new Response(u===AUTHOR_URL?index:u===url?(graded?article.replace('Book)','Book)✅'):article):'');}});
 let r=await feed('nfl');assert.equal(r.sources.find(s=>s.source==='ev').picks.length,1);assert.equal(calls,4);
 await feed('nfl');assert.equal(calls,4);clock+=300001;graded=true;r=await feed('nfl');assert.equal(r.sources.find(s=>s.source==='ev').picks.length,0);assert.equal(calls,8);
});
