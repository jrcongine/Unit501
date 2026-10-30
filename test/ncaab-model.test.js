'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {project,simulate}=require('../public/ncaab-model');
const now=Date.parse('2026-11-02T12:00:00Z'),game={id:'1',awayId:'2',homeId:'3',tipoff:'2026-11-03T00:00:00Z',status:'Scheduled',timeKnown:true};
const record={games:5,scored:80,allowed:70};
const data={gameId:'1',tipoff:game.tipoff,away:{id:'2',season:record,recentGames:Array.from({length:5},()=>({scored:80,allowed:70}))},home:{id:'3',season:record,recentGames:Array.from({length:5},()=>({scored:80,allowed:70}))}};
test('college baseline requires pregame verified teams and enough results',()=>{
 const p=project(game,data,'season',now);assert.equal(p.away,75);assert.equal(p.home,75);assert.equal(p.total,150);
 assert.equal(project({...game,timeKnown:false},data,'season',now).available,false);
 assert.equal(project(game,{...data,away:{...data.away,season:{...record,games:2}}},'season',now).available,false);
 assert.equal(project(game,data,'season',Date.parse(game.tipoff)).available,false);
});
test('college simulation records ties and pushes separately and requires recent samples',()=>{
 const p=project(game,data,'season',now),x=simulate(p,data,{spread:0,total:150},100,()=>0);
 assert.equal(x.tie,1);assert.equal(x.spreadPush,1);assert.equal(x.totalPush,1);
 assert.equal(simulate(p,{...data,away:{...data.away,recentGames:[]}}).available,false);
});
test('college estimates reject missing, nonnumeric and fractional sample counts',()=>{
 for(const games of [undefined,null,'5',3.5,NaN,Infinity]) {
  const invalid={...data,away:{...data.away,season:{...record,games}}};
  assert.equal(project(game,invalid,'season',now).available,false);
 }
});
test('college simulation cannot turn invalid scores or histories into tie probabilities',()=>{
 const p=project(game,data,'season',now);
 for(const away of [undefined,null,NaN,Infinity,-1])
  assert.equal(simulate({...p,away},data,{},10).available,false);
 assert.equal(simulate(p,data,{},10,null).available,false);
 const bad={...data,away:{...data.away,recentGames:Array.from({length:5},()=>({scored:-1,allowed:70}))}};
 assert.equal(simulate(p,bad,{},10).available,false);
});

test('known team-history gaps withhold college projections and simulations even with enough valid games',()=>{
 const p=project(game,data,'season',now);
 for(const side of ['away','home'])for(const field of ['unverifiedGames','conflicts']){
  const partial=structuredClone(data);partial[side][field]=1;
  assert.equal(project(game,partial,'season',now).available,false);
  assert.equal(simulate(p,partial).available,false);
 }
});
