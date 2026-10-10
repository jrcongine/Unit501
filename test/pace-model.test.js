'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const model=require('../public/team-model');
const {validatePace}=require('../pace-backtest');
const {readPace,summarize}=require('../rankings');
function context(before=1000){
 const teams=Array.from({length:32},(_,i)=>({id:String(i),games:4,pace:{games:4,drives:40,opponentDrives:40},metrics:Object.fromEntries(['pointsFor','pointsAgainst'].map(key=>[key,{average:20,games:4,rank:i+1,pool:32}]))}));
 return {season:'2026',before,teams,coverage:{pointsFor:{ranked:true,expected:32},pointsAgainst:{ranked:true,expected:32}}};
}
const game={league:'1',season:'2026',kickoff:1000,awayId:'0',homeId:'1'};
test('drive candidate separates pace from points per drive and preserves equal-team baseline',()=>{
 const d=context();let p=model.project(d,game,{pace:true});assert.equal(p.pace.applied,true);assert.equal(p.away,20);assert.equal(p.home,20);
 for(const t of d.teams.slice(0,2)){t.pace.drives=56;t.pace.opponentDrives=56;t.metrics.pointsFor.average=28;t.metrics.pointsAgainst.average=28;}
 p=model.project(d,game,{pace:true});assert.ok(p.pace.expectedDrives>10);assert.ok(p.away>20);assert.ok(p.away<model.project(d,game,{pace:false}).away);
});
test('missing drive reports withhold pace without blocking scoring or inventing possessions',()=>{
 const d=context();d.teams[31].pace.games=3;
 const p=model.project(d,game,{pace:true});assert.equal(p.available,true);assert.equal(p.pace.applied,false);assert.equal(p.away,20);
 assert.deepEqual(readPace({statistics:{yards:{total_drives:'12'},plays:70}}),{drives:12,plays:70});
 assert.deepEqual(readPace({statistics:{yards:{total_drives:0},plays:-1}}),{drives:null,plays:null});
});
test('automatic pace requires a matching improving comparison and suppresses old probability fits',()=>{
 const d=context();d.paceValidation={accepted:true,league:'1',season:'2026',before:1000};
 let p=model.project(d,game);assert.equal(p.modelVersion,'pace-v1');assert.ok(!p.probabilityCalibration);
 d.paceValidation.before=999;assert.equal(model.project(d,game).pace.applied,false);
 assert.equal(model.project(d,game,{},true).pace.applied,false);
});
test('pace aggregation omits incomplete drive pairs and excludes future games',()=>{
 const g={league:{id:1,season:2026},game:{id:1,stage:'Regular Season',date:{timestamp:1},status:{short:'FT'}},teams:{away:{id:0},home:{id:1}},scores:{away:{total:20},home:{total:14}}};
 const boxes=new Map([['1',[{team:{id:0},statistics:{yards:{total_drives:10},plays:60}},{team:{id:1},statistics:{yards:{total_drives:11},plays:62}}]]]);
 const q={league:'1',season:'2026',before:2000};
 const r=summarize([g,{...g,game:{...g.game,id:2,date:{timestamp:3}}}],boxes,q,[{id:0},{id:1}]);
 assert.equal(r.teams[0].pace.games,1);assert.equal(r.teams[0].pace.drives,10);assert.equal(r.teams[0].pace.opponentDrives,11);
 boxes.get('1')[1].statistics.yards.total_drives=null;
 assert.equal(summarize([g],boxes,q,[{id:0},{id:1}]).teams[0].pace.games,0);
});
test('pace comparison uses strictly earlier snapshots, requires later games and ignores future results',()=>{
 const snapshot=before=>{const d=context(before);d.teams[0].pace.drives=20;d.teams[0].pace.opponentDrives=20;d.teams[0].metrics.pointsFor.average=30;d.teams[0].metrics.pointsAgainst.average=10;d.teams[1].pace.drives=60;d.teams[1].pace.opponentDrives=60;return d;};
 const games=Array.from({length:80},(_,i)=>{const timestamp=i+1,before=timestamp*1000,p=model.project(snapshot(before),{...game,kickoff:before},{pace:true});return {league:{id:1,season:2026},game:{id:i+1,stage:'Regular Season',date:{timestamp},status:{short:'FT'}},teams:{away:{id:0},home:{id:1}},scores:{away:{total:Math.round(p.away)},home:{total:Math.round(p.home)}}};});
 const q={league:'1',season:'2026',before:81000},seen=[];
 const result=validatePace(games,q,before=>{seen.push(before);return snapshot(before);});
 assert.equal(result.games,80);assert.equal(result.evaluatedGames,50);assert.equal(result.accepted,true);assert.ok(seen.every(x=>x<q.before));assert.equal(result.calibration.modelVersion,'pace-v1');
 assert.equal(validatePace(games,{...q,before:40000},snapshot).accepted,false);
 const prior=validatePace(games,{...q,before:60000},snapshot);games[79].scores.away.total=1000;assert.deepEqual(validatePace(games,{...q,before:60000},snapshot),prior);
});
