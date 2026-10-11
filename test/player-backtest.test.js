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
