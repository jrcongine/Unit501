'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {evaluate}=require('../public/auto-injury');
const {assess}=require('../public/injury-model');
const {createQuarterbackImpact}=require('../quarterback-impact');

const now=2000000;
const game={id:'90',league:'1',season:'2026',kickoff:now+3600000,awayId:'1',homeId:'2',a:'Philadelphia',h:'Dallas'};
const team=id=>({
  id,
  roster:{available:true,checkedAt:now,rows:[]},
  injuries:{available:true,checkedAt:now,rows:[]},
  official:{available:true,checkedAt:now,gameId:game.id,kickoff:game.kickoff,league:'1',season:'2026',url:'https://www.nfl.com/injuries/league/2026/reg8',rows:[]},
  depth:{available:true,checkedAt:now,gameId:game.id,kickoff:game.kickoff,rows:[]}
});
const setup=()=>({current:true,teams:[team('1'),team('2')]});

test('IR defensive starter missing from weekly Out report is counted once',()=>{
  const data=setup(),t=data.teams[0];
  t.roster.rows.push({id:'22',name:'IR Corner',position:'CB',group:'Injured Reserve'});
  t.depth.rows.push({id:'22',position:'CB',rank:1,slot:'CB:0'});
  let result=evaluate(data,game,null,now);
  assert.equal(result.ready,true);
  assert.equal(result.injury.awayDefense,.5);
  assert.equal(result.applied[0].status,'Injured reserve');
  assert.equal(result.applied[0].evidence,null);
  // A player in both the weekly report and IR must never be counted twice.
  t.official.rows.push({id:'22',teamId:'1',name:'IR Corner',status:'Out'});
  result=evaluate(data,game,null,now);
  assert.equal(result.injury.awayDefense,.5);
  assert.equal(result.applied.length,1);
});

test('IR requires current matching roster and cannot override conflicting statuses',()=>{
  const data=setup(),t=data.teams[0];
  t.roster.rows.push({id:'22',name:'IR Corner',position:'CB',group:'Injured Reserve'});
  t.depth.rows.push({id:'22',position:'CB',rank:1,slot:'CB:0'});
  t.official.rows.push({id:'22',teamId:'1',name:'IR Corner',status:'Questionable'});
  assert.equal(evaluate(data,game,null,now).injury.awayDefense,0);
  t.official.rows=[];
  t.injuries.rows=[{id:'22',teamId:'1',status:'Active',date:new Date(now).toISOString()}];
  assert.equal(evaluate(data,game,null,now).injury.awayDefense,0);
  t.injuries.rows=[];
  t.roster.checkedAt=now-3600001;
  assert.equal(evaluate(data,game,null,now).ready,false);
});

test('IR QB is shown as unavailable, not just a healthy nonstarter',()=>{
  const data=setup(),t=data.teams[0];
  t.roster.rows.push({id:'10',name:'Jalen Hurts',position:'QB',group:'Injured Reserve'});
  t.roster.rows.push({id:'11',name:'Backup QB',position:'QB',group:'Active'});
  t.starters={available:true,gameId:game.id,kickoff:game.kickoff,checkedAt:now,
    rows:[{id:'11',position:'QB',name:'Backup QB',publisher:'Team',publishedAt:new Date(now).toISOString()}]};
  assert.equal(assess(data,game,'1','10',now,true).state,'unavailable');
  const r=evaluate(data,game,null,now);
  assert.equal(r.injury.awayOffense,0);
  assert.ok(r.withheld.some(s=>s.includes('Jalen Hurts (QB)')&&s.includes('no automatic points')));
});

test('quarterback-impact fetches replacement evidence for roster-IR QB absent from weekly report',async()=>{
  const data=setup(),t=data.teams[0],paths=[];
  t.roster.rows.push({id:'10',name:'IR QB',position:'QB',group:'Injured Reserve'});
  t.roster.rows.push({id:'11',name:'Backup QB',position:'QB',group:'Active'});
  const api=async p=>{paths.push(p);return {response:[]};};
  const get=createQuarterbackImpact(api,()=>now);
  await get({game:game.id,league:'1',season:'2026'},[t]);
  assert.ok(paths.includes('/games?team=1&season=2026'));
  assert.equal(t.quarterback.rows.length,0); // no invented point estimate without box-score evidence
});
