'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {filter}=require('../public/forecast-dashboard');
test('dashboard scopes seasons, leagues and models without dropping the selected-pick distinction',()=>{
 const a={records:[{league:1,season:2026,modelVersion:'v1'}]};
 const pick={...a,selection:{market:'spread'}};
 const rows=[a,pick,{records:[{league:2,season:2026,modelVersion:'v1'}]},
  {records:[{league:1,season:2025,modelVersion:'v1'}]},
  {records:[{league:1,season:2026,modelVersion:'v2'}]}];
 const before=JSON.stringify(rows);
 assert.deepEqual(filter(rows,{league:'1',season:'2026',modelVersion:'v1'}),[a,pick]);
 assert.equal(filter(rows).length,5);
 assert.equal(JSON.stringify(rows),before);
 assert.deepEqual(filter(rows,{modelVersion:'missing'}),[]);
});
test('mixed-model game snapshots cannot become partial score pairs',()=>{
 const mixed={records:[{modelVersion:'v1'},{modelVersion:'v2'}]};
 assert.deepEqual(filter([mixed],{modelVersion:'v1'}),[]);
 assert.deepEqual(filter([mixed,{}]),[mixed]);
});
const {dateKey,diagnosis,report}=require('../public/forecast-dashboard');
test('game dates use Central Time, include boundaries and reject missing or reversed dates',()=>{
 const row=iso=>({game:{kickoff:Date.parse(iso)},records:[{league:1}]});
 const late=row('2026-10-15T02:00:00Z'),next=row('2026-10-15T05:00:00Z');
 assert.equal(dateKey(late.game.kickoff),'2026-10-14');
 assert.equal(dateKey(Date.parse('2026-12-15T05:00:00Z')),'2026-12-14');
 assert.deepEqual(filter([late,next,{}],{from:'2026-10-14',to:'2026-10-14'}),[late]);
 assert.deepEqual(filter([late,next],{from:'2026-10-16',to:'2026-10-14'}),[]);
 assert.deepEqual(filter([late,next],{from:'2026-10-15'}),[next]);
});
test('bias descriptions preserve uncertainty and do not confuse missing results with zero bias',()=>{
 assert.equal(diagnosis({games:0,adjustedBias:null}),'Awaiting final outcomes');
 assert.match(diagnosis({games:5,adjustedBias:4}),/Running high by 4.00.*insufficient/);
 assert.match(diagnosis({games:30,adjustedBias:-3}),/Running low by 3.00.*observed sample only/);
 assert.match(diagnosis({games:40,adjustedBias:-0.001}),/^No net bias/);
});
test('download report captures the displayed scope and separate pick counts',()=>{
 const filters={league:'1',from:'2026-10-14'},audit={accepted:2,skips:{pending:1}};
 const out=report([{records:[]},{selection:{market:'spread'}}],filters,audit,0);
 assert.equal(out.forecastSnapshots,1);assert.equal(out.selectedPickSnapshots,1);
 assert.deepEqual(out.accuracy,audit);assert.equal(out.generatedAt,'1970-01-01T00:00:00.000Z');
 filters.league='2';assert.equal(out.filters.league,'1');
 assert.equal(JSON.parse(JSON.stringify(out)).accuracy.accepted,2);
});

test('latest recorded game-day report only summarizes matched archived finals in Central Time',()=>{
 const {latestDay}=require('../public/forecast-dashboard');
 const {compare}=require('../public/injury-backtest');
 const {selectionResult}=require('../public/forecast-archive');
 const earlier=Date.parse('2026-10-12T22:00:00Z'),later=Date.parse('2026-10-15T23:00:00Z');
 const row=(gameId,kickoff,actual)=>({
  league:'1',season:'2026',gameId:String(gameId),teamId:'1',kind:'score',market:'points',
  modelVersion:'v1',evidenceUrl:'https://example.com/captured',kickoff,
  forecastAt:kickoff-600000,inputAsOf:kickoff-600000,resultKnownAt:actual===null?null:kickoff+9000000,
  baseline:21,adjusted:20,actual
 });
 const snap=(id,kickoff,actual)=>({game:{id:String(id),kickoff,league:'1',season:'2026',awayId:'1',homeId:'2'},records:[row(id,kickoff,actual)]});
 const old=snap(10,earlier,17),recent=snap(11,later,15),pending=snap(12,later,null);
 const statPick={...recent,selection:{market:'total',direction:'over',line:40}};
 const summary=latestDay([old,recent,pending,statPick],compare,selectionResult);
 assert.equal(summary.date,'2026-10-15');assert.equal(summary.matchedTargets,1);
 assert.equal(summary.markets.length,1);assert.equal(summary.markets[0].averageMiss,5);
 assert.equal(summary.markets[0].baselineMiss,6);
 assert.equal(summary.selected.pending,1);
 assert.equal(summary.markets[0].games,1);
 assert.equal(latestDay([pending],compare,selectionResult),null);
});

