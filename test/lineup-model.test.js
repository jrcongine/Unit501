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
