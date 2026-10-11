'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {evaluate,adjustProp}=require('../public/lineup-model');
const game={id:'99',kickoff:90000};
const profile=(usage,efficiency)=>({usage,efficiency,games:4,latestMissing:false,coverage:{recorded:4,total:4}});
const players=[{id:'1',teamId:'10',name:'Starter',role:'RB',profiles:{rushing:profile(20,5),receiving:profile(3,8)}},{id:'2',teamId:'10',name:'Backup',role:'RB',profiles:{rushing:profile(5,3),receiving:profile(2,6)}}];
const scenario={teamId:'10',playerId:'1',replacementId:'2',confirmed:true,workload:0};
const context={teams:[{id:'10',games:4,metrics:{rushFor:{games:4,average:120},passFor:{games:4,average:240},pointsFor:{games:4,average:24}}}]};
test('transfers touches only, changes team efficiency, and leaves normal production intact',()=>{
 const r=evaluate(players,[scenario],context,game);assert.equal(r.applied,true);
 assert.equal(r.teams['10'].rushing,-40);assert.equal(r.teams['10'].receiving,-6);
 assert.ok(Math.abs(r.teams['10'].points-(-46*24/360*.5))<1e-12);
 assert.equal(adjustProp(100,'rushYds',r.props['10:1']),0);
 assert.equal(adjustProp(15,'rushYds',r.props['10:2']),75);
 assert.equal(adjustProp(5,'carries',r.props['10:2']),25);
 assert.equal(adjustProp(12,'recYds',r.props['10:2']),30);
 assert.equal(adjustProp(3,'rec',r.props['10:1']),0);
 assert.equal(adjustProp(1,'passTD',r.props['10:2']),1);
 assert.equal(evaluate(players,[],context,game).applied,false);
});
test('confirmation, valid roles, no chains and complete recent records are required',()=>{
 for(const s of [{...scenario,confirmed:false},{...scenario,replacementId:'1'},{...scenario,workload:NaN},{...scenario,workload:100}])assert.equal(evaluate(players,[s],context,game).applied,false);
 assert.equal(evaluate([players[0],{...players[1],teamId:'20'}],[scenario],context,game).applied,false);
 const stale=structuredClone(players);stale[1].profiles.rushing.latestMissing=true;stale[1].profiles.receiving.latestMissing=true;
 assert.equal(evaluate(stale,[scenario],context,game).applied,false);
 const chained=evaluate(players,[scenario,{...scenario,playerId:'2',replacementId:'1'}],context,game);assert.equal(chained.applied,false);
 const duplicate=evaluate(players,[scenario,scenario],context,game);assert.equal(duplicate.details.length,2);
});
test('better replacements raise output only for transferred workload and score change is capped',()=>{
 const better=structuredClone(players);better[1].profiles.rushing.efficiency=9;
 const r=evaluate(better,[{...scenario,workload:50}],context,game);
 assert.equal(r.teams['10'].rushing,40);assert.equal(adjustProp(100,'rushYds',r.props['10:1']),50);
 const enormous=structuredClone(players);enormous[1].profiles.rushing.efficiency=1000;
 assert.equal(evaluate(enormous,[scenario],context,game).teams['10'].points,8);
});
test('without complete team yardage, props change but team scores stay unchanged',()=>{
 const r=evaluate(players,[scenario],null,game);assert.equal(r.teams['10'].points,0);assert.equal(r.applied,true);assert.ok(r.withheld.length);
});
test('partial replacement shares add only assigned touches and withhold incomplete team impact',()=>{
 const r=evaluate(players,[{...scenario,replacementShare:50}],context,game);
 assert.equal(adjustProp(100,'rushYds',r.props['10:1']),0);
 assert.equal(adjustProp(5,'carries',r.props['10:2']),15);
 assert.equal(adjustProp(15,'rushYds',r.props['10:2']),45);
 assert.equal(r.details[0].unassignedUsage,10);
 assert.equal(r.teams['10'].points,0);assert.match(r.withheld.join(' '),/no assigned replacement/);
 for(const replacementShare of [-1,101,NaN,'50'])assert.equal(evaluate(players,[{...scenario,replacementShare}],context,game).applied,false);
});
test('missing receiving replacement data preserves rushing props but withholds partial team valuation',()=>{
 const sparse=structuredClone(players);delete sparse[1].profiles.receiving;
 const r=evaluate(sparse,[scenario],context,game);
 assert.equal(r.applied,true);assert.equal(adjustProp(5,'carries',r.props['10:2']),25);
 assert.equal(r.props['10:2'].receiving,undefined);assert.equal(r.teams['10'].points,0);
 assert.match(r.withheld.join(' '),/coverage is incomplete/);
});
test('a zero-valued complete scenario is distinguished from a withheld score',()=>{
 const equal=structuredClone(players);equal[1].profiles=structuredClone(equal[0].profiles);
 const r=evaluate(equal,[scenario],context,game);assert.equal(r.teams['10'].points,0);assert.equal(r.teams['10'].scoreReady,true);
 const incomplete=evaluate(players,[scenario],null,game);assert.equal(incomplete.teams['10'].scoreReady,false);
});

