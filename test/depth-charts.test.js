'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {parseDepth,createDepthCharts,domains}=require('../depth-charts');const {assess}=require('../public/injury-model');
const now=Date.parse('2026-10-10T22:00:00Z'),kickoff=1791738000000;
const page='<table class="d3-o-depthchart"><tr><th>Position</th><th>1st String</th></tr><tr><td>QB</td><td><a href="/team/players-roster/a">Caleb Williams</a></td><td><a href="/team/players-roster/b">Tyson Bagent</a></td></tr></table>';
test('depth parser preserves listed order and rejects unknown layout; all NFL teams have sources',()=>{
 assert.equal(parseDepth('<table><tr><th>Position</th><th>Player</th></tr><tr><td>QB</td><td>10 Jordan Love</td><td>6 Tyrod Taylor</td></tr></table>')[0].name,'Jordan Love');
 assert.equal(Object.keys(domains).length,32);assert.deepEqual(parseDepth(page).map(r=>r.rank),[1,2]);assert.throws(()=>parseDepth('<html>Error</html>'));
 assert.equal(parseDepth(page.replace('Caleb Williams</a>','Caleb Williams</a><a href="/team/players-roster/c">Other</a>'))[0].unresolved,true);
});
test('reviewed announcement is exact-game scoped and roster identity must be unique; chart failure preserves announcement',async()=>{
 const load=createDepthCharts(()=>now,async()=>{throw Error('unavailable');});
 const team={id:'16',roster:{rows:[{id:'1',name:'Caleb Williams',position:'QB'},{id:'2',name:'Tyson Bagent',position:'QB'}]}};
 const g={game:{date:{timestamp:kickoff/1000}},teams:{away:{name:'Chicago Bears'},home:{name:'Green Bay Packers'}}};
 const q={league:'1',season:'2026',game:'21587',away:'16',home:'15'};
 await load(q,[team],g);assert.equal(team.starters.rows[0].id,'2');assert.equal(team.depth.available,false);
 await load({...q,game:'21588'},[team],g);assert.equal(team.starters.rows.length,0);
 team.roster.rows.push({id:'3',name:'Tyson Bagent',position:'QB'});await load(q,[team],g);assert.equal(team.starters.rows.length,0);
});
test('announced starting QB gates other QB full-game props; depth order alone never does',()=>{
 const team={id:'16',roster:{available:true,checkedAt:now,rows:[{id:'1',position:'QB'},{id:'2',position:'QB'}]},injuries:{available:true,checkedAt:now,rows:[]},starters:{gameId:'21587',kickoff,checkedAt:now,rows:[{id:'2',position:'QB',name:'Bagent',publisher:'Bears',publishedAt:'2026-10-09T20:43:00Z'}]}};
 const data={current:true,teams:[team]},game={id:'21587',kickoff};const check=id=>assess(data,game,'16',id,now,true);
 assert.equal(check('1').state,'nonstarter');assert.equal(check('1').blocked,true);assert.equal(check('2').blocked,false);
 team.starters.gameId='other';assert.equal(check('1').blocked,false);
 team.starters.gameId='21587';team.starters.checkedAt=now-900001;assert.equal(check('1').blocked,false);
 delete team.starters;team.depth={rows:[{id:'1',rank:2}]};assert.equal(check('1').blocked,false);
});

test('receiver rows preserve distinct depth slots rather than mixing backups from different positions',()=>{
 const html=page.replace('</table>','<tr><td>WR</td><td>First Receiver</td><td>First Backup</td></tr><tr><td>WR</td><td>Second Receiver</td><td>Second Backup</td></tr></table>');
 const rows=parseDepth(html).filter(r=>r.position==='WR');
 assert.equal(rows[0].slot,rows[1].slot);assert.equal(rows[2].slot,rows[3].slot);assert.notEqual(rows[0].slot,rows[2].slot);
});

test('offensive names require matching position and unresolved slots remain visible',async()=>{
 const load=createDepthCharts(()=>now,async()=>page);
 const team={id:'16',roster:{rows:[{id:'1',name:'Caleb Williams',position:'WR'},{id:'2',name:'Tyson Bagent',position:'QB'}]}};
 const g={game:{date:{timestamp:kickoff/1000}},teams:{away:{name:'Chicago Bears'},home:{name:'Green Bay Packers'}}};
 await load({league:'1',season:'2026',game:'21587',away:'16'},[team],g);
 assert.equal(team.depth.rows.length,1);assert.equal(team.depth.unresolved[0].rank,1);
 assert.deepEqual(team.depth.coverage[0],{position:'QB',matched:1,unresolved:1});
});
