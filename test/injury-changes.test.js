'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {compare,observations}=require('../public/injury-changes');
const one=status=>[{name:'Pat Example',id:'7',status}];
test('only explicit consecutive designations for a unique player can trigger a change',()=>{
 const baseline=compare(null,one('Questionable'),1);
 assert.deepEqual(baseline.changes,[]);
 const next=compare(baseline,one('OUT'),2);
 assert.deepEqual(next.changes.map(x=>[x.from,x.to]),[['Questionable','Out']]);
 assert.equal(compare(next,one('Out'),3).changes.length,1);
 assert.deepEqual(compare(next,[],3).changes,[]);
 assert.deepEqual(compare(next,[...one('Active'),...one('Out')],3).changes,[]);
 assert.deepEqual(compare(next,one('Unverified'),3).changes,[]);
 assert.deepEqual(compare(next,[{name:'Other Person',id:'7',status:'Active'}],3).changes,[]);
 assert.equal(compare(next,one('Probable'),1),null);
});
test('football requires fresh game-scoped report rows and team and player IDs',()=>{
 const game={id:1,league:'2',season:2026,kickoff:2000,awayId:'2',homeId:'3',a:'Away',h:'Home'};
 const src={available:true,gameId:'1',kickoff:2000,checkedAt:1000,rows:one('Out').map(p=>({...p,teamId:'2'}))};
 const report={current:true,teams:[{id:2,official:src}]};
 assert.equal(observations('2',game,report,1100)[0].players.length,1);
 src.gameId='99';assert.deepEqual(observations('2',game,report,1100),[]);
});
test('NBA and college compare verified reports on separate source and game identities',()=>{
 const game={id:1,awayId:2,homeId:3,tipoff:new Date(4e7).toISOString(),away:'Away',home:'Home'};
 const report={gameId:'1',tipoff:game.tipoff,reportAt:2000,checkedAt:2000,teams:[{available:true,name:'Away',players:one('Out')}]};
 for(const league of ['nba','ncaab']){
  assert.equal(observations(league,game,report,3000).length,1);
  assert.equal(observations(league,game,report,1e7).length,0);
  assert.equal(observations(league,game,{...report,gameId:99},3000).length,0);
 }
});
