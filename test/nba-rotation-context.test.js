'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {compare}=require('../public/nba-rotation-context');
const now=Date.parse('2026-10-26T20:00:00Z'),game={id:999,tipoff:'2026-10-26T23:30:00Z'};
const result=(id,points,minutes=30)=>({gameId:id,tipoff:`2026-10-${20+id}T00:00:00Z`,player_points:points,minutes});
function input(){return {history:{gameId:999,tipoff:game.tipoff,checkedAt:now,teams:[{name:'Chicago Bulls',available:true,players:[
 {id:'1',name:'Player A',results:[result(1,10),result(2,12),result(3,20,35),result(4,24,35)]},
 {id:'2',name:'Teammate B',results:[result(1,5),result(2,5)],inactive:[{gameId:3,tipoff:result(3).tipoff},{gameId:4,tipoff:result(4).tipoff}]}
 ]},{name:'Boston Celtics',available:true,players:[]}]},report:{gameId:999,tipoff:game.tipoff,reportAt:now,teams:[{name:'Chicago Bulls',available:true,players:[{name:'Teammate B',status:'Out'}]},{name:'Boston Celtics',available:true,players:[]}]},quote:{name:'Player A',market:'player_points',line:15.5}};}
test('historical split only counts explicit appearances and DNPs for the same team',()=>{
 const {history,report,quote}=input();const x=compare(history,quote,report,game,now);
 assert.equal(x.length,1);assert.equal(x[0].without.value,22);assert.equal(x[0].without.minutes,35);assert.equal(x[0].with.value,11);
});
test('missing DNP, uncertain status, stale reports and duplicate identities do not create a split',()=>{
 for(const mutate of [x=>x.history.teams[0].players[1].inactive.pop(),x=>x.report.teams[0].players[0].status='Questionable',x=>x.report.reportAt=now-7200001,x=>x.history.teams[0].players.push({...x.history.teams[0].players[1]}),x=>x.history.teams[0].players[0].results[0].tipoff=game.tipoff]){
  const x=input();mutate(x);assert.deepEqual(compare(x.history,x.quote,x.report,game,now),[]);
 }
});

test('absence splits reject mismatched teams, conflicting dates and malformed participation evidence',()=>{
 for(const mutate of [
  x=>x.report.teams.reverse(),
  x=>x.history.teams[0].name='',
  x=>x.history.teams[0].players[1].inactive[0].tipoff=result(2).tipoff,
  x=>delete x.history.teams[0].players[1].inactive[0].tipoff,
  x=>x.history.teams[0].players[1].inactive[0].gameId='bad',
  x=>x.history.teams[0].players[1].inactive.push({...x.history.teams[0].players[1].inactive[0]}),
  x=>x.history.teams[0].players[1].results[0].tipoff=game.tipoff,
  x=>x.history.teams[0].players[1].results[0].minutes=null,
  x=>x.history.teams[0].players[0].results[3].minutes=61,
  x=>x.quote.market='minutes'
 ]){
  const x=input();mutate(x);assert.deepEqual(compare(x.history,x.quote,x.report,game,now),[]);
 }
});

test('teammate absence splits tolerate unique suffix formatting but reject collisions',()=>{
 const x=input();x.history.teams[0].players[0].name='Player A Jr.';
 x.history.teams[0].players[1].name='Téammate B III';
 const split=compare(x.history,x.quote,x.report,game,now);
 assert.equal(split.length,1);assert.equal(split[0].without.value,22);assert.equal(split[0].with.value,11);
 for(const mutate of [
  y=>y.report.teams[0].players[0].name='Teammate B II',
  y=>y.history.teams[0].players.push({...y.history.teams[0].players[1],name:'Teammate B Jr.'}),
  y=>y.history.teams[1].players.push({...y.history.teams[0].players[0],name:'Player A Sr.'}),
  y=>y.report.teams[0].players.push({name:'Teammate B III',status:'Questionable'}),
  y=>y.history.teams[0].available=false
 ]){
  const y=structuredClone(x);mutate(y);assert.deepEqual(compare(y.history,y.quote,y.report,game,now),[]);
 }
});
