'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {project}=require('../public/nba-model');
const now=Date.parse('2026-10-26T12:00:00Z');
const game={id:1,awayId:5,homeId:6,stage:2,statusCode:1,tipoff:'2026-10-27T00:00:00Z'};
function context(){
 const side=(id,pf,pa)=>({id,available:true,coverage:{conflictingGames:0},season:{games:12,pointsFor:pf,pointsAgainst:pa},recent5:{games:5,pointsFor:pf,pointsAgainst:pa}});
 return {gameId:1,tipoff:game.tipoff,stage:2,away:side(5,110,108),home:side(6,120,112)};
}
test('NBA baseline combines own scoring with opposing defense and uses home spread convention',()=>{
 const p=project(game,context(),'season',now);
 assert.equal(p.away,111);assert.equal(p.home,114);assert.equal(p.total,225);assert.equal(p.homeSpread,-3);
 assert.equal(p.thin,false);assert.equal(p.available,true);assert.equal('probability' in p,false);
 const d=context();d.away.season.pointsFor=130;
 assert.equal(project(game,d,'season',now).homeSpread,7);
});
test('NBA projections reject wrong teams, stage, game and tipoff',()=>{
 for(const mutate of [d=>d.away.id=7,d=>d.home.id=5,d=>d.stage=1,d=>d.gameId=2,d=>d.tipoff='2026-10-28T00:00:00Z']){
  const d=context();mutate(d);assert.equal(project(game,d,'season',now).available,false);
 }
});
test('NBA pregame model withdraws at tipoff and for in-progress, final or unknown status',()=>{
 assert.equal(project(game,context(),'season',Date.parse(game.tipoff)).available,false);
 for(const statusCode of [2,3,undefined])assert.equal(project({...game,statusCode},context(),'season',now).available,false);
});
test('NBA baseline never fills missing, conflicting or small samples with zeros',()=>{
 for(const mutate of [d=>d.away.available=false,d=>d.home.coverage.conflictingGames=1,d=>d.away.season.games=2,d=>d.home.season.pointsFor=null,d=>d.home.season.pointsAgainst=NaN]){
  const d=context();mutate(d);assert.equal(project(game,d,'season',now).available,false);
 }
 assert.equal(project(game,context(),'venue',now).available,false);
 assert.equal(project(game,context(),'unknown',now).available,false);
});
test('NBA venue estimates use away road and home home samples only',()=>{
 const d=context();d.away.awaySplit={games:3,pointsFor:100,pointsAgainst:90};d.home.homeSplit={games:4,pointsFor:110,pointsAgainst:100};
 const p=project(game,d,'venue',now);assert.equal(p.away,100);assert.equal(p.home,100);assert.equal(p.homeSpread,0);assert.equal(p.thin,true);
});

test('NBA simulation separates wins, ties, spread pushes and total pushes',()=>{
 const {simulate}=require('../public/nba-model');
 const samples=n=>Array.from({length:n},()=>({for:110,against:110}));
 const data={away:{recentGames:samples(5)},home:{recentGames:samples(5)}};
 const p={available:true,away:110,home:110};
 const tied=simulate(p,data,{awaySpread:0,total:220},100,()=>0);
 assert.equal(tied.tie,1);assert.equal(tied.spread.push,1);assert.equal(tied.total.push,1);
 const away=simulate({...p,away:112},data,{awaySpread:-1.5,total:221.5},100,()=>0);
 assert.equal(away.awayWin,1);assert.equal(away.spread.away,1);assert.equal(away.total.over,1);
 const noLines=simulate(p,data,{},100,()=>0);
 assert.equal(noLines.spread,null);assert.equal(noLines.total,null);
});
test('NBA simulation withholds incomplete histories and uses deterministic empirical samples',()=>{
 const {simulate}=require('../public/nba-model');
 const samples=[{for:100,against:105},{for:105,against:110},{for:110,against:115},{for:115,against:120},{for:120,against:125}];
 const data={away:{recentGames:samples},home:{recentGames:samples}};
 const p={available:true,away:110,home:115};
 let seed=1;const rng=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const a=simulate(p,data,{awaySpread:3.5,total:225.5},10000,rng);seed=1;
 const b=simulate(p,data,{awaySpread:3.5,total:225.5},10000,rng);
 assert.deepEqual(a,b);assert.ok(a.awayWin>0&&a.homeWin>0);
 assert.ok(Math.abs(a.awayWin+a.homeWin+a.tie-1)<1e-10);
 assert.ok(Math.abs(a.spread.away+a.spread.home+a.spread.push-1)<1e-10);
 assert.ok(Math.abs(a.total.over+a.total.under+a.total.push-1)<1e-10);
 assert.equal(simulate(p,{away:{recentGames:samples.slice(0,4)},home:data.home}).available,false);
 assert.equal(simulate(p,{away:{recentGames:[...samples.slice(0,4),{for:null,against:5}]},home:data.home}).available,false);
 assert.equal(simulate({available:false},data).available,false);
});

test('known NBA team-history gaps block estimates and simulations independently',()=>{
 const {simulate}=require('../public/nba-model');
 for(const side of ['away','home'])for(const field of ['unverifiedGames','conflictingGames','invalid']){
  const d=context();for(const s of ['away','home'])d[s].recentGames=Array.from({length:5},()=>({for:110,against:100}));
  const p=project(game,d,'season',now);assert.equal(p.available,true);
  d[side].coverage[field]=1;
  assert.equal(project(game,d,'season',now).available,false);
  assert.equal(simulate(p,d).available,false);
 }
});
