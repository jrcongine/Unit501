const {test}=require('node:test');
const assert=require('node:assert/strict');
const {validate}=require('../public/player-backtest');
const {project}=require('../public/player-form');
const rows=values=>values.map((recYds,i)=>({gameDate:(i+1)*604800,recYds,rec:5}));
test('replays actual production formula and compares identical eligible games with mean',()=>{
 const history=rows([20,40,80,0,-5]);const result=validate(history,'recYds');
 assert.equal(result.count,3);assert.equal(result.insufficient,2);
 assert.equal(result.records[0].prediction,project(history.slice(0,2),'recYds').baseline);
 assert.equal(result.records[0].meanPrediction,30);
 assert.equal(result.records[2].actual,-5);
 assert.ok(Number.isFinite(result.mae));
});
test('future outcomes cannot change earlier predictions or training inputs',()=>{
 const history=rows([20,40,80,100,200]);const first=validate(history,'recYds');
 history[4].recYds=9000;
 assert.deepEqual(validate(history,'recYds').records.slice(0,2),first.records.slice(0,2));
});
test('overlapping and exact one-day earlier kickoffs are excluded',()=>{
 const history=rows([20,40,80]);history.push({gameDate:history[2].gameDate-100,recYds:999,rec:1},{gameDate:history[2].gameDate-86400,recYds:888,rec:1});
 const target=validate(history,'recYds').records.find(r=>r.gameDate===history[2].gameDate);
 assert.equal(target.priorRecorded,2);assert.equal(target.prediction,30);
});
test('missing actual stats stay missing; consecutive missing history withholds',()=>{
 const result=validate(rows([20,40,undefined,undefined,80]),'recYds');
 assert.equal(result.missingActual,2);assert.equal(result.withheld,1);assert.equal(result.count,0);
 assert.equal(validate(rows([20,40,0]),'recYds').records[0].actual,0);
});
test('duplicate dated rows are withheld from targets and history',()=>{
 const history=rows([20,40,80]);history.push({...history[1],recYds:900});
 const result=validate(history,'recYds');assert.equal(result.ambiguous,2);assert.equal(result.count,0);
});

test('range requires enough chronological errors and excludes target and future results',()=>{
 const {range}=require('../public/player-backtest');
 assert.equal(range(rows([20,40,60]),'recYds',4*604800).available,false);
 const history=rows(Array.from({length:12},(_,i)=>20+i*10));const before=13*604800;
 const r=range(history,'recYds',before);assert.equal(r.available,true);assert.equal(r.count,10);assert.ok(r.low<=r.high);
 const withFuture=[...history,{gameDate:before,recYds:9999,rec:1},{gameDate:before+604800,recYds:8888,rec:1}];
 assert.deepEqual(range(withFuture,'recYds',before),r);
 assert.deepEqual(range([...history,{gameDate:before-86400,recYds:7777,rec:1}], 'recYds',before),r);
 assert.equal(range(history,'recYds',NaN).available,false);
});
test('range retains negative yardage, floors count stats at zero and avoids duplicate-date baselines',()=>{
 const {range}=require('../public/player-backtest');
 const history=rows(Array.from({length:14},(_,i)=>i%2?-20:0));const before=15*604800;
 assert.ok(range(history,'recYds',before).low<0);
 const counts=history.map(g=>({...g,rec:0}));assert.equal(range(counts,'rec',before).low,0);
 const duplicated=[...history,{...history[0],recYds:9999}];
 assert.equal(range(duplicated,'recYds',before).available,false);
 assert.equal(range(history.slice(1),'recYds',before).available,true);
});

test('range coverage replays the displayed formula with strictly earlier training errors',()=>{
 const {range,validateRanges}=require('../public/player-backtest');
 const history=rows(Array.from({length:18},(_,i)=>i%3===0?120:20+i*2));
 const audit=validateRanges(history,'recYds',19*604800);
 assert.equal(audit.count,6);
 for(const r of audit.records){
  const expected=range(history,'recYds',r.gameDate);
  assert.equal(r.low,expected.low);assert.equal(r.high,expected.high);
  assert.equal(r.trainingErrors,expected.count);
  assert.equal(r.covered,r.actual>=r.low&&r.actual<=r.high);
 }
 assert.equal(audit.covered+audit.below+audit.above,audit.count);
 assert.equal(audit.coverage,audit.covered/audit.count);
 assert.ok(audit.meanWidth>=0);
});
test('range evaluation excludes target, future and one-day boundary results',()=>{
 const {validateRanges}=require('../public/player-backtest');
 const history=rows(Array.from({length:16},(_,i)=>i*10)),before=17*604800;
 const first=validateRanges(history,'recYds',before);
 const extra=[...history,{gameDate:before-86400,recYds:9999},{gameDate:before,recYds:9999},{gameDate:before+604800,recYds:9999}];
 assert.deepEqual(validateRanges(extra,'recYds',before),first);
 history[15].recYds=9000;
 assert.deepEqual(validateRanges(history,'recYds',before).records.slice(0,-1),first.records.slice(0,-1));
 const last=validateRanges(history,'recYds',before).records.at(-1);
 assert.equal(last.low,first.records.at(-1).low);assert.equal(last.high,first.records.at(-1).high);
});
test('range evaluation keeps insufficient, missing and duplicate outcomes out of accuracy',()=>{
 const {validateRanges}=require('../public/player-backtest');
 const empty=validateRanges(rows(Array(12).fill(20)),'recYds',13*604800);
 assert.equal(empty.count,0);assert.equal(empty.coverage,null);assert.equal(empty.meanWidth,null);
 assert.equal(validateRanges([], 'recYds',NaN).available,false);
 const history=rows(Array(16).fill(20));history[13].recYds=undefined;
 history.push({...history[14]});
 const audit=validateRanges(history,'recYds',17*604800);
 assert.ok(audit.records.every(r=>r.gameDate!==history[13].gameDate&&r.gameDate!==history[14].gameDate));
 assert.ok(audit.records.every(r=>Number.isFinite(r.actual)));
});
test('range coverage retains negative yards and floors count ranges at zero',()=>{
 const {validateRanges}=require('../public/player-backtest');
 const history=rows(Array.from({length:16},(_,i)=>i%2?-20:0));
 assert.ok(validateRanges(history,'recYds',17*604800).records.some(r=>r.low<0));
 const audit=validateRanges(history.map(g=>({...g,rec:0})),'rec',17*604800);
 assert.equal(audit.coverage,1);assert.ok(audit.records.every(r=>r.low===0&&r.high===0));
});
test('earlier duplicate dates block later replay and ranges instead of shrinking the training history',()=>{
 const {range,validateRanges}=require('../public/player-backtest');
 const history=rows(Array(18).fill(20)),duplicate={...history[4],recYds:0},result=validate([...history,duplicate],'recYds');
 assert.equal(result.ambiguous,2);assert.equal(result.count,2);assert.ok(result.withheld>0);
 assert.ok(result.records.every(r=>r.gameDate<duplicate.gameDate));
 assert.equal(range([...history,duplicate],'recYds',19*604800).available,false);
 assert.equal(validateRanges([...history,duplicate],'recYds',19*604800).count,0);
 assert.deepEqual(result.records,validate(history,'recYds').records.filter(r=>r.gameDate<duplicate.gameDate));
});
