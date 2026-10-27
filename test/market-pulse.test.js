'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {movement,splits}=require('../public/market-pulse');
const game={id:'12',league:'1',season:'2026',kickoff:5000000,a:'Patriots',h:'Bears'};
const report=(overrides={})=>({available:true,gameId:'12',league:'1',season:'2026',kickoff:5000000,
 fetchedAt:100000,source:'DraftKings via VSiN public preview',sourceAt:null,
 spread:{awayBets:35,homeBets:65,awayMoney:45,homeMoney:55},
 total:{overBets:40,underBets:60,overMoney:30,underMoney:70},...overrides});
test('spread and total direction state market movement without inventing bettor flow',()=>{
 assert.match(movement('spread',{firstLine:3,line:4},game.a,game.h).text,/3.0 → \+4.0 \(↑ 1.0; toward Bears\)/);
 assert.match(movement('spread',{firstLine:3,line:2},game.a,game.h).text,/toward Patriots/);
 assert.match(movement('total',{firstLine:50.5,line:48.5},game.a,game.h).text,/toward Under/);
 assert.match(movement('total',{firstLine:50.5,line:51},game.a,game.h).text,/toward Over/);
 assert.match(movement('total',{firstLine:50.5,line:50.5,firstAt:100,lastAt:100},game.a,game.h).text,/waiting for another observation/);
 assert.match(movement('total',{firstLine:50.5,line:50.5},game.a,game.h).text,/waiting for another observation/);
 assert.match(movement('total',{firstLine:50.5,line:50.5,firstAt:100,lastAt:200},game.a,game.h).text,/unchanged since first observation/);
 assert.match(movement('total',null,game.a,game.h).text,/No verified/);
});
test('betting market pulse only uses scoped, fresh sourced percentages and names their origin',()=>{
 const s=splits(report(),game,100000);
 assert.equal(s.spread.leader,'Bears');assert.equal(s.total.leader,'Under');
 assert.equal(s.spread.bets,'Patriots 35% / Bears 65%');
 assert.equal(s.total.money,'Over 30% / Under 70%');
 assert.equal(s.sourceTimeVerified,false);
 for(const r of [report({available:false}),report({gameId:'13'}),report({league:'2'}),
 report({kickoff:5000001}),report({fetchedAt:1})]){
  assert.equal(splits(r,game,1000000).available,false);
 }
 assert.equal(splits(report({fetchedAt:300000}),game,1000000).available,true);
});
test('missing or inconsistent bet percentages stay unavailable instead of guessing',()=>{
 const malformed=report({spread:{awayBets:90,homeBets:90,awayMoney:60,homeMoney:40},
 total:{overBets:0,underBets:100}});
 const s=splits(malformed,game,100000);
 assert.equal(s.spread,null);
 assert.equal(s.total.bets,'Over 0% / Under 100%');
 assert.equal(s.total.money,'Not supplied');
 assert.equal(splits(report({spread:{},total:{}}),game,100000).available,false);
});
