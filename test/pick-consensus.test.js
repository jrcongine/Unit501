'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {build}=require('../public/pick-consensus');
const pick=(author,selection,extra={})=>({author,pick:selection,league:'nfl',matchup:'AAA vs BBB',eventLabel:'AAA vs BBB, Fri, Oct 16 • 8:15 PM ET',url:'https://www.covers.com/picks/nfl',...extra});
const source=(name,picks)=>({name,checkedAt:'2026-10-16T15:00:00Z',picks});
test('groups cross-source agreement, retains lines and deduplicates syndicated people',()=>{
 const r=build([source('Covers',[pick('Ann','AAA +3.5 (-110)'),pick('Ann','AAA +3.5 (-110)'),pick('Bob','AAA +4 (-110)')]),source('WagerTalk',[pick('ANN','AAA +3.5 (-112)',{matchup:'AAA at BBB: Spread'}),pick('Cal','BBB -3.5 (-110)')])]);
 const g=r.groups[0];assert.equal(g.agreement,2);assert.equal(g.sourceCount,2);assert.equal(g.entries.length,3);assert.equal(g.opposition,1);assert.deepEqual(g.lines,['+3.5','+4']);
});
test('never merges different dates, leagues, periods, props or undated picks',()=>{
 const r=build([source('Covers',[pick('A','Over 49.5'),pick('B','Total Over 50.5 (-110)',{eventAt:'2026-10-17T23:00Z'}),pick('C','Over 49.5',{league:'ncaaf'}),pick('D','1H Over 24.5'),pick('E','Player o24.5 Receiving Yards'),pick('F','Over 49.5',{eventLabel:'unknown'})])]);
 assert.equal(r.groups.length,3);assert.equal(r.unmatched,3);assert.ok(r.groups.every(g=>g.agreement===1));
});
test('total formats match but opposing sides remain separate',()=>{
 const r=build([source('Covers',[pick('A','O49.5 (-110)'),pick('C','Under 49.5')]),source('WagerTalk',[pick('B','Total Over 49.5 (-112)')])]);
 assert.equal(r.groups[0].side,'Over');assert.equal(r.groups[0].agreement,2);assert.equal(r.groups[0].opposition,1);
});
test('year rollover uses nearest dated event and empty feed clears groups',()=>{
 const r=build([{name:'Covers',checkedAt:'2026-12-31T16:00Z',picks:[pick('A','AAA +3',{eventLabel:'AAA vs BBB, Jan 2 • 8 PM ET'})]}]);
 assert.equal(r.groups[0].date,'2027-01-02');assert.deepEqual(build([]),{groups:[],unmatched:0});
});
