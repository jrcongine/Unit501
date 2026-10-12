'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createVerifiedOwnership,parseRoster}=require('../verified-ownership');
const {assess}=require('../public/injury-model');
const now=Date.parse('2026-10-12T02:00:00Z'),q={league:'1',season:'2026'};
function page(include){return '<table><tr><th>Player</th><th>#</th><th>Pos</th></tr>'+Array.from({length:40},(_,i)=>'<tr><td>Placeholder '+i+'</td><td>1</td><td>WR</td></tr>').join('')+(include?'<tr><td>Cody White</td><td>82</td><td>WR</td></tr>':'')+'</table>';}
const conflicts=[{id:'2733',teamIds:['1','23']}],reports=['1','23'].map(id=>({id,rows:[{id:2733,name:'Cody White',position:'WR'}]})),names=new Map([['1','Las Vegas Raiders'],['23','Seattle Seahawks']]);
test('reviewed ownership needs unique current official presence and every conflicting source',async()=>{
 const verify=createVerifiedOwnership(()=>now,async url=>page(url.includes('raiders')));
 const rows=await verify(q,conflicts,reports,names);assert.equal(rows.length,1);assert.equal(rows[0].teamId,'1');assert.equal(rows[0].sources.length,2);
 for(const fetcher of [async()=>page(true),async()=>page(false),async()=>'<table></table>',async()=>{throw Error('offline');}]){
  assert.equal((await createVerifiedOwnership(()=>now,fetcher)(q,conflicts,reports,names)).length,0);
 }
 assert.equal((await verify({...q,season:'2025'},conflicts,reports,names)).length,0);
 assert.equal((await verify(q,conflicts,[{...reports[0],rows:[{id:2733,name:'Different Person',position:'WR'}]},reports[1]],names)).length,0);
 assert.equal((await createVerifiedOwnership(()=>now+8*86400000,async()=>page(true))(q,conflicts,reports,names)).length,0);
 assert.throws(()=>parseRoster('<table></table>'));
});
test('resolved destination still honors injury gates; former team blocked and stale resolution restores conflict',async()=>{
 const resolutions=await createVerifiedOwnership(()=>now,async url=>page(url.includes('raiders')))(q,conflicts,reports,names);
 const data={current:true,rosterOwnership:{available:true,...q,checkedAt:now,conflicts,resolutions},teams:reports.map(t=>({id:t.id,roster:{available:true,checkedAt:now,rows:t.rows},injuries:{available:true,checkedAt:now,rows:[]}}))};
 const game={id:'10',...q,kickoff:now+86400000};
 assert.equal(assess(data,game,'23','2733',now,true).state,'team-unconfirmed');
 assert.equal(assess(data,game,'1','2733',now,true).blocked,false);
 data.teams[0].inactives={available:true,...q,gameId:'10',kickoff:game.kickoff,checkedAt:now,rows:[{id:'2733',teamId:'1',status:'Inactive'}]};
 assert.equal(assess(data,game,'1','2733',now,true).state,'unavailable');
 data.rosterOwnership.resolutions[0].checkedAt=now-3600001;
 assert.equal(assess(data,game,'1','2733',now,true).state,'conflict');
});
