'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fixtures=require('./fixtures/nfl-patriots-2026-receiving.json');
const {parseBox,createParticipation}=require('../football-participation');
const {seedRoster,applyParticipation,missingGames}=require('../public/player-stats');
const {project}=require('../public/player-form');
function scope(data,index){
 const c=data.header.competitions[0],q={game:String(900+index),league:'1',season:'2026',date:new Date(c.date).toISOString().slice(0,10)},g={game:{id:Number(q.game),stage:'Regular Season',status:{short:'FT'},date:{timestamp:Date.parse(c.date)/1000}},league:{id:1,season:2026},teams:{},scores:{}};
 for(const t of c.competitors){g.teams[t.homeAway]={id:t.team.displayName==='New England Patriots'?99:Number(t.team.id)+1000,name:t.team.displayName};g.scores[t.homeAway]={total:Number(t.score)};}
 return {q,g};
}
test('seven live-source Patriots boxes recover Henry receptions and yards from a verified provider roster without mixing ID namespaces',()=>{
 assert.equal(fixtures.length,7);const records=new Map(),calendar=new Map(),reports=[];
 for(const [index,data]of fixtures.entries()){
  const {q,g}=scope(data,index),side=g.teams.away.id===99?'away':'home',other=side==='away'?'home':'away';
  calendar.set(q.game,{date:g.game.date.timestamp,teams:new Map([['99',{id:String(g.teams[other].id),name:g.teams[other].name,scored:g.scores[side].total,allowed:g.scores[other].total}]])});
  reports.push(parseBox(data,data.header,g,q));
 }
 const now=Date.parse('2026-11-01T18:00Z');
 assert.equal(seedRoster(records,calendar,{current:true,teams:[{id:'99',roster:{available:true,checkedAt:now,rows:[{id:'25',name:'Hunter Henry',position:'TE'}]}}]},[{id:'99',name:'New England Patriots'}],now),1);
 assert([...records.get('99:25').games.values()].every(g=>g.rec===undefined));
 for(const report of reports)assert.equal(applyParticipation(records,calendar,report,{league:'1',season:'2026'}),1);
 const record=records.get('99:25'),history=[...record.games.values()];assert.equal(record.playerId,'25');assert.equal(records.has('99:3046439'),false);
 const receiving=project(history,'rec'),yards=project(history,'recYds');
 assert.equal(receiving.coverage.recorded,7);assert.equal(yards.coverage.recorded,7);assert.equal(receiving.withheld,undefined);assert.equal(yards.withheld,undefined);
 assert.deepEqual(history.map(g=>g.recYds),[26,40,5,62,44,48,71]);assert.deepEqual(history.map(g=>g.rec),[3,3,1,5,3,4,7]);
 assert.equal(missingGames(records).size,0);
});
test('the default NFL route uses a verified full-name box before abbreviation-based gamebooks',async()=>{
 const data=fixtures[0],{q,g}=scope(data,0);q.date='2026-09-09';let official=0;
 const read=createParticipation({now:()=>Date.parse('2026-11-01T18:00Z'),api:async()=>({response:[g]}),official:async()=>{official++;return {available:false};},fetcher:async url=>({ok:true,text:async()=>JSON.stringify(url.includes('scoreboard?')?{events:[data.header]}:data)})});
 const r=await read(q);assert.equal(r.available,true);assert.equal(r.nameFormat,'full');assert.equal(official,0);
 await read({...q,officialOnly:true});assert.equal(official,1);
});
test('roster seeding never invents stats and refuses stale, duplicate or conflicting identities',()=>{
 const now=10000,teams=[{id:'9',name:'Team'}],calendar=new Map([['1',{date:1,teams:new Map([['9',{name:'Opponent'}]])}]]);
 const sample={current:true,teams:[{id:'9',roster:{available:true,checkedAt:now,rows:[{id:'25',name:'Player One',position:'WR'}]}}]};
 for(const mutate of [s=>s.current=false,s=>s.teams[0].roster.checkedAt=now+1,s=>s.teams[0].roster.rows.push({...s.teams[0].roster.rows[0]}),s=>s.rosterOwnership={conflicts:[{id:'25'}]}]){const s=structuredClone(sample);mutate(s);const m=new Map();assert.equal(seedRoster(m,calendar,s,teams,now),0);assert.equal(m.size,0);}
 const m=new Map();seedRoster(m,calendar,sample,teams,now);assert.equal(m.get('9:25').games.get('1').rec,undefined);assert.equal(project([...m.get('9:25').games.values()],'rec'),null);
});
