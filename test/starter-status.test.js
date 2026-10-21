'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {starterStatus,assess}=require('../public/injury-model');
const now=Date.parse('2026-10-21T19:00:00Z');
function fixture(){
 const game={id:'game',league:'2',season:'2026',kickoff:now+86400000};
 const row={id:'qb2',name:'New Starter',position:'QB',teamId:'team',publishedAt:new Date(now-1000).toISOString(),sourceCheckedAt:now,publisher:'Official team'};
 const team={id:'team',roster:{available:true,checkedAt:now,rows:[{id:'qb1',position:'QB'},{id:'qb2',position:'QB'}]},injuries:{available:true,checkedAt:now,rows:[]},starters:{gameId:game.id,league:game.league,season:game.season,kickoff:game.kickoff,checkedAt:now,rows:[row]}};
 return {game,row,team,data:{current:true,teams:[team]}};
}
test('same starter across articles confirms one role, conflicts withhold QB props',()=>{
 const f=fixture(),read=()=>starterStatus(f.data,f.game,'team',now);
 f.team.starters.rows.push({...f.row,url:'https://example.com/corroboration'});
 assert.equal(read().state,'confirmed');assert.equal(read().rows.length,1);
 assert.equal(assess(f.data,f.game,'team','qb1',now,true).state,'nonstarter');
 assert.equal(assess(f.data,f.game,'team','qb2',now,true).blocked,false);
 f.team.starters.rows.push({...f.row,id:'qb1'});
 assert.equal(read().state,'conflict');
 for(const id of ['qb1','qb2'])assert.equal(assess(f.data,f.game,'team',id,now,true).state,'conflict');
});
test('starter evidence is game scoped, fresh and uniquely roster matched',()=>{
 for(const mutate of [f=>f.team.starters.gameId='other',f=>f.team.starters.kickoff++,f=>f.team.starters.season='2025',f=>f.team.starters.league='1',f=>f.team.starters.checkedAt=now-900001,f=>f.team.roster.checkedAt=now-3600001,f=>f.row.publishedAt=new Date(now+1000).toISOString(),f=>f.row.publishedAt=new Date(now-8*86400000).toISOString(),f=>f.game.kickoff=now-1]){
  const f=fixture();mutate(f);assert.equal(starterStatus(f.data,f.game,'team',now).state,'unknown');
 }
 for(const mutate of [f=>f.row.id='missing',f=>f.row.teamId='other',f=>f.row.sourceCheckedAt=now-900001,f=>f.team.starters.unverified=1,f=>f.team.roster.rows.push({...f.team.roster.rows[1]})]){
  const f=fixture();mutate(f);assert.equal(starterStatus(f.data,f.game,'team',now).state,'unresolved');
 }
});
test('a starter announcement does not clear a current injury',()=>{
 const f=fixture();f.team.injuries.rows=[{id:'qb2',status:'Out',date:new Date(now).toISOString()}];
 assert.equal(starterStatus(f.data,f.game,'team',now).state,'confirmed');
 assert.equal(assess(f.data,f.game,'team','qb2',now,true).state,'unavailable');
});
