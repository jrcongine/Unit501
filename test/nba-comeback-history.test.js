'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const h=require('../public/nba-comeback-history');
const sample=()=>({id:12,away:'Philadelphia 76ers',home:'Cleveland Cavaliers',awayScore:41,homeScore:61,
  deficit:20,trailing:'Philadelphia 76ers',leading:'Cleveland Cavaliers',period:2,clock:'05:44',
  tipoff:'2026-10-22T23:00:00.000Z'});
const date='2026-10-22',at=1792712700000;
test('captures the first observed Q1/Q2 deficit at 20, once per game',()=>{
 let s=h.add([],sample(),at,date);
 assert.equal(s.added,true);assert.equal(s.records[0].firstDeficit,20);
 const q1=sample();q1.period=1;q1.deficit=25;q1.homeScore=66;
 s=h.add(s.records,q1,at+5000,date);
 assert.equal(s.added,false);assert.equal(s.records.length,1);assert.equal(s.records[0].firstDeficit,20);
});
test('rejects missing scores, <20 point margins, mismatched leaders and invalid quarters',()=>{
 const s=sample();
 for(const m of [
  x=>{x.homeScore=60;x.deficit=19;},x=>{x.homeScore=null;},
  x=>{x.deficit=25;},x=>{x.trailing='Cleveland Cavaliers';},
  x=>{x.period=3;},x=>{x.id=null;},x=>{x.home='';}
 ]){const x={...s};m(x);assert.equal(h.add([],x,at,date).added,false);}
});
test('grades only official Final outcome with matching game id and teams',()=>{
 const record=h.add([],sample(),at,date).records;
 for(const g of [
  {id:12,away:'Philadelphia 76ers',home:'Cleveland Cavaliers',status:'Live',awayScore:114,homeScore:106},
  {id:12,away:'Philadelphia 76ers',home:'Cleveland Cavaliers',status:'Final',awayScore:null,homeScore:106},
  {id:12,away:'Philadelphia 76ers',home:'New York Knicks',status:'Final',awayScore:114,homeScore:106},
  {id:13,away:'Philadelphia 76ers',home:'Cleveland Cavaliers',status:'Final',awayScore:114,homeScore:106}
 ])assert.equal(h.applyFinals(record,[g]).changed,false);
 const graded=h.applyFinals(record,[{id:12,away:'Philadelphia 76ers',home:'Cleveland Cavaliers',status:'Final',awayScore:114,homeScore:106}]);
 assert.equal(graded.records[0].result,'won');assert.equal(graded.changed,true);
 assert.equal(h.applyFinals(graded.records,[]).records[0].result,'won');
});
test('outcome win rate excludes pending games and only shows observed alerts',()=>{
 const first=h.add([],sample(),at,date).records;
 const b=sample();b.id=13;b.away='Boston Celtics';b.home='Miami Heat';b.trailing=b.away;b.leading=b.home;
 const pending=h.add(first,b,at,date).records;
 const result=h.applyFinals(pending,[{id:12,away:'Philadelphia 76ers',home:'Cleveland Cavaliers',status:'Final',awayScore:90,homeScore:105}]);
 const stats=h.summary(result.records);
 assert.deepEqual([stats.observed,stats.graded,stats.recovered,stats.pending,stats.recoveredPercent,stats.priced],
  [2,1,0,1,0,0]);assert.equal(stats.paperROI,null);
});
test('manual American moneylines create hypothetical $5 results only if recorded near detection',()=>{
 const first=h.add([],sample(),at,date).records;
 assert.equal(h.enterPrice(first,12,'+2500',at+600001).changed,false);
 for(const invalid of ['-90','+99','test','0','+20001'])assert.equal(h.enterPrice(first,12,invalid,at).changed,false);
 const priced=h.enterPrice(first,12,'+2500',at+1000);
 assert.equal(priced.changed,true);
 const won=h.applyFinals(priced.records,[{id:12,away:'Philadelphia 76ers',home:'Cleveland Cavaliers',status:'Final',awayScore:114,homeScore:106}]).records;
 assert.equal(h.paperProfit(won[0]),125);
 assert.equal(h.summary(won).paperROI,2500);
 const lost=h.applyFinals(priced.records,[{id:12,away:'Philadelphia 76ers',home:'Cleveland Cavaliers',status:'Final',awayScore:99,homeScore:116}]).records;
 assert.equal(h.paperProfit(lost[0]),-5);
 assert.equal(h.paperProfit(first[0]),null);
 const negative=h.enterPrice(first,12,'-110',at+100).records;
 const negWin=h.applyFinals(negative,[{id:12,away:'Philadelphia 76ers',home:'Cleveland Cavaliers',status:'Final',awayScore:120,homeScore:106}]).records;
 assert.equal(h.paperProfit(negWin[0]),4.55);
});
