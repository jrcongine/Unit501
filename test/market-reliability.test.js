'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {summarize}=require('../public/market-reliability');
const {compare}=require('../public/injury-backtest');
const row=(change={})=>({
 league:'1',season:'2026',modelVersion:'player-v1',
 kind:'prop',market:'recYds',gameId:'100',teamId:'1',playerId:'7',
 kickoff:100000,forecastAt:90000,inputAsOf:80000,resultKnownAt:120000,
 evidenceUrl:'https://example.org/capture',baseline:24,adjusted:22,actual:20,
 ...change
});
test('market reliability weights each game once and computes chronological, same-market windows',()=>{
 const rows=Array.from({length:30},(_,i)=>row({
  gameId:String(1000+i),kickoff:100000+i,resultKnownAt:120000+i,
  baseline:40,actual:20,adjusted:i<20?40:21
 }));
 // A second player from the latest game does not make that game count twice.
 rows.push(row({gameId:'1029',playerId:'8',kickoff:100029,resultKnownAt:120029,actual:20,baseline:40,adjusted:99}));
 const m=summarize(rows)[0];
 assert.equal(m.games,30);assert.equal(m.targets,31);assert.equal(m.pending,0);
 assert.equal(m.previousGames,10);assert.equal(m.recentGames,10);
 assert.equal(m.previousMAE,20);assert.equal(m.recentMAE,4.9);
 assert.ok(Math.abs(m.mae-449/30)<1e-9);
 assert.equal(m.trend,'Recent error lower');
 assert.equal(m.highGames,30);assert.equal(m.lowGames,0);
});
test('market reliability isolates leagues, seasons, markets and model versions instead of ranking different units',()=>{
 const rows=[
  row(),row({league:'2',gameId:'101'}),
  row({season:'2025',gameId:'102'}),
  row({modelVersion:'player-v2',gameId:'103'}),
  row({market:'rec',gameId:'104',baseline:4,adjusted:3,actual:2})
 ];
 const m=summarize(rows);
 assert.equal(m.length,5);
 assert.ok(m.every(x=>x.games===1 && x.targets===1 && x.trend==='Not enough games to review'));
 const props=m.map(x=>[x.league,x.season,x.modelVersion,x.market].join('|'));
 assert.equal(new Set(props).size,5);
});
test('market reliability describes pending markets without grading missing statistics as zero',()=>{
 const pending=row({actual:null,resultKnownAt:null,market:'carries'});
 const m=summarize([], [pending,pending,{...pending,modelVersion:'player-v2'}]);
 assert.equal(m.length,2);
 const first=m.find(x=>x.modelVersion==='player-v1');
 assert.equal(first.games,0);assert.equal(first.targets,0);assert.equal(first.pending,2);
 assert.equal(first.mae,null);assert.equal(first.bias,null);assert.equal(first.recentMAE,null);
});
test('change descriptions require 30 distinct games and do not declare model confidence',()=>{
 const make=n=>Array.from({length:n},(_,i)=>row({
  gameId:String(500+i),kickoff:100000+i,adjusted:i<n-10?20:24,actual:20
 }));
 assert.equal(summarize(make(29))[0].trend,'Not enough games to review');
 assert.equal(summarize(make(30))[0].trend,'Recent error higher');
 assert.equal(summarize(Array.from({length:30},(_,i)=>row({
  gameId:String(700+i),kickoff:100000+i,adjusted:24,actual:20
 })))[0].trend,'Recent error similar');
});
test('reliability from archive comparison shares late, duplicate, pending and mixed-version gates',()=>{
 const accepted=row();
 const second=row({gameId:'101',actual:21,adjusted:25});
 const pending=row({gameId:'102',actual:null,resultKnownAt:null});
 const invalid=row({gameId:'103',actual:null,resultKnownAt:130000});
 const late=row({gameId:'104',forecastAt:100000});
 const duplicate=row({gameId:'105'});
 const data=compare([accepted,second,pending,invalid,late,duplicate,duplicate]);
 assert.equal(data.marketReliability.length,1);
 assert.equal(data.marketReliability[0].games,2);
 assert.equal(data.marketReliability[0].pending,1);
 assert.equal(data.marketReliability[0].targets,2);
 assert.equal(data.skips.ambiguous,2);
 assert.equal(data.skips.late,1);
 assert.equal(data.skips.invalid,1);
 const mixed=compare([accepted,row({gameId:'110',modelVersion:'player-v2'})]);
 assert.equal(mixed.marketReliability.length,0);
 assert.equal(mixed.skips.version,2);
});
