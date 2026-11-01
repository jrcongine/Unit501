const {test}=require('node:test');
const assert=require('node:assert/strict');
const {teamMatches,matches,missingMatchMessage}=require('../odds-matching');
const {selectLines}=require('../fanduel');
const now=Date.now();
const q={away:'Southern Miss',home:'Troy',league:'2',kickoff:now+86400000};
const e={away_team:'Southern Mississippi Golden Eagles',home_team:'Troy Trojans',commence_time:new Date(q.kickoff).toISOString(),bookmakers:[{key:'fanduel',last_update:new Date(now).toISOString(),markets:[{key:'spreads',outcomes:[{name:'Southern Mississippi Golden Eagles',point:7.5},{name:'Troy Trojans',point:-7.5}]},{key:'totals',outcomes:[{name:'Over',point:48.5},{name:'Under',point:48.5}]}]}]};
test('Southern Miss aliases match for game odds and player props',()=>{
 for(const name of ['Southern Miss','Southern Mississippi','Southern Miss Golden Eagles','Southern Mississippi Golden Eagles']) assert.equal(matches({...e,away_team:name},q),true);
 assert.equal(require('../fanduel-props').matches(e,q),true);
 const result=selectLines([e],q,now);
 assert.equal(result.awaySpread,7.5);assert.equal(result.total,48.5);
});
test('game prices stay paired to their market and absent prices remain unknown',()=>{
 const event=structuredClone(e),markets=event.bookmakers[0].markets;
 markets[0].outcomes[0].price=-105;markets[0].outcomes[1].price=-115;
 markets[1].outcomes[0].price=110;markets[1].outcomes[1].price=-130;
 assert.deepEqual(selectLines([event],q,now).prices,{away:-105,home:-115,over:110,under:-130});
 markets[0].outcomes[1].point=-8.5;
 assert.equal(selectLines([event],q,now).prices.home,null);
 assert.deepEqual(selectLines([e],q,now).prices,{away:null,home:null,over:null,under:null});
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
test('encoded Hawaii apostrophe matches the same school for game and prop odds',()=>{
 const query={away:'Hawai&#x27;i',home:'Arizona State',league:'2',kickoff:q.kickoff};
 const event={away_team:"Hawai'i Rainbow Warriors",home_team:'Arizona State Sun Devils',commence_time:new Date(q.kickoff).toISOString()};
 assert.equal(matches(event,query),true);
 assert.equal(require('../fanduel-props').matches(event,query),true);
 assert.equal(teamMatches('Hawai&#39;i','Hawaii',true),true);
 assert.equal(teamMatches('Hawai&#x27;i','Arizona State',true),false);
});
test('Sam Houston State Bearkats odds match Sam Houston against Missouri State',()=>{
 const query={away:'Sam Houston',home:'Missouri State',league:'2',kickoff:q.kickoff};
 const event={away_team:'Sam Houston State Bearkats',home_team:'Missouri State Bears',commence_time:new Date(q.kickoff).toISOString(),bookmakers:[{key:'fanduel',last_update:new Date(now).toISOString(),markets:[{key:'spreads',outcomes:[{name:'Sam Houston State Bearkats',point:5.5},{name:'Missouri State Bears',point:-5.5}]},{key:'totals',outcomes:[{name:'Over',point:52.5},{name:'Under',point:52.5}]}]}]};
 assert.equal(matches(event,query),true);assert.equal(require('../fanduel-props').matches(event,query),true);
 assert.equal(selectLines([event],query,now).awaySpread,5.5);assert.equal(selectLines([event],query,now).total,52.5);
 assert.equal(teamMatches('Sam Houston State Bearkats','Missouri State',true),false);
});
test('football game and prop lookups reject conflicting league identity and same-team matches',()=>{
 for(const league of ['1','2']){
  const query={...q,league,away:'Away',home:'Home'};
  const event={...e,away_team:'Away',home_team:'Home',sport_key:'basketball_nba'};
  assert.equal(matches(event,query),false);
  assert.equal(selectLines([event],query).available,false);
  assert.match(missingMatchMessage([event],query),/not found/);
  assert.equal(matches({...event,sport_key:league==='1'?'americanfootball_nfl':'americanfootball_ncaaf',home_team:'Away'},{...query,home:'Away'}),false);
 }
});
test('NBA odds cannot attach to absent or identical teams',()=>{
 const match=require('../nba-odds').matches;
 for(const name of ['','Home']){
  assert.equal(match({sport_key:'basketball_nba',away_team:name,home_team:name,commence_time:e.commence_time},{away:name,home:name,tipoff:e.commence_time}),false);
 }
});
