'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createRosterOwnership}=require('../roster-ownership');
const {assess}=require('../public/injury-model');
const q={league:'1',season:'2026'};
function reader(calls,fail=false){return async path=>{
 calls.push(path);if(path.startsWith('/games'))return {checkedAt:1000,rows:Array.from({length:16},(_,i)=>({league:{id:1,season:2026},game:{stage:'Regular Season'},teams:{away:{id:i*2+1,name:'Club '+(i*2+1)},home:{id:i*2+2,name:'Club '+(i*2+2)}}}))};
 const id=Number(new URL(path,'https://example.org').searchParams.get('team'));if(fail&&id===32)throw Error('missing');
 return {checkedAt:1000,rows:[{id:id===1||id===7?99:id+100,name:'Player'}]};
};}
test('all NFL rosters share concurrent reads and cross-matchup duplicate ownership blocks props',async()=>{
 const calls=[],get=createRosterOwnership(reader(calls),()=>1000),[a,b]=await Promise.all([get(q),get(q)]);
 assert.deepEqual(a,b);assert.equal(calls.length,33);assert.equal(a.complete,true);assert.deepEqual(a.conflicts,[{id:'99',teamIds:['1','7']}]);
 const game={id:'9',league:'1',season:'2026',kickoff:100000};
 const data={current:true,rosterOwnership:a,teams:[{id:'1',roster:{available:true,checkedAt:1000,rows:[{id:'99',position:'WR'}]},injuries:{available:true,checkedAt:1000,rows:[]}}]};
 assert.equal(assess(data,game,'1','99',1000,true).state,'conflict');assert.equal(assess(data,game,'1','99',1000,true).blocked,true);
 assert.notEqual(assess({...data,rosterOwnership:{...a,season:'2025'}},game,'1','99',1000,true).state,'conflict');
 assert.notEqual(assess({...data,rosterOwnership:{...a,checkedAt:1001}},game,'1','99',1000,true).state,'conflict');
 const expired=structuredClone(data);for(const t of expired.teams){t.roster.checkedAt=3601001;t.injuries.checkedAt=3601001;}
 assert.notEqual(assess(expired,{...game,kickoff:100000000},'1','99',3601001,true).state,'conflict');
 await get(q);assert.equal(calls.length,33);
});
test('partial ownership still catches positive conflicts without claiming complete coverage',async()=>{
 const out=await createRosterOwnership(reader([],true),()=>1000)(q);assert.equal(out.complete,false);assert.equal(out.checkedTeams,31);assert.equal(out.conflicts.length,1);assert.deepEqual(out.failedTeams,[{id:'32',name:'Club 32'}]);assert.equal(out.teamNames['7'],'Club 7');
 const bad=await createRosterOwnership(async()=>({rows:[],checkedAt:1000}),()=>1000)(q);assert.equal(bad.available,false);assert.equal(bad.conflicts.length,0);
});
