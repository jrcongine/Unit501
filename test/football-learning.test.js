'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createLearning}=require('../football-learning');
const kickoff=Date.parse('2026-11-01T20:00:00Z');
function fixture(t){
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'unit501-learning-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
 let clock=kickoff-1000,calls=0;
 const engine={project:()=>({available:true,away:21,home:28,modelVersion:'m1'}),simulate:()=>{calls++;return {conditional:{win:.3},calibrated:{win:null},tie:.02};}};
 const open=()=>createLearning({directory,engine,now:()=>clock});
 const game={game:{id:42,date:{timestamp:kickoff/1000},status:{short:'NS'}},league:{id:1,season:2026},teams:{away:{id:5},home:{id:8}}};
 const query={league:'1',season:'2026',before:kickoff,away:'5',home:'8'};
 return {open,game,query,time:n=>{clock=n;},calls:()=>calls};
}
test('central baseline is immutable, survives restart, and grades an exact final only once',async t=>{
 const f=fixture(t),unit=f.open(),slate={response:[f.game]};
 unit.observe(slate);unit.capture(f.query,{});unit.capture(f.query,{});assert.equal(f.calls(),1);
 const next=f.open();f.time(kickoff+5*3600000);
 const final=structuredClone(f.game);final.game.status.short='FT';final.scores={away:{total:17},home:{total:30}};
 next.observe({response:[{...final,teams:{away:{id:8},home:{id:5}}}]});
 next.observe({response:[{...final,scores:{away:{total:null},home:{total:30}}}]});
 assert.equal(next.summary().groups[0].graded,0);
 await next.refresh(async url=>{assert.match(url,/date=2026-11-01/);return {response:[final]};});
 const g=next.summary().groups[0];
 assert.equal(g.captured,1);assert.equal(g.graded,1);assert.equal(g.meanTeamScoreError,3);assert.equal(g.homeWin.games,1);assert.ok(Math.abs(g.homeWin.brier-.09)<1e-10);
 await next.refresh(async()=>assert.fail('already graded'));
});
test('unknown, unmatched and post-kickoff games cannot create forecasts',t=>{
 const f=fixture(t),unit=f.open();unit.capture(f.query,{});unit.observe({response:[f.game]});unit.capture({...f.query,before:kickoff+1},{});
 f.time(kickoff);unit.capture(f.query,{});assert.equal(f.calls(),0);assert.deepEqual(unit.summary().groups,[]);
});
test('real scoring engine produces a reviewable forecast using complete pregame ranks',t=>{
 const f=fixture(t),dir=fs.mkdtempSync(path.join(os.tmpdir(),'unit501-real-'));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const unit=createLearning({directory:dir,now:()=>kickoff-60000});
 unit.observe({response:[f.game]});
 const teams=Array.from({length:32},(_,i)=>({id:String(i+1),games:3,metrics:Object.fromEntries(['pointsFor','pointsAgainst'].map(k=>[k,{games:3,average:19+i/3,rank:i+1,pool:32}]))}));
 unit.capture(f.query,{before:kickoff,season:'2026',teams,coverage:{pointsFor:{ranked:true,expected:32},pointsAgainst:{ranked:true}}});
 assert.equal(unit.summary().groups[0].captured,1);
});
