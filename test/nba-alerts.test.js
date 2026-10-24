'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {candidate,createTracker}=require('../public/nba-alerts');
const game={id:1,statusCode:2,period:1,halftime:false,home:'Home',away:'Away',homeScore:40,awayScore:20};
test('20-point watch includes first-half threshold, excludes halftime, unknown scores and later periods',()=>{
 assert.equal(candidate(game).team,'Away');
 assert.equal(candidate({...game,awayScore:21}),null);
 for(const period of [null,0,3,4,5])assert.equal(candidate({...game,period}),null);
 assert.equal(candidate({...game,halftime:true}),null);
 assert.equal(candidate({...game,statusCode:3}),null);
 assert.equal(candidate({...game,awayScore:null}),null);
 assert.equal(candidate({...game,period:2,homeScore:10,awayScore:30}).team,'Home');
});
test('watch deduplicates repeated scores and still catches another game',()=>{
 const track=createTracker();assert.equal(track([game]).length,1);
 assert.equal(track([{...game,homeScore:45}]).length,0);
 assert.equal(track([{...game,id:2}]).length,1);
});
