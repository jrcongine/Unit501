'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {parseNotes,createCollegeInjuryNotes}=require('../college-injury-notes');
const now=Date.parse('2026-10-27T20:00:00Z'),kickoff=Date.parse('2026-10-27T23:00:00Z');
const game={league:{id:2,season:2026},game:{id:123,date:{timestamp:kickoff/1000}},teams:{away:{id:1,name:'Delaware'},home:{id:2,name:'Western Kentucky'}}};
const event={'@type':'SportsEvent',startDate:'2026-10-27T23:00:00Z',awayTeam:{name:'Delaware'},homeTeam:{name:'Western Kentucky'}};
const row=(player,team,pos,status,date)=>`<tr><td>${player}<div class="small muted">${team}</div></td><td class="num">${pos}</td><td><span class="unoff-st">${status}</span></td><td>Note</td><td><a href="https://example.com">Source</a><div class="muted">${date}</div></td></tr>`;
function page(e=event){return `<script type="application/ld+json">${JSON.stringify(e)}</script><span class="upd-time">Last updated <time datetime="2026-10-27T12:50:44-07:00">time</time></span><section class="card unofficial" id="unofficial"><table><tbody>${row('T. Salazer','Delaware','WR','out','2026-10-13')}${row('A. Boyd','Western Kentucky','RB','questionable','2026-10-15')}</tbody></table></section>`;}
test('notes stay attributed to matching teams and retain source dates',()=>{
 const data=parseNotes(page(),game,'2026',now);
 assert.equal(data.away[0].name,'T. Salazer');assert.equal(data.away[0].status,'out');
 assert.equal(data.home[0].name,'A. Boyd');assert.equal(data.home[0].date,'2026-10-15');
});
test('wrong matchup, old page and invalid rows are never used',()=>{
 assert.throws(()=>parseNotes(page({...event,homeTeam:{name:'Arkansas'}}),game,'2026',now),/matchup/);
 assert.throws(()=>parseNotes(page(),game,'2026',now+72*3600000),/stale/);
 assert.throws(()=>parseNotes(page().replace('Delaware</div>','Arkansas</div>'),game,'2026',now),/row/);
});
test('display-only notes use verified matchup and never mark official statuses or player injuries',async()=>{
 let calls=0;const get=createCollegeInjuryNotes(async()=>({response:[game],errors:[]}),()=>now,async url=>{calls++;assert.match(url,/2026-10-27-delaware-at-western-kentucky/);return {ok:true,text:async()=>page()};});
 const teams=[{id:'1',official:{available:false},injuries:{rows:[]}},{id:'2',official:{available:false},injuries:{rows:[]}}],q={league:'2',season:'2026',away:'1',home:'2',game:'123'};
 await get(q,teams);await get(q,teams);assert.equal(calls,1);
 assert.equal(teams[0].unofficialNotes.rows.length,1);assert.equal(teams[1].unofficialNotes.rows.length,1);
 assert.equal(teams[0].official.available,false);assert.deepEqual(teams[0].injuries.rows,[]);
 const wrong=[{id:'1'},{id:'2'}];await get({...q,home:'5'},wrong);assert.equal(wrong[0].unofficialNotes,undefined);
});
