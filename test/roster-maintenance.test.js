'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createRosterMaintenance}=require('../roster-maintenance');
const now=Date.parse('2026-10-11T23:00:00Z');
const game=(id,offset)=>({game:{id,date:{timestamp:(now+offset)/1000}},league:{id:1,season:2026},teams:{away:{id:1,name:'Away'},home:{id:2,name:'Home'}}});
test('background sweep restricts games, shares concurrent work and flags unknown reports',async()=>{
 let calls=0;
 const worker=createRosterMaintenance(async()=>({response:[game(1,-1000),game(2,1000),game(2,1000),game(3,8*86400000)]}),async q=>{calls++;assert.equal(q.game,'2');return {current:true,teams:[{id:'1',roster:{available:true},official:{available:true,unmatched:2},depth:{available:false}}],rosterOwnership:{complete:true,conflicts:[{id:'99',teamIds:['1','5']}]}};},()=>now);
 const [a,b]=await Promise.all([worker.run(),worker.run()]);assert.equal(calls,1);assert.deepEqual(a,b);assert.equal(a.gamesChecked,1);assert.equal(a.issues.length,3);assert.equal(a.lastCompleted,now);assert.equal(a.running,false);
});
test('failed schedule never becomes a successful check and can retry',async()=>{
 let failed=true,calls=0;const worker=createRosterMaintenance(async()=>{if(failed)throw Error('offline');return {response:[]};},async()=>{calls++;},()=>now);
 assert.equal((await worker.run()).lastCompleted,null);failed=false;assert.equal((await worker.run()).lastCompleted,now);assert.equal(calls,0);
});
test('January sweep uses the preceding NFL season and refuses paginated schedules',async()=>{
 const worker=createRosterMaintenance(async path=>{assert.match(path,/season=2026/);return {response:[],paging:{total:2}};},async()=>{throw Error('should not run');},()=>Date.parse('2027-01-10T12:00:00Z'));
 const state=await worker.run();assert.equal(state.lastCompleted,null);assert.match(state.message,/incomplete/);
});
