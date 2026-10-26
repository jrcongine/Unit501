'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {project}=require('../public/nba-player-model');
const now=Date.parse('2026-10-26T20:00:00Z'),game={id:5,tipoff:'2026-10-26T23:30:00Z'};
const q={name:'Jalen Smith',market:'player_points',line:14};
function data(){return {gameId:5,tipoff:game.tipoff,checkedAt:now,teams:[{available:true,players:[{name:'Jalen Smith',results:[
 {gameId:1,tipoff:'2026-10-24T20:00:00Z',player_points:14},{gameId:2,tipoff:'2026-10-22T20:00:00Z',player_points:16},{gameId:3,tipoff:'2026-10-20T20:00:00Z',player_points:0}]}]}, {available:true,players:[]}]};}
test('NBA player estimate shows actual above/below/equal counts and includes genuine zero',()=>{
 const r=project(data(),q,game,null,now);assert.equal(r.available,true);assert.equal(r.games,3);assert.equal(r.projection,10);assert.equal(r.above,1);assert.equal(r.below,1);assert.equal(r.equal,1);assert.equal(r.thin,true);
});
test('NBA player estimate withholds OUT, stale, mismatched, ambiguous and insufficient samples',()=>{
 assert.equal(project(data(),q,game,'Out',now).reason,'OUT');
 assert.equal(project(data(),q,game,null,now+1800001).available,false);
 assert.equal(project(data(),q,{...game,id:6},null,now).available,false);
 assert.equal(project(data(),q,game,null,Date.parse(game.tipoff)).available,false);
 const duplicate=data();duplicate.teams[1].players=[structuredClone(duplicate.teams[0].players[0])];assert.equal(project(duplicate,q,game,null,now).available,false);
 const partial=data();partial.teams[1].available=false;assert.equal(project(partial,q,game,null,now).available,false);
 const fewer=data();fewer.teams[0].players[0].results[1].player_points=null;fewer.teams[0].players[0].results[2].player_points=null;assert.equal(project(fewer,q,game,null,now).available,false);
 const future=data();future.teams[0].players[0].results[0].tipoff=game.tipoff;assert.equal(project(future,q,game,null,now).available,false);
});
