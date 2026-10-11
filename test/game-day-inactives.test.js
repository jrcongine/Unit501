'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');
const {parseInactives,createGameDayInactives,sources}=require('../game-day-inactives');
const {assess}=require('../public/injury-model');
const now=Date.parse('2026-10-11T16:00:00Z'),kickoff=now+3600000,url=sources['2026:5:2026-10-11'];
const article={ '@type':'NewsArticle',url,datePublished:'2026-10-11T15:30:00Z',dateModified:'2026-10-11T15:40:00Z',articleBody:'Inactive reports for Week 5 of the 2026 NFL season'};
const page=(a=article,rows='<li>QB Player One (emergency third QB)</li><li>WR Missing Player</li>')=>`<script type="application/ld+json">${JSON.stringify(a)}</script><h3>BEARS</h3><ul>${rows}</ul><h3>PACKERS</h3><ul><li>RB Other Player</li></ul>`;
const q={league:'1',season:'2026',game:'123',away:'16',home:'15'};
const g={game:{week:'Week 5',date:{timestamp:kickoff/1000}},teams:{away:{id:16,name:'Chicago Bears'},home:{id:15,name:'Green Bay Packers'}}};
const teams=()=>[{id:'16',roster:{available:true,checkedAt:now,rows:[{id:'10',name:'Player One',position:'QB'}]}},{id:'15',roster:{available:true,checkedAt:now,rows:[{id:'20',name:'Other Player',position:'RB'}]}}];
test('final inactive parser verifies current article identity, date, season and entry layout',()=>{
 const report=parseInactives(page(),url,'2026',5,'2026-10-11',now);assert.equal(report.teams[0].rows[0].emergency,true);
 for(const html of [page({...article,url:url+'old'}),page({...article,datePublished:'2025-10-11T15:30:00Z'}),page({...article,dateModified:'2026-10-11T17:00:00Z'}),page(article,'<li>Unknown format</li>'),page()+page()])assert.throws(()=>parseInactives(html,url,'2026',5,'2026-10-11',now));
 assert.throws(()=>parseInactives(page(),url,'2026',6,'2026-10-11',now));
});
test('final inactive gate scopes the exact game and freshness, preserves unmatched names and never infers active status',async()=>{
 let clock=now,calls=0,fail=false;
 const attach=createGameDayInactives(()=>clock,async()=>{calls++;if(fail)throw Error('Unavailable');return page();});
 const t=teams();await attach(q,t,g);await attach(q,teams(),g);assert.equal(calls,1);assert.equal(t[0].inactives.unmatched.length,1);
 const game={id:'123',league:'1',season:'2026',kickoff},data={current:true,teams:t};
 assert.equal(assess(data,game,'16','10',clock).blocked,true);assert.match(assess(data,game,'16','10',clock).reason,/emergency/);
 assert.equal(assess(data,{...game,id:'other'},'16','10',clock).blocked,false);
 assert.equal(assess(data,{...game,season:'2025'},'16','10',clock).blocked,false);
 assert.equal(assess(data,game,'16','99',clock).state,'unknown');
 clock+=900001;assert.equal(assess(data,game,'16','10',clock).blocked,false);
 fail=true;await attach(q,t,g);assert.equal(t[0].inactives.available,false);assert.equal(calls,2);
 const late=teams();clock=kickoff;await attach(q,late,g);assert.equal(calls,2);assert.equal(late[0].inactives,undefined);
});
test('final inactive lists remain available when the separate weekly report fails',async()=>{
 const {createOfficialInjuries}=require('../official-injuries');
 const fixture={...g,league:{id:1,season:2026},game:{...g.game,stage:'Regular Season'}};
 const t=teams();
 await createOfficialInjuries(async()=>({response:[fixture]}),()=>now,async target=>{if(target===url)return page();throw Error('Weekly source unavailable');})(q,t);
 assert.equal(t[0].official.available,false);assert.equal(t[0].inactives.available,true);
 assert.equal(assess({current:true,teams:t},{id:'123',league:'1',season:'2026',kickoff},'16','10',now).blocked,true);
});
