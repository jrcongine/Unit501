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
 let calls=0;const check=createOfficialInjuries(async()=>({response:[g]}),()=>now,async url=>{if(url.includes('/news/'))throw Error('No fixture inactive list');calls++;return page;});
 const t=teams();await check(q,t);await check(q,teams());assert.equal(calls,1);
 assert.equal(t[0].official.rows[0].id,'10');assert.equal(t[1].official.unmatched,1);assert.equal(t[1].official.unresolved[0].name,'Other');assert.equal(t[1].official.unresolved[0].id,undefined);
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
test('name matching resolves suffix omissions and reviewed aliases but rejects identity ambiguity',()=>{
 const {matchPlayer}=require('../official-injuries');
 const row={name:'Michael Pittman',position:'WR'},p={id:'1501',name:'Michael Pittman Jr.',position:'WR'};
 assert.equal(matchPlayer(row,[p],'22'),p);
 assert.equal(matchPlayer({...row,name:'Michael Pittman III'},[p],'22'),null);
 assert.equal(matchPlayer(row,[p,{id:'999',name:'Michael Pittman',position:'WR'}],'22'),null);
 assert.equal(matchPlayer(row,[{...p,position:'RB'}],'22'),null);
 const alias={id:'17539',name:'Christopher Brooks',position:'RB'},r={name:'Chris Brooks',position:'RB'};
 assert.equal(matchPlayer(r,[alias],'15'),alias);
 for(const [player,team] of [[alias,'16'],[{...alias,id:'99'},'15'],[{...alias,position:'WR'},'15'],[{...alias,name:'Christopher Brook'},'15']])assert.equal(matchPlayer(r,[player],team),null);
 assert.equal(matchPlayer(r,[alias,{id:'99',name:'Chris Brooks',position:'RB'}],'15'),null);
 assert.equal(matchPlayer({name:'Lorenzo Styles Jr.',position:'CB'},[{id:'14372',name:'Lorenzo Styles',position:'S'}],'27'),null);
 assert.equal(matchPlayer({name:'Jaylon Jones',position:'CB'},[{id:'7609',name:'Jarrian Jones',position:'CB'}],'2'),null);
});
test('reviewed Sunday depth aliases require exact team, player identity and position',()=>{
 const {matchPlayer}=require('../player-name-match');
 for(const [team,name,id,rosterName,position] of [['9','KC Concepcion Jr.','39201','Kevin Concepcion','WR'],['18','Jacory Croskey-Merritt','27317','Jacory Merritt','RB'],['11','Reggie Virgil','16854','Reginald Virgil','WR']]){
  const row={name,position},player={id,name:rosterName,position};
  assert.equal(matchPlayer(row,[player],team),player);
  assert.equal(matchPlayer(row,[player],'99'),null);
  assert.equal(matchPlayer(row,[{...player,id:'99'}],team),null);
  assert.equal(matchPlayer(row,[{...player,position:'TE'}],team),null);
  assert.equal(matchPlayer(row,[player,{id:'99',name,position}],team),null);
 }
});
test('resolved suffix omission carries official Out into the availability gate',async()=>{
 const t=teams();t[0].roster={available:true,checkedAt:now,rows:[{id:'10',name:'Player One Jr.',position:'RB'}]};
 await createOfficialInjuries(async()=>({response:[g]}),()=>now,async()=>page)(q,t);
 assert.equal(t[0].official.rows[0].id,'10');
 assert.equal(assess({current:true,teams:t},{id:'100',kickoff},'16','10',now).blocked,true);
});

test('reviewed Josh Palmer identity carries official Out to Joshua Palmer without broad nickname matching',async()=>{
 const {matchPlayer}=require('../player-name-match');
 const player={id:'2164',name:'Joshua Palmer',position:'WR'};
 const row={name:'Josh Palmer',position:'WR'};
 assert.equal(matchPlayer(row,[player],'20'),player);
 for(const [roster,team] of [[[player],'31'],[[{...player,id:'999'}],'20'],[[{...player,position:'TE'}],'20'],[[player,{id:'999',name:'Josh Palmer',position:'WR'}],'20']]){
  assert.equal(matchPlayer(row,roster,team),null);
 }
 const query={...q,away:'20'},game={...g,teams:{...g.teams,away:{id:20,name:'Buffalo Bills'}}};
 const html=page.replace('Bears','Bills').replace('Player One','Josh Palmer').replace('<td>RB</td>','<td>WR</td>');
 const t=[{id:'20',roster:{available:true,checkedAt:now,rows:[player]},injuries:{available:true,checkedAt:now,rows:[]}},{id:'15',roster:{rows:[]}}];
 await createOfficialInjuries(async()=>({response:[game]}),()=>now,async()=>html)(query,t);
 assert.equal(t[0].official.unmatched,0);
 assert.equal(t[0].official.rows[0].id,'2164');
 const result=assess({current:true,teams:t},{id:'100',kickoff},'20','2164',now);
 assert.equal(result.blocked,true);
 assert.match(result.reason,/Official NFL/);
});

test('suffix matching permits equivalent offensive line labels but preserves identity ambiguity',()=>{
 const {matchPlayer}=require('../player-name-match');
 for(const [provider,chart] of [['T','LT'],['OT','RT'],['G','LG'],['OG','RG']]){
  const p={id:'1',name:'Player One Jr.',position:provider};
  const row={name:'Player One',position:chart};
  assert.equal(matchPlayer(row,[p],'16'),p);
  assert.equal(matchPlayer(row,[{...p,position:'C'}],'16'),null);
  assert.equal(matchPlayer(row,[p,{...p,id:'2'}],'16'),null);
  assert.equal(matchPlayer({...row,name:'Player One III'},[p],'16'),null);
 }
});

test('shared football name matching handles accents without inventing identities or resolving collisions',()=>{
 const {matchPlayer}=require('../player-name-match');
 for(const league of ['1','2']){
  const row={name:'José O’Neal Jr.',position:'WR'},p={id:'8',name:'Jose ONeal',position:'WR'};
  assert.equal(matchPlayer(row,[p],'1',{league,season:'2026'}),p);
  assert.equal(matchPlayer(row,[p,{...p,id:'9',name:'José ONeal'}],'1',{league}),null);
  assert.equal(matchPlayer(row,[{...p,name:'Jose ONeal III'}],'1',{league}),null);
  assert.equal(matchPlayer(row,[],'1',{league}),null);
  assert.equal(matchPlayer({name:'',position:'WR'},[{id:'8',name:'',position:'WR'}],'1',{league}),null);
 }
});

test('malformed NFL injury rows cannot silently disappear from a verified report',async()=>{
 for(const html of [page.replace('<td>Toe</td>',''),page.replace('<td>Toe</td>','<td>Toe</td><td>Extra</td>'),page.replace('<td>Player One</td>','<td></td>')]){
  assert.throws(()=>parseReport(html,'2026',5),/row layout/);
  const t=teams();await createOfficialInjuries(async()=>({response:[g]}),()=>now,async()=>html)(q,t);
  assert.equal(t[0].official.available,false);
 }
});
