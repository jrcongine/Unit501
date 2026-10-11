'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {compare} = require('../injury-backtest');
const row = changes => ({league:'1',season:'2026',gameId:'100',teamId:'16',kind:'score',market:'points',modelVersion:'lineup-v1',evidenceUrl:'https://example.org/archived-report',kickoff:100000,forecastAt:90000,inputAsOf:80000,resultKnownAt:120000,baseline:25,adjusted:20,actual:19,...changes});
test('empty archives are insufficient, not zero error', () => {
 const out=compare([]);assert.equal(out.accepted,0);assert.equal(out.scores['1'].baselineMAE,null);assert.equal(out.scores['1'].status,'insufficient');
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
