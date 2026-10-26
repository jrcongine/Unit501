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
