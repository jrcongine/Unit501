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

test('review details keep source identities unresolved and group repeated teams by game',async()=>{
 const worker=createRosterMaintenance(async()=>({response:[game(2,1000),game(3,2000)]}),async()=>({
 current:true,rosterOwnership:{complete:true,conflicts:[{id:'99',teamIds:['1','5']},{id:'100',teamIds:['1','6']}]},
 teams:[{id:'1',roster:{available:true,rows:[{id:'99',name:'Named Player',position:'WR'}]},official:{available:true,unmatched:1,url:'https://www.nfl.com/injuries',unresolved:[{name:'Unmatched Player',position:'RB',status:'Out'}]},depth:{available:true,unmatched:1,unresolved:[{name:'Shared Cell',position:'WR',rank:2}]}}]
 }),()=>now);
 const report=await worker.run();assert.equal(report.gamesChecked,2);
 const injury=report.issues.find(i=>i.game==='2'&&i.reason.startsWith('Official'));
 assert.equal(injury.matchup,'Away at Home');assert.equal(injury.kickoff,now+1000);
 assert.equal(injury.players[0].name,'Unmatched Player');assert.equal(injury.players[0].id,undefined);
 const conflict=report.issues.find(i=>i.game==='3'&&i.reason.includes('ownership'));
 assert.equal(conflict.players[0].name,'Named Player');assert.equal(conflict.players[1].name,'Player ID 100');
 assert.deepEqual(conflict.players[0].teamIds,['1','5']);
});

 test('maintenance names unchecked teams and conflicting roster teams',async()=>{
 const worker=createRosterMaintenance(async()=>({response:[game(2,1000)]}),async()=>({current:true,rosterOwnership:{complete:false,checkedTeams:31,expectedTeams:32,failedTeams:[{id:'5',name:'Missing Club'}],teamNames:{'1':'Away','5':'Missing Club'},conflicts:[{id:'99',teamIds:['1','5']}]},teams:[{id:'1',roster:{available:true,rows:[{id:'99',name:'Player',position:'WR'}]},official:{available:true},depth:{available:true}}]}),()=>now);
 const report=await worker.run();
 assert.match(report.issues[0].reason,/31 of 32 teams checked/);
 assert.match(report.issues[0].reason,/Unchecked teams: Missing Club/);
 assert.deepEqual(report.issues[1].players[0].teamNames,['Away','Missing Club']);
 assert.deepEqual(report.issues[1].players[0].teamIds,['1','5']);
 });

test('review priorities surface ownership and unmatched Out without hiding depth gaps',async()=>{
 const worker=createRosterMaintenance(async()=>({response:[game(2,1000)]}),async()=>({current:true,rosterOwnership:{complete:true,conflicts:[{id:'99',teamIds:['1','5']}]},teams:[{id:'1',roster:{available:true,rows:[]},official:{available:true,unmatched:1,unresolved:[{name:'Unknown Receiver',status:'Out',position:'WR'}]},depth:{available:true,unmatched:1,unresolved:[{name:'Unknown Tackle',position:'LT'}]}}]}),()=>now);
 const report=await worker.run();
 assert.equal(report.issues.length,3);
 assert.equal(report.issues.find(i=>i.kind==='injury-identity').priority,1);
 assert.equal(report.issues.find(i=>i.kind==='ownership').priority,1);
 assert.equal(report.issues.find(i=>i.kind==='depth-identity').priority,3);
 assert.equal(report.issues.find(i=>i.kind==='depth-identity').players[0].name,'Unknown Tackle');
});
