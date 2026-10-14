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
