'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {compare}=require('../public/nba-rotation-context');
const now=Date.parse('2026-10-26T20:00:00Z'),game={id:999,tipoff:'2026-10-26T23:30:00Z'};
const result=(id,points,minutes=30)=>({gameId:id,tipoff:`2026-10-${20+id}T00:00:00Z`,player_points:points,minutes});
function input(){return {history:{gameId:999,tipoff:game.tipoff,checkedAt:now,teams:[{available:true,players:[
 {id:'1',name:'Player A',results:[result(1,10),result(2,12),result(3,20,35),result(4,24,35)]},
 {id:'2',name:'Teammate B',results:[result(1,5),result(2,5)],inactive:[{gameId:3},{gameId:4}]}
 ]},{available:true,players:[]}]},report:{gameId:999,tipoff:game.tipoff,reportAt:now,teams:[{available:true,players:[{name:'Teammate B',status:'Out'}]},{available:true,players:[]}]},quote:{name:'Player A',market:'player_points',line:15.5}};}
test('historical split only counts explicit appearances and DNPs for the same team',()=>{
 const {history,report,quote}=input();const x=compare(history,quote,report,game,now);
 assert.equal(x.length,1);assert.equal(x[0].without.value,22);assert.equal(x[0].without.minutes,35);assert.equal(x[0].with.value,11);
});
test('missing DNP, uncertain status, stale reports and duplicate identities do not create a split',()=>{
 for(const mutate of [x=>x.history.teams[0].players[1].inactive.pop(),x=>x.report.teams[0].players[0].status='Questionable',x=>x.report.reportAt=now-7200001,x=>x.history.teams[0].players.push({...x.history.teams[0].players[1]}),x=>x.history.teams[0].players[0].results[0].tipoff=game.tipoff]){
  const x=input();mutate(x);assert.deepEqual(compare(x.history,x.quote,x.report,game,now),[]);
 }
});
