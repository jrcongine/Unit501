'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {underdogEffect}=require('../public/team-model');

const sunday={a:'Away',h:'Home',kickoff:Date.parse('2026-10-25T18:00:00Z')};
const thursday={a:'Away',h:'Home',kickoff:Date.parse('2026-10-22T23:00:00Z')};
const score=(game,settings)=>underdogEffect(game,21,24,settings);

test('upset scenarios are opt-in, preserve total, and move margin toward the market underdog',()=>{
 const off=score(sunday,{awaySpread:7.5});
 assert.equal(off.applied,false);assert.equal(off.away,21);assert.equal(off.home,24);
 const away=score(sunday,{upsetMode:'manual',upsetPoints:2,awaySpread:7.5});
 assert.equal(away.applied,true);assert.equal(away.away,22);assert.equal(away.home,23);
 assert.equal(away.away+away.home,45);assert.equal(away.points,2);assert.equal(away.team,'Away');
 const home=score(sunday,{upsetMode:'manual',upsetPoints:2,awaySpread:-3.5});
 assert.equal(home.applied,true);assert.equal(home.away,20);assert.equal(home.home,25);
 assert.equal(home.away+home.home,45);assert.equal(home.team,'Home');
});

test('Sunday and neutral scenarios require the relevant explicit game context',()=>{
 const sundayActive=score(sunday,{upsetMode:'sunday',upsetPoints:2,awaySpread:7.5,venueMode:'home'});
 assert.equal(sundayActive.applied,true);
 assert.equal(score(thursday,{upsetMode:'sunday',upsetPoints:2,awaySpread:7.5}).applied,false);
 assert.equal(score(sunday,{upsetMode:'neutral',upsetPoints:2,awaySpread:7.5,venueMode:'home'}).applied,false);
 assert.equal(score(sunday,{upsetMode:'neutral',upsetPoints:2,awaySpread:7.5,venueMode:'neutral'}).applied,true);
 assert.equal(score(sunday,{upsetMode:'manual',upsetPoints:2,awaySpread:7.5,venueMode:'home'}).applied,true);
});

test('no pickem underdog, invalid points or invalid mode are not silently applied',()=>{
 assert.equal(score(sunday,{upsetMode:'manual',upsetPoints:2,awaySpread:0}).applied,false);
 assert.equal(score(sunday,{upsetMode:'manual',upsetPoints:2,awaySpread:NaN}).applied,false);
 for(const points of [0,4,2.5,NaN]){
  assert.equal(score(sunday,{upsetMode:'manual',upsetPoints:points,awaySpread:7.5}).valid,false);
 }
 assert.equal(score(sunday,{upsetMode:'unknown',upsetPoints:2,awaySpread:7.5}).valid,false);
});
