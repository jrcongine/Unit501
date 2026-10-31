'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {parse,sources,createGamebooks}=require('../football-gamebook');
const pages=require('./fixtures/nfl-gamebook-20261029.json');
const {applyParticipation,applyReviewedHistory}=require('../public/player-stats');
const form=require('../public/player-form'),backtest=require('../public/player-backtest');
const source=sources[0],time=Date.parse('2026-10-30T00:15:00Z')/1000;
const game={league:{id:1,season:2026},game:{id:123,date:{timestamp:time},status:{short:'FT'},stage:'Regular Season'},teams:{away:{id:1,name:source.away},home:{id:2,name:source.home}},scores:{away:{total:19},home:{total:27}}};
function report(){return {available:true,gameId:'123',league:'1',season:'2026',gameDate:time,source:source.url,checkedAt:time*1000+86400000,teams:parse(pages,source).map((t,i)=>({...t,id:String(i+1),scored:i?27:19,allowed:i?19:27}))};}
function records(){return new Map([['2:7',{name:'Jonnu Smith',team:source.home,teamId:'2',games:new Map([['123',{gameDate:time}]])}],['2:8',{name:'Bo Melton',team:source.home,teamId:'2',games:new Map([['123',{gameDate:time}]])}]]);}
const calendar=()=>new Map([['123',{date:time,teams:new Map([['2',{name:source.away,scored:27,allowed:19}]])}]]);
test('real NFL gamebook distinguishes starters, substitutions, DNP and inactive; totals reconcile',()=>{
 const teams=parse(pages,source);assert.deepEqual(teams.map(t=>t.players.length),[55,54]);
 const get=name=>teams[1].players.find(p=>p.name===name);
 for(const name of ['J.Smith','T.Taylor']){assert.equal(get(name).participation,'dnp');assert.equal(get(name).recYds,undefined);}
 assert.equal(get('B.Melton').participation,'played');assert.equal(get('B.Melton').recYds,0);
 assert.equal(get('J.Love').passYds,288);assert.equal(get('C.Watson').recYds,113);
});
test('wrong date, opponent, final score, missing tables or changed totals fail closed',()=>{
 for(const change of [{date:'2026-10-28'},{home:'Other Team'},{homeScore:28}])assert.throws(()=>parse(pages,{...source,...change}));
 for(const value of ['Did Not Play','Substitutions','Total','Final Individual Statistics','PASS RECEIVING']){
  const broken=structuredClone(pages);broken.forEach(p=>p.items=p.items.filter(i=>!i.str.includes(value)));assert.throws(()=>parse(broken,source));
 }
 const broken=structuredClone(pages);const stat=broken[1].items.find(i=>i.str==='113');stat.str='114';assert.throws(()=>parse(broken,source),/totals/);
});
test('official reconciliation excludes DNP but adds played zeros and is idempotent',()=>{
 const rows=records(),r=report();assert.equal(applyParticipation(rows,calendar(),r,{league:'1',season:'2026'}),2);
 assert.equal(applyParticipation(rows,calendar(),r,{league:'1',season:'2026'}),2);
 const smith=rows.get('2:7').games.get('123'),melton=rows.get('2:8').games.get('123');
 assert.equal(form.isDNP(smith),true);assert.equal(melton.recYds,0);assert.equal(smith.recYds,undefined);
 const earlier=[{gameDate:time-3*86400,recYds:20},{gameDate:time-2*86400,recYds:0}];
 const summary=form.summarize([...earlier,smith],'recYds');assert.equal(summary.average,10);assert.equal(summary.coverage.dnp,1);assert.equal(summary.coverage.missing,0);assert.equal(summary.coverage.total,2);assert.equal(summary.coverage.teamGames,3);
 assert.equal(form.project([...earlier,smith],'recYds').withheld,undefined);
 assert.equal(form.summarize([...earlier,melton],'recYds').average,20/3);
 assert.equal(backtest.validate([...earlier,smith],'recYds').dnp,1);
});
test('ambiguous names and wrong scope cannot receive official statistics',()=>{
 const r=report();for(const scope of [{league:'2',season:'2026'},{league:'1',season:'2025'}])assert.equal(applyParticipation(records(),calendar(),r,scope),0);
 const rows=records();rows.set('other',{...rows.get('2:7'),name:'John Smith'});
 applyParticipation(rows,calendar(),r,{league:'1',season:'2026'});assert.equal(rows.get('2:7').games.get('123').participation,undefined);
 const bad=report();bad.teams[1].scored=99;assert.equal(applyParticipation(records(),calendar(),bad,{league:'1',season:'2026'}),0);
});
test('conflicting provider statistics are quarantined rather than counted as played or DNP',()=>{
 const rows=records();rows.get('2:7').games.get('123').recYds=10;rows.get('2:8').games.get('123').rec=1;
 assert.equal(applyParticipation(rows,calendar(),report(),{league:'1',season:'2026'}),0);
 for(const p of rows.values()){const line=p.games.get('123');assert.equal(line.participation,'conflict');assert.equal(form.isDNP(line),false);assert.equal(line.recYds,undefined);}
});
test('gamebook adapter verifies provider game and caches source; unsupported games make no provider requests',async()=>{
 let calls=0,requests=0;const q={game:'123',league:'1',season:'2026',date:source.date};
 const get=createGamebooks({api:async()=>{calls++;return {response:[game]}},now:()=>time*1000+86400000,extractPDF:async()=>pages,fetcher:async()=>{requests++;return {ok:true,arrayBuffer:async()=>new ArrayBuffer(100)}}});
 assert.equal((await get({...q,date:'2026-10-28'})).available,false);assert.equal(calls,0);
 assert.equal((await get(q)).available,true);assert.equal((await get(q)).available,true);assert.equal(requests,1);
 for(const change of [g=>g.game.status.short='NS',g=>g.teams.home.name='Other',g=>g.scores.home.total=1,g=>g.league.season=2025]){
  const g=structuredClone(game);change(g);const read=createGamebooks({api:async()=>({response:[g]}),now:()=>time*1000+86400000,fetcher:async()=>{throw Error('Must not fetch');}});assert.equal((await read(q)).available,false);
 }
});
test('unverified DNP and missing market rows still withhold projections',()=>{
 const base=[{gameDate:1,rec:1},{gameDate:2,rec:0}];
 assert.equal(form.project([...base,{gameDate:3,participation:'dnp'}],'rec').withheld,true);
 assert.equal(form.project([...base,{gameDate:3,participation:'played',verification:{participation:true}}],'rec').withheld,true);
});
test('three previously omitted Smith games are independently verified played zeros from real official gamebooks',()=>{
 for(const s of sources.slice(1).filter(s=>s.home==='Green Bay Packers'||s.away==='Green Bay Packers')){
  const input=require('./fixtures/nfl-gamebook-'+s.date.replaceAll('-','')+'.json');
  const teams=parse(input,s),smith=teams.find(t=>t.name==='Green Bay Packers').players.find(p=>p.name==='J.Smith');
  assert.equal(smith.participation,'played');assert.equal(smith.rec,0);assert.equal(smith.recYds,0);assert.equal(smith.targets,0);
 }
});
test('seven played Smith games plus Carolina DNP retain correct denominator and pushes',()=>{
 const rows=records();applyParticipation(rows,calendar(),report(),{league:'1',season:'2026'});
 const earlier=[[2,50],[0,0],[2,16],[1,19],[0,0],[0,0],[1,9]].map(([rec,recYds],i)=>({rec,recYds,gameDate:time-(8-i)*7*86400}));
 const history=[...earlier,rows.get('2:7').games.get('123')];
 const yards=form.summarize(history,'recYds'),receptions=form.summarize(history,'rec');
 assert.equal(yards.values.length,7);assert.equal(yards.average,94/7);
 assert.equal(yards.values.filter(v=>v>3.5).length,4);assert.equal(yards.values.filter(v=>v<3.5).length,3);
 assert.equal(receptions.values.filter(v=>v>1).length,2);assert.equal(receptions.values.filter(v=>v<1).length,3);assert.equal(receptions.values.filter(v=>v===1).length,2);
 assert.equal(yards.coverage.dnp,1);assert.equal(yards.coverage.teamGames,8);
});
