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
 const partial=data();partial.teams[1].available=false;assert.equal(project(partial,q,game,null,now).available,true);
 partial.teams[0].available=false;assert.equal(project(partial,q,game,null,now).available,false);
 const fewer=data();fewer.teams[0].players[0].results[1].player_points=null;fewer.teams[0].players[0].results[2].player_points=null;assert.equal(project(fewer,q,game,null,now).available,false);
 const future=data();future.teams[0].players[0].results[0].tipoff=game.tipoff;assert.equal(project(future,q,game,null,now).available,false);
});


test('NBA minutes estimate responds to rotation scenarios without changing recorded results',()=>{
 const d=data();d.teams[0].players[0].results.forEach((r,i)=>{r.minutes=[28,32,10][i];r.player_points=r.minutes/2;});
 const baseline=project(d,q,game,null,now),manual=project(d,q,game,null,now,{minutes:36});
 assert.equal(baseline.method,'recency and minutes');assert.equal(manual.projection,18);
 assert.equal(manual.projectedMinutes,36);assert.equal(manual.method,'manual minutes');
 assert.equal(manual.above,baseline.above);assert.equal(manual.below,baseline.below);
 assert.equal(manual.equal,baseline.equal);assert.equal(manual.average,baseline.average);
 for(const minutes of [0,-1,49,NaN,Infinity,'30'])assert.equal(project(d,q,game,null,now,{minutes}).available,false);
 assert.equal(project(data(),q,game,null,now,{minutes:30}).available,false);
});

test('NBA minutes trends are chronological and never label a confirmed starting role',()=>{
 const d=data();d.teams[0].players[0].results=Array.from({length:5},(_,i)=>({gameId:i+1,tipoff:`2026-10-${24-i*2}T20:00:00Z`,minutes:i<2?32:20,player_points:i<2?16:10})).reverse();
 const r=project(d,q,game,null,now);assert.equal(r.minuteChange.direction,'up');assert.equal(r.minuteChange.recent,32);assert.equal(r.minuteChange.previous,20);
 assert.ok(r.projection>12);assert.ok(r.projectedMinutes<=48);assert.equal(r.games,5);
 const future=data();future.teams[0].players[0].results[0].tipoff='2026-10-26T21:00:00Z';
 assert.equal(project(future,q,game,null,now).available,false);
});


test('NBA props withhold players with an unverified appearance even when other results are valid',()=>{
 const d=data();d.teams[0].players[0].available=false;
 assert.equal(project(d,q,game,null,now).available,false);
});

test('missing NBA projections explain history gaps without implying injury adjustments',()=>{
 assert.equal(project(null,q,game,'Questionable',now).reason,'Player history unavailable');
 const missing=data();missing.teams[0].players=[];
 assert.equal(project(missing,q,game,null,now).reason,'No matched player history');
 const duplicate=data();duplicate.teams[1].players=[structuredClone(duplicate.teams[0].players[0])];
 assert.equal(project(duplicate,q,game,null,now).reason,'Player match is ambiguous');
 const thin=data();thin.teams[0].players[0].results.length=1;
 assert.equal(project(thin,q,game,null,now).reason,'Fewer than 2 verified games');
 assert.equal(project(data(),q,game,null,now+1800001).reason,'Verified history unavailable');
 assert.deepEqual(project(data(),q,game,'Questionable',now),project(data(),q,game,null,now));
 assert.equal(project(null,q,game,'Out',now).reason,'OUT');
});