const {recommend}=require('../public/lineup-model'),{assess}=require('../public/injury-model');
function replacementFixture(){
 const now=1000,rows=[...structuredClone(players),{id:'3',teamId:'10',name:'Third RB',role:'RB',profiles:{rushing:profile(15,4),receiving:profile(2,7)}}].map(p=>({...p,position:'RB'}));
 const team={id:'10',roster:{available:true,checkedAt:now,rows:rows.map(p=>({id:p.id,name:p.name,position:p.position}))},injuries:{available:true,checkedAt:now,rows:[{id:'1',status:'Out',date:new Date(now).toISOString()}]},depth:{available:true,checkedAt:now,gameId:game.id,kickoff:game.kickoff,url:'https://example.com/depth',rows:rows.map((p,i)=>({id:p.id,position:'RB',rank:i+1,slot:'RB:0'}))}};
 return {now,rows,data:{current:true,teams:[team]},team};
}
test('estimated committee workload is conserved per category and requires review before applying',()=>{
 const f=replacementFixture(),r=recommend(f.rows,f.rows[0],f.data,game,assess,f.now);
 assert.equal(r.state,'estimated');assert.equal(r.candidates.length,2);
 assert.equal(r.candidates[0].roleState,'estimated');assert.equal(r.candidates[0].usage.rushing.share,25);assert.equal(r.candidates[1].usage.rushing.share,75);
 assert.equal(r.candidates[0].usage.receiving.share,50);
 const s={...scenario,allocations:r.allocations};
 assert.equal(evaluate(f.rows,[{...s,confirmed:false}],context,game).applied,false);
 const result=evaluate(f.rows,[s],context,game);
 assert.equal(result.props['10:2'].rushing.extraUsage,5);assert.equal(result.props['10:3'].rushing.extraUsage,15);
 assert.equal(result.props['10:2'].receiving.extraUsage,1.5);assert.equal(result.props['10:3'].receiving.extraUsage,1.5);
 assert.equal(result.teams['10'].scoreReady,true);assert.ok(result.details.every(d=>d.unassignedUsage===0));
 const oversized=structuredClone(s);oversized.allocations[0].shares.rushing=90;
 assert.equal(evaluate(f.rows,[oversized],context,game).applied,false);
 const repeated=structuredClone(s);repeated.allocations.push(repeated.allocations[0]);assert.equal(evaluate(f.rows,[repeated],context,game).applied,false);
});
test('missing usage stays unknown; stale depth and conflicting absence reports do not produce estimates',()=>{
 const f=replacementFixture();delete f.rows[2].profiles.receiving;
 const r=recommend(f.rows,f.rows[0],f.data,game,assess,f.now);
 assert.ok(r.candidates.every(p=>p.usage.receiving===undefined));
 const result=evaluate(f.rows,[{...scenario,allocations:r.allocations}],context,game);
 assert.equal(result.applied,true);assert.equal(result.teams['10'].scoreReady,false);assert.equal(result.props['10:2'].receiving,undefined);
 f.team.depth.checkedAt=f.now-3600001;assert.equal(recommend(f.rows,f.rows[0],f.data,game,assess,f.now).allocations.length,0);
 f.team.depth.checkedAt=f.now;f.team.injuries.rows.push({...f.team.injuries.rows[0],status:'Active'});
 assert.equal(recommend(f.rows,f.rows[0],f.data,game,assess,f.now).allocations.length,0);
});
test('replacement suggestions exclude unavailable players and confirm only announced roles, not usage',()=>{
 const f=replacementFixture();f.team.injuries.rows.push({id:'2',status:'Out',date:new Date(f.now).toISOString()});
 const rb=recommend(f.rows,f.rows[0],f.data,game,assess,f.now);assert.deepEqual(rb.candidates.map(p=>p.id),['3']);
 for(const p of f.rows){p.role='QB';p.position='QB';p.profiles={passing:profile(30,7)};}
 for(const p of f.team.roster.rows)p.position='QB';
 f.team.starters={gameId:game.id,kickoff:game.kickoff,checkedAt:f.now,rows:[{id:'3',position:'QB',publishedAt:new Date(f.now).toISOString(),url:'https://example.com/announcement'}]};
 const qb=recommend(f.rows,f.rows[0],f.data,game,assess,f.now);assert.equal(qb.candidates[0].roleState,'confirmed');assert.equal(qb.candidates[0].workloadState,'estimated');assert.equal(qb.candidates[0].source,'https://example.com/announcement');
});

test('receiver recommendations follow their own chart slot and ignore returner listings',()=>{
 const f=replacementFixture();for(const p of f.rows){p.role='WR';p.position='WR';}
 for(const p of f.team.roster.rows)p.position='WR';
 f.team.depth.rows=[{id:'1',position:'WR',rank:1,slot:'WR:0'},{id:'2',position:'WR',rank:2,slot:'WR:0'},{id:'3',position:'WR',rank:2,slot:'WR:1'},{id:'1',position:'KR',rank:1,slot:'KR:0'}];
 assert.deepEqual(recommend(f.rows,f.rows[0],f.data,game,assess,f.now).candidates.map(p=>p.id),['2']);
});

test('QB replacement inherits the passing role instead of adding earlier backup appearances',()=>{
 const f=replacementFixture();for(const p of f.rows){p.role='QB';p.position='QB';p.profiles={passing:profile(p.id==='1'?30:12,p.id==='1'?7:6)};}
 for(const p of f.team.roster.rows)p.position='QB';
 f.team.starters={gameId:game.id,kickoff:game.kickoff,checkedAt:f.now,rows:[{id:'2',position:'QB',publishedAt:new Date(f.now).toISOString()}]};
 const r=recommend(f.rows,f.rows[0],f.data,game,assess,f.now);
 assert.equal(r.candidates[0].usage.passing.total,30);assert.equal(r.candidates[0].usage.passing.extra,18);
 const result=evaluate(f.rows,[{...scenario,allocations:r.allocations}],context,game);
 assert.equal(adjustProp(12,'attempts',result.props['10:2']),30);
 assert.equal(adjustProp(72,'passYds',result.props['10:2']),180);
 assert.equal(adjustProp(1,'passTD',result.props['10:2']),1);
 assert.equal(result.teams['10'].passing,-30);
});
