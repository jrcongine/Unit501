'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {accumulate,definitions}=require('../public/player-stats');
const {project,summarize}=require('../public/player-form');
test('rush attempts and running-back receiving markets use recorded stats, without position filtering',()=>{
  const map=new Map();
  const box={team:{id:1,name:'Team A'},groups:[
    {name:'Rushing',players:[{player:{id:7,name:'RB'},statistics:[{name:'Total Rushes',value:'22'},{name:'Yards',value:'98'}]}]},
    {name:'Receiving',players:[{player:{id:7,name:'RB'},statistics:[{name:'Receptions',value:'4'},{name:'Yards',value:'23'}]}]}
  ]};
  accumulate(map,box,'1',100,'Opponent');
  const p=map.get('1:7');assert.equal(p.playerId,'7');
  assert.deepEqual(p.games.get('1'),{gameDate:100,opponent:'Opponent',carries:22,rushYds:98,rec:4,recYds:23});
  assert.ok(definitions.some(d=>d.key==='carries'));
});
test('a player trade keeps both team histories separate',()=>{
  const map=new Map();
  const box=id=>({team:{id,name:'Team '+id},groups:[{name:'Rushing',players:[{player:{id:7,name:'RB'},statistics:[{name:'Carries',value:10}]}]}]});
  accumulate(map,box(1),'1',100,'Other');accumulate(map,box(2),'2',200,'Other');
  assert.equal(map.size,2);assert.equal(map.get('1:7').games.size,1);assert.equal(map.get('2:7').games.size,1);
});
test('usage and typical efficiency reduce a one-game receiving spike without inventing zero games',()=>{
  const rows=[{gameDate:5,rec:5,recYds:200},...Array.from({length:4},(_,i)=>({gameDate:4-i,rec:5,recYds:50}))];
  const p=project(rows,'recYds');
  assert.ok(p.baseline<p.weighted);assert.equal(p.usage.workload,5);assert.equal(p.usage.games,5);
  assert.equal(p.baseline,65);
  assert.equal(project([{gameDate:1,recYds:10},{gameDate:2,recYds:20}],'recYds').usage,null);
});
test('yardage losses are valid results and sparse paired usage falls back to form',()=>{
  assert.deepEqual(summarize([{gameDate:1,rushYds:-5},{gameDate:2,rushYds:0}],'rushYds').values,[0,-5]);
  const rows=[{gameDate:1,rushYds:30,carries:5},{gameDate:2,rushYds:40}];
  assert.equal(project(rows,'rushYds').baseline,summarize(rows,'rushYds').weighted);
});
