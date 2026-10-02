const {test}=require('node:test');
const assert=require('node:assert/strict');
const {project,simulate}=require('../public/team-model');
function setup() {
 const game={kickoff:100,season:'2026',league:'1',awayId:'0',homeId:'1'};
 const teams=Array.from({length:32},(_,i)=>({id:String(i),games:4,metrics:Object.fromEntries(['pointsFor','pointsAgainst'].map(key=>[key,{average:24,games:4,rank:i+1,pool:32}]))}));
 return {game,data:{before:100,season:'2026',teams,coverage:{pointsFor:{ranked:true,expected:32},pointsAgainst:{ranked:true,expected:32}}}};
}
test('equal teams project league average; stronger scoring offense raises its own score',()=>{
 const {game,data}=setup();
 assert.equal(project(data,game).away,24);
 assert.equal(project(data,game).home,24);
 data.teams[0].metrics.pointsFor.average=40;
 const p=project(data,game);
 assert.ok(p.away>p.home);
 assert.ok(p.away<32); // early-season shrinkage, rather than raw average
});
test('opposing defense is applied to correct side and point overrides are explicit',()=>{
 const {game,data}=setup();
 data.teams[1].metrics.pointsAgainst.average=40;
 const p=project(data,game);
 assert.equal(p.away,28);
 assert.equal(p.home,24);
 const adjusted=project(data,game,{away:2,home:-3});
 assert.equal(adjusted.away,30);
 assert.equal(adjusted.home,21);
 assert.equal(project(data,game,{away:15}).available,false);
});
test('stale matchup, incomplete pool, small samples and outside-pool teams block predictions',()=>{
 const {game,data}=setup();
 assert.equal(project(data,{...game,kickoff:101}).available,false);
 assert.equal(project(data,{...game,season:'2027'}).available,false);
 assert.equal(project(data,{...game,awayId:'FCS'}).available,false);
 data.teams[0].games=1;
 assert.equal(project(data,game).available,false);
 data.teams[0].games=4;
 data.coverage.pointsAgainst.ranked=false;
 assert.equal(project(data,game).available,false);
});
function rng() {let seed=123;return ()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};}
test('positive away spread increases cover rate; higher totals reduce over rate',()=>{
 const p={available:true,away:24,home:24};
 const a=simulate(p,-7,40,10000,rng());
 const b=simulate(p,7,60,10000,rng());
 assert.ok(b.cover>a.cover);
 assert.ok(b.over<a.over);
 assert.equal(a.win,b.win);
});
test('integer score pushes counted separately; fractional lines cannot push',()=>{
 const p={available:true,away:24,home:24};
 const a=simulate(p,0,48,10000,rng());
 assert.ok(a.spreadPush>0);
 assert.equal(a.spreadPush,a.tie);
 assert.ok(a.totalPush>0);
 const b=simulate(p,.5,48.5,10000,rng());
 assert.equal(b.spreadPush,0);
 assert.equal(b.totalPush,0);
});
test('college pool supported with 138 complete teams; insufficient pool is blocked',()=>{
 const {game,data}=setup();
 game.league='2';
 data.coverage.pointsFor.expected=138;
 data.coverage.pointsAgainst.expected=138;
 data.teams=Array.from({length:138},(_,i)=>({...data.teams[0],id:String(i),metrics:{pointsFor:{average:30,games:4,rank:i+1,pool:138},pointsAgainst:{average:25,games:4,rank:i+1,pool:138}}}));
 assert.equal(project(data,game).available,true);
 data.teams.pop();
 assert.equal(project(data,game).available,false);
});
