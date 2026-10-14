'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {compare} = require('../injury-backtest');
const row = changes => ({league:'1',season:'2026',gameId:'100',teamId:'16',kind:'score',market:'points',modelVersion:'lineup-v1',evidenceUrl:'https://example.org/archived-report',kickoff:100000,forecastAt:90000,inputAsOf:80000,resultKnownAt:120000,baseline:25,adjusted:20,actual:19,...changes});
test('empty archives are insufficient, not zero error', () => {
 const out=compare([]);assert.equal(out.accepted,0);assert.equal(out.scores['1'].baselineMAE,null);assert.equal(out.scores['1'].status,'insufficient');
 assert.equal(out.scores['1'].baselineBias,null);assert.equal(out.scores['1'].adjustedBias,null);
});

test('signed bias distinguishes inflation from underprediction with equal game weighting',()=>{
 const prop=changes=>row({kind:'prop',market:'recYds',playerId:'1',baseline:30,adjusted:15,actual:20,...changes});
 const out=compare([prop(),prop({playerId:'2'}),prop({gameId:'101',baseline:0,adjusted:30}),prop({market:'rec',baseline:8,adjusted:2,actual:3}),prop({league:'2',baseline:100,adjusted:100})]);
 const yards=out.props['1'].recYds;
 assert.equal(yards.baselineBias,-5);assert.equal(yards.adjustedBias,2.5);
 assert.equal(yards.baselineMAE,15);assert.equal(yards.adjustedMAE,7.5);
 assert.equal(out.props['1'].rec.baselineBias,5);
 assert.equal(out.props['1'].rec.adjustedBias,-1);
 assert.equal(out.props['2'].recYds.baselineBias,80);
});

test('zero bias does not hide absolute misses or include pending outcomes',()=>{
 const out=compare([row({baseline:29,adjusted:24}),row({gameId:'101',baseline:9,adjusted:14}),row({gameId:'102',actual:null,resultKnownAt:null,baseline:999})]);
 const scores=out.scores['1'];
 assert.equal(scores.baselineBias,0);assert.equal(scores.adjustedBias,0);
 assert.equal(scores.baselineMAE,10);assert.equal(scores.adjustedMAE,5);
 assert.equal(scores.games,2);assert.equal(out.skips.pending,1);
});
test('reject late inputs, duplicate forecasts, invalid outcomes and mixed versions', () => {
 const out=compare([row(),row({gameId:'101',forecastAt:100000}),row({gameId:'102',inputAsOf:95000}),row({gameId:'103',actual:null}),row({gameId:'104'}),row({gameId:'104',adjusted:21})]);
 assert.equal(out.accepted,1);assert.deepEqual(out.skips,{pending:0,ambiguous:2,invalid:1,late:2,version:0});assert.equal(out.scores['1'].improvement,5);
 const mixed=[row(),row({gameId:'105',modelVersion:'v2'})];
 assert.equal(compare(mixed).accepted,0);assert.equal(compare(mixed.reverse()).skips.version,2);
 assert.equal(compare([row(),row({league:1})]).skips.ambiguous,2);
});
test('game weighting and league/market separation prevent crowded prop games dominating', () => {
 const prop=changes=>row({kind:'prop',market:'recYds',playerId:'1',baseline:10,adjusted:0,actual:0,...changes});
 const out=compare([prop(),prop({playerId:'2'}),prop({gameId:'101',baseline:0,adjusted:20}),prop({market:'rec',baseline:5,adjusted:2,actual:2}),prop({league:'2',baseline:100})]);
 assert.equal(out.props['1'].recYds.baselineMAE,5);assert.equal(out.props['1'].recYds.adjustedMAE,10);assert.equal(out.props['1'].rec.games,1);assert.equal(out.props['2'].recYds.baselineMAE,100);
});
test('30 distinct games only yield descriptive observed improvement; negative yards remain valid', () => {
 const rows=Array.from({length:30},(_,i)=>row({gameId:String(100+i),kind:'prop',market:'rushYds',playerId:'1',baseline:1,adjusted:-2,actual:-3}));
 const out=compare(rows);assert.equal(out.props['1'].rushYds.status,'lower-observed-error');assert.equal(out.props['1'].rushYds.improvement,3);
 assert.equal(compare(rows.slice(0,29)).props['1'].rushYds.status,'insufficient');
});

test('valid unfinished targets are pending while malformed pending forecasts remain invalid',()=>{
 const out=compare([row({actual:null,resultKnownAt:null}),row({gameId:'101',actual:null,resultKnownAt:null,baseline:null})]);
 assert.equal(out.skips.pending,1);assert.equal(out.skips.invalid,1);assert.equal(out.accepted,0);assert.equal(out.scores['1'].baselineMAE,null);
});