function upsetSnapshot(id,line,projectedAway,projectedHome,actualAway,actualHome){
 const kickoff=Date.parse('2026-10-25T17:00:00Z'),forecastAt=kickoff-600000;
 return {schema:1,forecastAt,game:{id:String(id),league:'1',season:'2026',awayId:'1',homeId:'2',kickoff},
  inputs:{marketContext:{awaySpread:line}},records:[['1',projectedAway,actualAway],['2',projectedHome,actualHome]].map(([teamId,adjusted,actual])=>({
   league:'1',season:'2026',gameId:String(id),teamId,kind:'score',market:'points',modelVersion:'v1',
   evidenceUrl:'https://example.com/captured',kickoff,forecastAt,inputAsOf:forecastAt,
   resultKnownAt:actual===null?null:kickoff+10000,baseline:adjusted,adjusted,actual
  }))};
}
test('upset history distinguishes called, missed, false-alarm and pending outright picks using saved lines',()=>{
 const {upsetHistory}=require('../public/forecast-dashboard');
 const snapshots=[
  upsetSnapshot(1,10.5,27,24,28,21), // away upset called
  upsetSnapshot(2,-10.5,24,27,21,28), // home upset called
  upsetSnapshot(3,10.5,24,27,28,21), // cover-only projection missed actual upset
  upsetSnapshot(4,10.5,27,24,21,28), // false alarm
  upsetSnapshot(5,10.5,27,24,null,null),
  upsetSnapshot(6,10.5,27,24,21,21), // final tie, not an outright win
  upsetSnapshot(7,0,27,24,28,21),
  upsetSnapshot(8,null,27,24,28,21)
 ];
 const before=JSON.stringify(snapshots),result=upsetHistory(snapshots,Date.parse('2026-10-26'));
 assert.equal(result.groups.length,1);
 assert.deepEqual(result.groups[0],{league:'1',season:'2026',modelVersion:'v1',forecasts:6,projectedUpsets:5,
  pending:1,completed:5,actualUpsets:3,calledUpsets:2,missedUpsets:1,falseAlarms:1,actualTies:1});
 assert.equal(result.pickem,1);assert.equal(result.missingLine,1);
 assert.equal(JSON.stringify(snapshots),before);
});
test('upset history rejects duplicate and postgame forecasts and keeps leagues and model versions separate',()=>{
 const {upsetHistory}=require('../public/forecast-dashboard'),now=Date.parse('2026-10-26');
 const good=upsetSnapshot(1,10.5,27,24,28,21);
 const late=upsetSnapshot(2,10.5,27,24,28,21);late.records[0].forecastAt=late.game.kickoff+1;
 const college=upsetSnapshot(3,10.5,27,24,28,21);college.game.league='2';college.records.forEach(r=>r.league='2');
 const version=upsetSnapshot(4,10.5,27,24,28,21);version.records.forEach(r=>r.modelVersion='v2');
 const mixed=upsetSnapshot(5,10.5,27,24,28,21);mixed.records[0].modelVersion='v2';
 const future=upsetSnapshot(6,10.5,27,24,28,21);future.records[0].resultKnownAt=now+1;
 const missing=upsetSnapshot(7,10.5,27,24,28,21);missing.records.pop();
 const selected={...good,selection:{market:'spread'}};
 const out=upsetHistory([good,good,late,college,version,mixed,future,missing,selected],now);
 assert.equal(out.excluded,6);
 assert.equal(out.groups.length,2);
 assert.deepEqual(out.groups.map(g=>[g.league,g.modelVersion,g.calledUpsets]),[['2','v1',1],['1','v2',1]]);
 assert.equal(upsetHistory([],now).groups.length,0);
});
