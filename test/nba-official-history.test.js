'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {expectation,findCard,parseGame,reconcile,createOfficialNBA}=require('../nba-official-history');
const espn=require('./fixtures/nba-20261029.json'),slate=require('./fixtures/nba-official-slate-20261029.json'),box=require('./fixtures/nba-official-20261029.json');
const e=expectation(espn),found=findCard(slate,e),report=()=>({...parseGame(box,found.card,e),source:found.url});
test('official NBA preserves zeros and separates bench DNP from inactive records',()=>{
 const r=report(),cle=r.teams.find(t=>t.id==='5');assert.equal(cle.players.filter(p=>p.participation==='played').length,10);assert.equal(cle.players.filter(p=>p.participation==='dnp').length,7);
 assert.equal(cle.players.find(p=>p.name==='Peyton Watson').values.player_threes,0);assert.equal(cle.players.find(p=>p.name==='Ernest Udeh, Jr.').participation,'dnp');assert.equal(cle.players.find(p=>p.name==="Nae'Qwan Tomlin").participation,'dnp');
});
test('official NBA rejects different identity, incomplete totals and contradictory DNP',()=>{
 for(const change of [g=>g.gameId='0022600001',g=>g.gameTimeUTC='2026-10-28T00:00:00Z',g=>g.awayTeam.score=112,g=>g.awayTeam.players[0].statistics.points++,g=>g.awayTeam.players[0].played='0',g=>g.awayTeam.players.push(g.awayTeam.players[0]),g=>g.awayTeam.players[0].statistics.minutes='PT01M00.00S']){const g=structuredClone(box);change(g);assert.throws(()=>parseGame(g,found.card,e));}
 const duplicate=structuredClone(slate);duplicate.gameCardFeed.modules[0].cards.push(duplicate.gameCardFeed.modules[0].cards.find(c=>c.cardData.gameId===box.gameId));assert.throws(()=>findCard(duplicate,e));
});
test('official history fills a known player missing from a prior box and retains zero markets',()=>{
 const p={id:'555',name:'Peyton Watson',available:true,results:[],inactive:[]},players=new Map([[p.id,p]]),games=[{id:e.id,tipoff:e.tipoff}],reports=new Map([[e.id,report()]]);
 assert.equal(reconcile(players,games,reports,'5').filled,1);assert.equal(p.results[0].player_threes,0);assert.equal(p.results[0].player_points,4);assert.equal(p.results[0].minutes,22+22/60);assert.equal(reconcile(players,games,reports,'5').filled,0);
});
test('official DNP adds an absence, conflicts with played stats, and does not merge ambiguous names',()=>{
 const p={id:'1',name:'Ernest Udeh Jr.',available:true,results:[],inactive:[]},players=new Map([[p.id,p]]),games=[{id:e.id,tipoff:e.tipoff}],reports=new Map([[e.id,report()]]);
 reconcile(players,games,reports,'5');assert.equal(p.inactive.length,1);assert.equal(p.results.length,0);
 p.inactive=[];p.results=[{gameId:e.id,tipoff:e.tipoff,minutes:1,player_points:0}];assert.equal(reconcile(players,games,reports,'5').conflicts,1);assert.equal(p.available,false);
 const r=report();r.teams[0].players.push({...r.teams[0].players.find(p=>p.name==='Ernest Udeh, Jr.')});p.results=[];p.available=true;assert.equal(reconcile(players,games,new Map([[e.id,r]]),'5').verified,0);
});
test('official NBA source follows the published box-score link and shares cached requests',async()=>{
 let count=0;const get=createOfficialNBA({now:()=>Date.parse('2026-10-31T00:00Z'),fetcher:async url=>{count++;return {ok:true,text:async()=>'<script id="__NEXT_DATA__">'+JSON.stringify({props:{pageProps:url.includes('/games?')?slate:{game:box}}})+'</script>'};}});
 const a=await get(espn),b=await get(espn);assert.equal(a.available,true);assert.deepEqual(a,b);assert.equal(count,2);
});
