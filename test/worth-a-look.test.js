'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {compare,marginReason}=require('../public/worth-a-look');
const {createHistory,footballTarget}=require('../line-history');
test('slate highlights only fresh changes from a matching game and distinguishes tracked vs personal moves',()=>{
 let at=Date.parse('2026-11-01T12:00:00Z');
 const history=createHistory({now:()=>at}),target=footballTarget({league:'1',away:'Bears',home:'Packers',kickoff:at+86400000},'game');
 const put=line=>history.capture(target,{awaySpread:line,spreadUpdated:new Date(at).toISOString()});
 const games=[{...target,scheduled:true}],read=seen=>compare('1',history.slateSpreads('1'),games,seen,at);
 put(2.5);const a=read({});assert.equal(a.picks.length,0);
 at+=60000;put(3.5);assert.equal(read({}).picks[0].personal,false);
 const b=read(a.updates);assert.equal(b.picks[0].personal,true);assert.equal(b.picks[0].before,2.5);
 assert.equal(read(b.updates).picks.length,0);
 assert.equal(compare('1',history.slateSpreads('1'),[...games,...games],{},at).picks.length,0);
 assert.equal(history.slateSpreads('nba').length,0);at+=1800000;assert.equal(read({}).picks.length,0);
});
test('football margin explanations distinguish a cover from a push in either direction',()=>{
 assert.match(marginReason(2.5,3.5),/3-point loss.*loss → cover/);
 assert.match(marginReason(-2.5,-3),/3-point win.*cover → push/);
 assert.equal(marginReason(4,5),'');
});
