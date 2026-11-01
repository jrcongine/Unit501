'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {parseBox}=require('../football-participation'),{parse}=require('../football-gamebook'),{createDiscovery,gamebookLinks}=require('../football-official-discovery');
const {seedRoster,applyParticipation}=require('../public/player-stats'),{project}=require('../public/player-form');
const summaries=require('./fixtures/eagles-2026-offense.json');
const official=Array.from({length:7},(_,i)=>require('./fixtures/eagles-official-week'+(i+1)+'.json'));
const pages=f=>f.pages.map(p=>({width:p.width,items:p.rows.map(([str,x,y])=>({str,transform:[0,0,0,0,x,y]}))}));
function game(data,i){const c=data.header.competitions[0],g={game:{date:{timestamp:Date.parse(c.date)/1000}},teams:{},scores:{}};for(const t of c.competitors){g.teams[t.homeAway]={id:t.team.displayName==='Philadelphia Eagles'?99:Number(t.team.id)+1000,name:t.team.displayName};g.scores[t.homeAway]={total:Number(t.score)};}return {g,q:{game:String(100+i),league:'1',season:'2026'}};}
test('all seven official Eagles gamebooks recover the correct played and DNP denominators for quoted markets',()=>{
 const calendar=new Map(),reports=[];
 for(const [i,d]of summaries.entries()){const {g,q}=game(d,i),side=g.teams.home.id===99?'home':'away',other=side==='home'?'away':'home';calendar.set(q.game,{date:g.game.date.timestamp,teams:new Map([['99',{name:g.teams[other].name,id:String(g.teams[other].id),scored:g.scores[side].total,allowed:g.scores[other].total}]])});reports.push({full:parseBox(d,d.header,g,q),official:{available:true,...q,gameId:q.game,gameDate:g.game.date.timestamp,source:official[i].source.url,teams:parse(pages(official[i]),official[i].source).map((t,j)=>({...t,id:String(g.teams[j?'home':'away'].id),scored:g.scores[j?'home':'away'].total,allowed:g.scores[j?'away':'home'].total}))}});}
 const now=Date.parse('2026-11-01T18:00Z'),records=new Map();
 seedRoster(records,calendar,{current:true,teams:[{id:'99',roster:{available:true,checkedAt:now,rows:[{id:1,name:'Dallas Goedert',position:'TE'},{id:2,name:'Saquon Barkley',position:'RB'},{id:3,name:'Tanner McKee',position:'QB'}]}}]},[{id:'99',name:'Philadelphia Eagles'}],now);
 for(const r of reports){applyParticipation(records,calendar,r.full,{league:'1',season:'2026'});applyParticipation(records,calendar,r.official,{league:'1',season:'2026'});}
 for(const [id,keys,count,dnp]of [['1',['rec','recYds','recTD'],5,2],['2',['carries','rushYds','rushTD','rec','recYds'],5,2],['3',['passYds','passTD','rushYds'],2,5]])for(const key of keys){const result=project([...records.get('99:'+id).games.values()],key);assert.ok(result,key);assert.equal(result.withheld,undefined,key);assert.equal(result.coverage.recorded,count,key);assert.equal(result.coverage.dnp,dnp,key);assert.equal(result.coverage.missing,0,key);}
 assert.deepEqual([...records.get('99:3').games.values()].filter(g=>g.participation==='played').map(g=>g.passYds),[215,211]);
 const barkley=[...records.get('99:2').games.values()];assert.equal(barkley[4].rushYds,undefined);assert.equal(barkley[4].participation,'dnp');
});
test('passing yards reconcile net team totals with exact recorded sack losses; arbitrary gaps remain missing',()=>{
 const d=summaries[6],{g,q}=game(d,6),r=parseBox(d,d.header,g,q);assert.equal(r.teams.find(t=>t.id==='99').players.find(p=>p.name==='Tanner McKee').passYds,211);
 for(const mutation of ['loss','count','yardage','missing']){const bad=structuredClone(d),table=bad.boxscore.players.find(t=>t.team.displayName==='Philadelphia Eagles').statistics.find(t=>t.name==='passing'),i=table.keys.indexOf('sacks-sackYardsLost');if(mutation==='loss')table.totals[i]='2-10';if(mutation==='count')table.totals[i]='3-11';if(mutation==='yardage')table.totals[1]='199';if(mutation==='missing')table.keys[i]='unknown';const row=parseBox(bad,bad.header,g,q).teams.find(t=>t.id==='99').players.find(p=>p.name==='Tanner McKee');assert.equal(row.passYds,undefined,mutation);}
});
test('official schedule direct gamebooks remain bound to a unique completed matchup and safe regular-season URL',async()=>{
 const source=official[0].source,card=`<div data-gameid="one" data-gametime="${new Date(source.gameDate*1000).toISOString()}">${source.away}<a href="${source.url}">Gamebook</a><script type="application/ld+json">`;
 const discover=html=>createDiscovery({fetcher:async()=>({ok:true,text:async()=>html})});
 assert.equal((await discover(card)(source)).url,source.url);
 assert.equal(await discover(card+card)(source),null);
 assert.equal(await discover(card.replace('2026/REG','2025/REG'))(source),null);
 assert.equal(await discover(card)({...source,gameDate:source.gameDate+86400}),null);
 assert.deepEqual(gamebookLinks('<a href="https://www.nflgsis.com.evil.test/2026/REG/01/1/Gamebook.pdf">Gamebook</a><a href="https://www.nflgsis.com/2026/PRE/01/1/Gamebook.pdf">Gamebook</a>'),[]);
});
