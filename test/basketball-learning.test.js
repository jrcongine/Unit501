'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createBasketballLearning}=require('../basketball-learning');
for(const league of ['nba','ncaab'])test(league+' pregame baseline survives restart and grades only its verified final',async t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'hoops-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
 const tipoff='2026-11-01T20:00:00Z',kickoff=Date.parse(tipoff);let clock=kickoff-10000;
 const open=()=>createBasketballLearning({directory,now:()=>clock});
 const game={id:'1',awayId:'2',homeId:'3',status:'Scheduled',timeKnown:true,stage:2,statusCode:1,tipoff,season:2026,provider:'espn'};
 const slate={league,season:2026,date:'2026-11-01',provider:'espn',games:[game]};
 const side=id=>({id,available:true,season:{games:5,scored:100,allowed:96,pointsFor:100,pointsAgainst:96},
  recentGames:Array.from({length:5},(_,i)=>({for:90+i,against:89+i,scored:90+i,allowed:89+i}))});
 const data={gameId:'1',stage:2,tipoff,checkedAt:clock,away:side('2'),home:side('3')};
 const first=open();first.capture(slate,game,{...data,checkedAt:clock-86400000});assert.deepEqual(first.summary().groups,[]);first.capture(slate,game,{...data,gameId:'other'});assert.deepEqual(first.summary().groups,[]);
 first.capture(slate,game,data);first.capture(slate,game,data);assert.equal(first.summary().groups[0].captured,1);
 clock=kickoff+5*3600000;const next=open(),final={...game,status:'Final',awayScore:96,homeScore:104};
 for(const bad of [{...final,awayId:'4'},{...final,tipoff:'2026-11-01T20:05:00Z'},{...final,awayScore:null},{...final,status:'Live'}])next.observe({...slate,games:[bad]});
 if(league==='nba')next.observe({...slate,provider:'api-nba',games:[{...final,provider:'api-nba'}]});
 assert.equal(next.summary().groups[0].graded,0);
 await next.refresh(async pending=>{assert.equal(pending.provider,'espn');return {...slate,games:[final]};});
 const group=next.summary().groups[0];assert.equal(group.graded,1);assert.equal(group.meanTeamScoreError,4);assert.equal(group.homeWin.games,1);
 await next.refresh(async()=>assert.fail('No further lookup for settled forecast'));
});
