'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {newsLinks,createStarterDiscovery}=require('../starter-discovery');
const now=Date.parse('2026-10-10T20:00:00Z'),index='https://www.commanders.com/news/',kickoff=now+86400000;
const roster={available:true,checkedAt:now,rows:[{id:'1',name:'Jayden Daniels',position:'QB'}]};
const article={'@type':'NewsArticle',url:index+'daniels-giants',headline:'Daniels will start vs. Giants',datePublished:'2026-10-09T16:00:00Z',dateModified:'2026-10-09T17:00:00Z',articleBody:'Jayden Daniels will start against the Giants.'};
const page=a=>'<script type="application/ld+json">'+JSON.stringify(a)+'</script>';
const link='<a href="/news/daniels-giants">Jayden Daniels returns as starter</a>';
test('discovery stays on official news articles, deduplicates links and bounds fetches',()=>{
 const html=link+link+'<a href="https://evil.example/news/qb">QB starter</a><a href="/news/author/person">QB</a><a href="/news/unrelated">Community day</a>'+Array.from({length:6},(_,i)=>`<a href="/news/qb-${i}">QB announcement</a>`).join('');
 const rows=newsLinks(html,index,roster.rows);assert.equal(rows.length,3);assert.equal(rows[0].url,article.url);assert.ok(rows.every(r=>r.url.startsWith(index)));
});
test('matching fresh article becomes an unreviewed candidate without mutating roster or confirming starter',async()=>{
 let calls=0;const read=createStarterDiscovery(()=>now,async url=>{calls++;return url===index?link:page(article);});
 const original=structuredClone(roster),r=await read(index,roster,'Giants',kickoff);
 assert.equal(r.available,true);assert.equal(r.rows[0].state,'unreviewed');assert.equal(r.rows[0].players[0].id,'1');assert.deepEqual(roster,original);
 await read(index,roster,'Giants',kickoff);assert.equal(calls,2);
 assert.equal((await read(index,roster,'Lions',kickoff)).rows.length,0);
 assert.equal((await read(index,{...roster,checkedAt:now-3600001},'Giants',kickoff)).available,false);
});
test('old, future, wrong-identity and unrelated articles are excluded; failed fetches stay partial',async()=>{
 for(const changes of [{datePublished:'2026-09-01T16:00:00Z'},{datePublished:'2026-10-11T16:00:00Z'},{dateModified:'bad'},{url:index+'another'},{articleBody:'A different quarterback will start against the Giants.'},{articleBody:'Jayden Daniels will start against the Lions.'}]){
  const read=createStarterDiscovery(()=>now,async url=>url===index?link:page({...article,...changes}));
  assert.equal((await read(index,roster,'Giants',kickoff)).rows.length,0);
 }
 const read=createStarterDiscovery(()=>now,async url=>{if(url===index)return link;throw Error('offline');});
 const r=await read(index,roster,'Giants',kickoff);assert.equal(r.failed,1);assert.equal(r.rows.length,0);
 const unavailable=createStarterDiscovery(()=>now,async()=>{throw Error('offline');});assert.equal((await unavailable(index,roster,'Giants',kickoff)).available,false);
});

test('an article subtitle can supply matchup context while QB identity and role still require the body',async()=>{
 const a={...article,description:'Upcoming game against Giants',articleBody:'Jayden Daniels remains QB1.'};
 const read=createStarterDiscovery(()=>now,async url=>url===index?link:page(a));
 assert.equal((await read(index,roster,'Giants',kickoff)).rows.length,1);
 assert.equal((await read(index,roster,'Lions',kickoff)).rows.length,0);
});
