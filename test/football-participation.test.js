'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {parseBox,createParticipation}=require('../football-participation');
const {gamePage,gamebookLinks,createDiscovery}=require('../football-official-discovery');
const {applyParticipation}=require('../public/player-stats');
const raw=require('./fixtures/cfb-pitt-miami-20261024.json');
const q={game:'123',league:'2',season:'2026',date:'2026-10-24'},time=Date.parse(raw.header.competitions[0].date)/1000;
function game(){const g={league:{id:2,season:2026},game:{id:123,date:{timestamp:time},status:{short:'FT'},stage:'Regular Season'},teams:{},scores:{}};for(const t of raw.header.competitions[0].competitors){g.teams[t.homeAway]={id:t.id,name:t.team.displayName};g.scores[t.homeAway]={total:Number(t.score)};}return g;}
const parse=d=>parseBox(d,d.header,game(),q);
test('real college box score verifies played zero receiving via another recorded event',()=>{
 const r=parse(raw),p=r.teams[1].players.find(p=>p.name==='Javian Mallory');assert.equal(p.rushYds,47);assert.equal(p.recYds,0);assert.equal(p.rec,0);assert.equal(p.participation,'played');assert.equal(p.targets,undefined);assert(!p.markets.includes('targets'));
 assert(r.teams.every(t=>t.players.length>30));
});
test('a missing or all-zero unflagged player is not assumed played or DNP',()=>{
 const d=structuredClone(raw);d.boxscore.players[0].statistics[0].athletes.push({athlete:{id:'999999',displayName:'Unknown Player'},stats:['0/0','0','0','0','0','--']});
 assert(!parse(d).teams[0].players.some(p=>p.name==='Unknown Player'));
});
test('mismatching totals withhold the affected metric; missing categories never become zeros',()=>{
 const d=structuredClone(raw),group=d.boxscore.players[0].statistics.find(g=>g.name==='receiving');group.totals[group.keys.indexOf('receivingYards')]='999';
 let r=parse(d);assert(r.teams[0].players.every(p=>p.recYds===undefined));assert(r.teams[0].players.some(p=>p.rec!==undefined));
 d.boxscore.players[0].statistics=d.boxscore.players[0].statistics.filter(g=>g.name!=='rushing');r=parse(d);assert(r.teams[0].players.every(p=>p.rushYds===undefined));
});
test('secondary records cannot cross a season, score, team or game identity',()=>{
 for(const change of [d=>d.header.id='1',d=>d.header.season.year=2025,d=>d.header.competitions[0].competitors[0].score='0',d=>d.header.competitions[0].competitors[0].team.displayName='Other Team',d=>d.header.competitions[0].status.type.completed=false]){const d=structuredClone(raw);change(d);assert.throws(()=>parseBox(d,raw.header,game(),q));}
});
test('explicit DNP with positive data is rejected',()=>{
 const d=structuredClone(raw);d.boxscore.players[0].statistics[0].athletes[0].didNotPlay=true;assert.throws(()=>parse(d),/participation/);
});
test('client applies only verified secondary fields, keeping unreported targets unknown',()=>{
 const r={...parse(raw),checkedAt:time*1000+86400000},t=r.teams[1],other=r.teams[0],record={name:'Javian Mallory',team:t.name,teamId:t.id,games:new Map([['123',{gameDate:time,rushYds:47}]])},records=new Map([['player',record]]),calendar=new Map([['123',{date:time,teams:new Map([[t.id,{name:other.name,scored:t.scored,allowed:t.allowed}]])}]]);
 assert.equal(applyParticipation(records,calendar,r,q),1);const line=record.games.get('123');assert.equal(line.recYds,0);assert.equal(line.targets,undefined);assert.equal(line.participation,'played');
 line.recYds=2;applyParticipation(records,calendar,r,q);assert.equal(line.participation,'conflict');assert.equal(line.recYds,undefined);
});
test('secondary adapter caches public fetches and requires unique completed matchup',async()=>{
 let calls=0;const get=createParticipation({api:async()=>({response:[game()]}),now:()=>time*1000+86400000,fetcher:async url=>{calls++;return {ok:true,text:async()=>JSON.stringify(url.includes('/scoreboard?')?{events:[raw.header]}:raw)}}});
 assert.equal((await get(q)).available,true);assert.equal((await get(q)).available,true);assert.equal(calls,2);
 const ambiguous=createParticipation({api:async()=>({response:[game()]}),now:()=>time*1000+86400000,fetcher:async()=>({ok:true,text:async()=>JSON.stringify({events:[raw.header,raw.header]})})});assert.equal((await ambiguous(q)).available,false);
 const unverified=createParticipation({api:async()=>({response:[{...game(),league:{id:1,season:2026}}]}),fetcher:async()=>{throw Error('must not fetch')}});assert.equal((await unverified(q)).available,false);
});
test('NFL discovery follows unique official schedule game and safe gamebook link only',async()=>{
 const schedule=fs.readFileSync(__dirname+'/fixtures/nfl-schedule-card.html','utf8');
 const source={league:'1',season:'2026',home:'Minnesota Vikings',away:'Green Bay Packers',gameDate:Date.parse('2026-09-13T20:25:00Z')/1000};
 const page=gamePage(schedule,'https://www.packers.com',source,source.away);assert.match(page,/reg-week1/);
 assert.equal(gamePage(schedule,'https://www.packers.com',{...source,gameDate:source.gameDate+86400},source.away),null);
 const url='https://static.clubs.nfl.com/image/upload/packers/x7lnsyzwju871itpwm4v',html='<a href="'+url+'">Gamebook PDF</a><a href="https://evil.invalid/file">Gamebook</a>';
 assert.deepEqual(gamebookLinks(html),[url]);let calls=0;
 const discover=createDiscovery({fetcher:async u=>{calls++;if(u.includes('vikings.com'))return {ok:false};return {ok:true,text:async()=>u.endsWith('/schedule/')?schedule:html}}});
 const result=await discover(source);assert.equal(result.url,url);assert.equal(result.page,page);assert.equal(calls,3);
});

