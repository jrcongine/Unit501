'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {marketComparison,showMarketComparison}=require('../public/unit501-shared-ui');
test('market comparison respects away-spread signs, pickem, totals and flag boundaries',()=>{
 const p={available:true,away:28,home:21};
 assert.deepEqual([marketComparison(p,{awaySpread:-7,total:49}).spreadGap,marketComparison(p,{awaySpread:-7,total:49}).totalGap],[0,0]);
 assert.equal(marketComparison(p,{awaySpread:0}).spreadGap,7);
 assert.equal(marketComparison(p,{awaySpread:3}).spreadGap,10);
 assert.equal(marketComparison(p,{awaySpread:-14}).spreadGap,-7);
 assert.equal(marketComparison(p,{awaySpread:-.5,total:39.5}).large,false);
 assert.equal(marketComparison(p,{total:39}).large,true);
 assert.equal(marketComparison(p,{total:59}).totalGap,-10);
 const basketball=marketComparison({available:true,away:110,home:105},{awaySpread:-3,total:220},'FanDuel');
 assert.equal(basketball.spreadGap,2);assert.equal(basketball.totalGap,-5);assert.match(basketball.text,/FanDuel/);
 assert.equal(p.away,28);
});
test('missing and invalid lines remain absent instead of becoming pickem or zero totals',()=>{
 const p={available:true,away:28,home:21};
 for(const value of [null,undefined,'',false,NaN,Infinity,'7'])assert.equal(marketComparison(p,{awaySpread:value,total:value}),null);
 assert.equal(marketComparison(p,{total:0}),null);assert.equal(marketComparison(p,{total:-1}),null);
 assert.equal(marketComparison({...p,available:false},{awaySpread:1}),null);
 assert.equal(marketComparison({...p,away:NaN},{awaySpread:1}),null);
 assert.equal(marketComparison(p,{total:50}).spreadGap,null);
 assert.equal(marketComparison(p,{awaySpread:0}).totalGap,null);
});
test('comparison display clears previous gaps when estimate or current lines are unavailable',()=>{
 const element={};showMarketComparison(element,{available:true,away:28,home:21},{awaySpread:0},'Entered lines');
 assert.equal(element.hidden,false);assert.match(element.textContent,/Large model\/line difference/);
 showMarketComparison(element,{available:true,away:28,home:21},{});assert.equal(element.hidden,true);assert.equal(element.textContent,'');
 showMarketComparison(element,null);assert.equal(element.hidden,true);
});
