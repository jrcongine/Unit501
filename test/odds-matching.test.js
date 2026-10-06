const {test}=require('node:test');
const assert=require('node:assert/strict');
const {teamMatches,matches,missingMatchMessage}=require('../odds-matching');
const {selectLines}=require('../fanduel');
const now=Date.now();
const q={away:'Southern Miss',home:'Troy',league:'2',kickoff:now+86400000};
const e={away_team:'Southern Mississippi Golden Eagles',home_team:'Troy Trojans',commence_time:new Date(q.kickoff).toISOString(),bookmakers:[{key:'fanduel',last_update:new Date(now).toISOString(),markets:[{key:'spreads',outcomes:[{name:'Southern Mississippi Golden Eagles',point:7.5}]},{key:'totals',outcomes:[{name:'Over',point:48.5},{name:'Under',point:48.5}]}]}]};
test('Southern Miss aliases match for game odds and player props',()=>{
 for(const name of ['Southern Miss','Southern Mississippi','Southern Miss Golden Eagles','Southern Mississippi Golden Eagles']) assert.equal(matches({...e,away_team:name},q),true);
 assert.equal(require('../fanduel-props').matches(e,q),true);
 const result=selectLines([e],q,now);
 assert.equal(result.awaySpread,7.5);assert.equal(result.total,48.5);
});
test('different schools, reversed home/away, kickoff mismatch and NFL aliases are rejected',()=>{
 for(const [a,b] of [['Virginia Tech Hokies','Virginia'],['Ohio State Buckeyes','Ohio'],['Southern Methodist','Southern Miss'],['Miami (OH)','Miami (FL)']]) assert.equal(teamMatches(a,b,true),false);
 assert.equal(teamMatches('Southern Mississippi','Southern Miss',false),false);
 assert.equal(matches({...e,away_team:e.home_team,home_team:e.away_team},q),false);
 assert.equal(matches(e,{...q,kickoff:q.kickoff+10800000}),false);
});
test('ambiguous and stale markets remain unavailable; reasons distinguish missing and time mismatches',()=>{
 assert.equal(selectLines([e,e],q,now).available,false);
 assert.equal(selectLines([e],q,now+1800001).available,false);
 assert.match(missingMatchMessage([e,e],q),/Multiple/);
 assert.match(missingMatchMessage([e],{...q,kickoff:q.kickoff+86400000}),/kickoff differs/);
 assert.match(missingMatchMessage([],q),/not found/);
});
