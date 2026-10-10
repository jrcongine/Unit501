'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');
const {parseReport,createOfficialInjuries}=require('../official-injuries');
const {assess}=require('../public/injury-model');
const now=Date.parse('2026-10-10T18:00:00Z'),kickoff=now+86400000;
const page=`<title>Official NFL Injury Report for Players - Week 5 of the 2026 Season | NFL.com</title><div class="d3-o-section-sub-title"><span>Bears</span></div><table><tr><th>Game Status</th></tr><tr><td>Player One</td><td>RB</td><td>Toe</td><td>Did Not Participate</td><td>Out</td></tr></table><div class="d3-o-section-sub-title"><span>Packers</span></div><table><tr><th>Game Status</th></tr><tr><td>Other</td><td>QB</td><td></td><td>Full Participation</td><td></td></tr></table>`;
const q={league:'1',season:'2026',away:'16',home:'15',game:'100'};
const g={game:{week:'Week 5',stage:'Regular Season',date:{timestamp:kickoff/1000}},league:{id:1,season:2026},teams:{away:{id:16,name:'Chicago Bears'},home:{id:15,name:'Green Bay Packers'}}};
const teams=()=>[{id:'16',roster:{rows:[{id:'10',name:'Player One'}]}},{id:'15',roster:{rows:[]}}];
test('official parser rejects wrong week, empty and changed layouts; blank game status stays blank',()=>{
 assert.equal(parseReport(page,'2026',5)[1].rows[0].status,'');
 for(const [html,season,week] of [[page,'2026',4],[page,'2025',5],['<title>unavailable</title>','2026',5],[page.replaceAll('Game Status','Changed'),'2026',5]])assert.throws(()=>parseReport(html,season,week));
});
test('cross-check verifies matchup and uses unique roster identity; shared weekly fetch is cached',async()=>{
 let calls=0;const check=createOfficialInjuries(async()=>({response:[g]}),()=>now,async()=>{calls++;return page;});
 const t=teams();await check(q,t);await check(q,teams());assert.equal(calls,1);
 assert.equal(t[0].official.rows[0].id,'10');assert.equal(t[1].official.unmatched,1);
 const dup=teams();dup[0].roster.rows.push({id:'11',name:'Player One'});await check(q,dup);assert.equal(dup[0].official.rows.length,0);assert.equal(dup[0].official.unmatched,1);
 const bad=teams();await check({...q,home:'99'},bad);assert.equal(bad[0].official.available,false);
 const past=createOfficialInjuries(async()=>({response:[{...g,game:{...g.game,date:{timestamp:(now-1)/1000}}}]}),()=>now,async()=>{throw new Error('must not fetch');});
 const historical=teams();await past(q,historical);assert.equal(historical[0].official.available,false);
});
test('official Out blocks with no provider injury entry; conflicts withhold; wrong game and expired reports cannot gate',()=>{
 const team={id:'16',roster:{available:true,checkedAt:now,rows:[{id:'10'}]},injuries:{available:true,checkedAt:now,rows:[]},official:{available:true,checkedAt:now,gameId:'100',kickoff,week:5,rows:[{id:'10',teamId:'16',status:'Out'}]}};
 const data={current:true,teams:[team]},game={id:'100',kickoff};const check=()=>assess(data,game,'16','10',now);
 assert.equal(check().blocked,true);assert.match(check().reason,/Official NFL/);
 team.official.rows[0].status='Questionable';team.injuries.rows=[{id:'10',teamId:'16',status:'Sidelined',date:'2026-10-10'}];
 assert.equal(check().state,'conflict');assert.equal(check().blocked,true);
 team.injuries.rows=[];team.official.rows[0].status='Out';team.official.gameId='101';assert.equal(check().blocked,false);
 team.official.gameId='100';team.official.checkedAt=now-900001;assert.equal(check().blocked,false);
});