test('official discovery follows canonical redirects only within the team origin',async()=>{
 const schedule=fs.readFileSync(__dirname+'/fixtures/nfl-schedule-card.html','utf8'),source={league:'1',season:'2026',home:'Minnesota Vikings',away:'Green Bay Packers',gameDate:Date.parse('2026-09-13T20:25:00Z')/1000};
 const url='https://static.clubs.nfl.com/image/upload/packers/x7lnsyzwju871itpwm4v';
 for(const external of [false,true]){
  const visited=[],get=createDiscovery({fetcher:async u=>{visited.push(u);if(u.includes('vikings.com'))return {ok:false};if(u.endsWith('/schedule/'))return {ok:true,text:async()=>schedule};if(u.endsWith('/index'))return {status:301,headers:{get:()=>external?'https://evil.invalid/':u.replace(/index$/,'')}};return {ok:true,text:async()=>'<a href="'+url+'">Gamebook</a>'};}});
  assert.equal(Boolean(await get(source)),!external);assert(!visited.some(u=>u.includes('evil.invalid')));
 }
});

test('automatically discovered NFL layout supports expanded name abbreviations',()=>{
 const {parse}=require('../football-gamebook'),pages=require('./fixtures/nfl-gamebook-20260913.json');
 const teams=parse(pages,{date:'2026-09-13',away:'Green Bay Packers',home:'Minnesota Vikings',awayScore:22,homeScore:39});
 const smith=teams[0].players.find(p=>p.name==='J.Smith');assert.equal(smith.recYds,50);assert.equal(smith.targets,3);assert.equal(teams[1].players.find(p=>p.name==='Jac.Thomas').participation,'played');assert.equal(teams[1].players.find(p=>p.name==='Jak.Thomas').participation,'dnp');
});

test('evening NFL games check both Central and UTC scoreboard dates without double counting',async()=>{
 const d=structuredClone(raw),g=game(),date='2026-10-23',at='2026-10-24T00:15:00Z';g.league.id=1;g.game.date.timestamp=Date.parse(at)/1000;d.header.competitions[0].date=at;
 for(const t of d.header.competitions[0].competitors){const name=t.homeAway==='home'?'Green Bay Packers':'Carolina Panthers';t.team.displayName=name;g.teams[t.homeAway].name=name;}
 const seen=[],get=createParticipation({api:async()=>({response:[g]}),official:async()=>({available:false}),now:()=>time*1000+86400000,fetcher:async url=>{seen.push(url);return {ok:true,text:async()=>JSON.stringify(url.includes('/scoreboard?')?{events:url.includes('20261023')?[d.header]:[]}:d)};}});
 assert.equal((await get({...q,league:'1',date})).available,true);assert.equal(seen.filter(u=>u.includes('/scoreboard?')).length,2);
});
