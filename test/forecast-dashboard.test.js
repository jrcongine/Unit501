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
