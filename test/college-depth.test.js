'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {directory,parse,createCollegeDepth}=require('../college-depth');
const now=Date.parse('2026-10-31T04:00:00Z');
const cell=name=>`<td>1</td><td><a href='https://www.ourlads.com/ncaa-football-depth-charts/player/test/123'>${name}</a></td>`;
function page(school='Arizona'){return `<title>2026 ${school} Football Depth Chart</title><span id="ctl00_phContent_TeamCity">${school}</span><div id="ctl00_phContent_DateUpd">Updated: 10/25/2026 8:39PM ET</div><tbody id="ctl00_phContent_dcTBody"><tr><td>QB</td>${cell('Quarterback, Test')}</tr><tr><td>RCB</td>${cell("Cole, Jay'Vion")}${cell('Backup, Test')}</tr><tr><td>RES</td>${cell('Rusk, Cole')}</tr></tbody>`;}
const index=`<div class='ncaa-tm-school'>Arizona</div><a href='depth-chart.aspx?s=arizona&id=123'>Depth Chart</a>`;
test('published college depth retains starter, backup and reserve distinctions',()=>{
 const r=parse(page(),'Arizona','2026',now);
 assert.equal(r.rows.find(r=>r.name==="Jay'Vion Cole").position,'CB');
 assert.equal(r.rows.find(r=>r.name==='Test Backup').rank,2);
 assert.equal(r.rows.find(r=>r.name==='Cole Rusk').rank,null);
 assert.equal(directory(index+index,'2026').get('Arizona').size,1);
 for(const html of [page('Arizona State'),page().replace('2026 Arizona','2025 Arizona'),page().replace('10/25/2026','10/01/2026'),page().replace('10/25/2026','11/01/2026'),page().replace('Updated:','Unknown:')])assert.throws(()=>parse(html,'Arizona','2026',now));
});
test('all schools use discovery, unique roster matching, source expiry and exact matchup scoping',async()=>{
 let clock=now,calls=0;
 const load=createCollegeDepth(()=>clock,async url=>{calls++;return url.endsWith('default.aspx')?index:page();});
 const team={id:'10',official:{available:true,teamName:'Arizona',kickoff:now+3600000},roster:{rows:[{id:'7',name:"Jay'Vion Cole",position:'CB'},{id:'8',name:'Cole Rusk',position:'TE'}]}};
 const q={league:'2',season:'2026',game:'99'};
 await load(q,[team]);assert.equal(team.depth.available,true);assert.equal(team.depth.rows.find(r=>r.id==='7').rank,1);
 assert.equal(team.depth.rows.find(r=>r.id==='8').reserve,true);assert.equal(team.depth.gameId,'99');
 clock+=1000;await load(q,[team]);assert.equal(calls,2);assert.equal(team.depth.checkedAt,now);
 team.roster.rows.push({id:'9',name:"Jay'Vion Cole",position:'CB'});await load(q,[team]);assert.equal(team.depth.rows.some(r=>r.id==='7'),false);
 clock+=8*86400000;await load(q,[team]);assert.equal(team.depth.available,false);
});


test('scouting icon links do not create false shared slots; multiple named players still fail closed',()=>{
 const icon="<a href='https://www.ourlads.com/ncaa-football-depth-charts/player/test/123#analysis'><i class='fa fa-file-text'></i></a>";
 const html=page().replace('Quarterback, Test</a>','Quarterback, Test</a>'+icon);
 assert.equal(parse(html,'Arizona','2026',now).rows.length,4);
 const blank=html.replace('</tr>','<td></td><td><a href=\"https://www.ourlads.com/ncaa-football-depth-charts/player//0\"></a><span></span></td></tr>');
 assert.equal(parse(blank,'Arizona','2026',now).rows.length,4);
 assert.throws(()=>parse(html.replace("<i class='fa fa-file-text'></i>",'Other, Player'),'Arizona','2026',now),/Shared/);
});