test('pending markets remain visible without inventing scored samples or zero errors',()=>{
 const pending=changes=>row({kind:'prop',market:'rushYds',playerId:'7',actual:null,resultKnownAt:null,...changes});
 const out=compare([pending(),pending({gameId:'101'}),pending({market:'rec'}),pending({league:'2'}),row(),row({gameId:'102',actual:null,resultKnownAt:null})]);
 const rush=out.props['1'].rushYds;
 assert.equal(rush.pending,2);assert.equal(rush.games,0);assert.equal(rush.pairs,0);
 for(const key of ['baselineMAE','adjustedMAE','baselineBias','adjustedBias','improvement'])assert.equal(rush[key],null);
 assert.equal(rush.status,'insufficient');assert.equal(out.props['1'].rec.pending,1);
 assert.equal(out.props['2'].rushYds.pending,1);
 assert.equal(out.scores['1'].pending,1);assert.equal(out.scores['1'].games,1);
 assert.equal(out.accepted,1);assert.equal(out.skips.pending,5);
});

test('invalid, duplicate and late pending targets cannot inflate market progress',()=>{
 const pending=changes=>row({kind:'prop',market:'carries',playerId:'7',actual:null,resultKnownAt:null,...changes});
 const out=compare([pending(),pending(),pending({gameId:'101',forecastAt:100000}),pending({gameId:'102',baseline:-1})]);
 assert.equal(out.skips.pending,0);assert.equal(out.skips.ambiguous,2);
 assert.equal(out.skips.late,1);assert.equal(out.skips.invalid,1);
 assert.deepEqual(out.props['1'],{});
});

test('miss diagnosis counts game averages, not each player target, and names biggest complete miss',()=>{
 const first=row({kind:'prop',market:'recYds',playerId:'1',actual:20,adjusted:30,baseline:40});
 const second=row({kind:'prop',market:'recYds',playerId:'2',actual:20,adjusted:10,baseline:10});
 const older=row({kind:'prop',market:'recYds',gameId:'101',playerId:'3',kickoff:100100,resultKnownAt:120100,actual:20,adjusted:25,baseline:25});
 const m=compare([first,second,older]).props['1'].recYds;
 assert.equal(m.games,2);
 assert.equal(m.pattern.highGames,1);assert.equal(m.pattern.lowGames,0);assert.equal(m.pattern.evenGames,1);
 assert.equal(m.pattern.recentMAE,7.5);
 assert.equal(m.pattern.recentGames,2);assert.equal(m.pattern.previousGames,0);
 assert.equal(m.pattern.tendency,'insufficient');
 assert.equal(m.pattern.worst.length,2);
 assert.equal(m.pattern.worst[0].absoluteMiss,10);
 assert.ok(new Set(m.pattern.worst.map(x=>x.gameId)).size===2);
});
test('market high and low watch only begins at 30 games and a 70% game-level fraction',()=>{
 const game=i=>row({gameId:String(1000+i),kickoff:100000+i,resultKnownAt:120000+i,
   baseline:20,actual:20,adjusted:i<21?26:19});
 const m=compare(Array.from({length:30},(_,i)=>game(i))).scores['1'];
 assert.equal(m.pattern.tendency,'mostly-high');
 assert.equal(m.pattern.highGames,21);assert.equal(m.pattern.lowGames,9);
 assert.equal(m.pattern.recentGames,10);assert.equal(m.pattern.previousGames,10);
 assert.equal(m.pattern.recentMAE,1.5);assert.equal(m.pattern.previousMAE,6);
 assert.equal(m.pattern.recentBias,-0.5);assert.equal(m.pattern.previousBias,6);
 assert.equal(compare(Array.from({length:29},(_,i)=>game(i))).scores['1'].pattern.tendency,'insufficient');
 const even=compare(Array.from({length:30},(_,i)=>game(i<15?i:100+i))).scores['1'];
 assert.equal(even.pattern.tendency,'mostly-high');
});
test('pending and rejected model-version targets never contribute to miss patterns',()=>{
 const p=row({kind:'prop',market:'carries',playerId:'5',actual:10,adjusted:15,baseline:15});
 const data=[p,row({kind:'prop',market:'carries',playerId:'6',gameId:'101',actual:null,resultKnownAt:null}),
 row({kind:'prop',market:'carries',playerId:'7',gameId:'102',modelVersion:'v2'})];
 const m=compare(data).props['1'].carries;
 assert.equal(m.games,0);assert.equal(m.pending,1);
 assert.equal(m.pattern.highGames,0);assert.equal(m.pattern.worst.length,0);
 assert.equal(m.pattern.recentMAE,null);
});
