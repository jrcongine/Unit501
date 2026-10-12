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
