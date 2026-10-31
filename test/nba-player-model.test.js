'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {project}=require('../public/nba-player-model');
const now=Date.parse('2026-10-26T20:00:00Z'),game={id:5,tipoff:'2026-10-26T23:30:00Z'};
const q={name:'Jalen Smith',market:'player_points',line:14};
function data(){return {gameId:5,tipoff:game.tipoff,checkedAt:now,teams:[{available:true,players:[{name:'Jalen Smith',results:[
 {gameId:1,tipoff:'2026-10-24T20:00:00Z',player_points:14},{gameId:2,tipoff:'2026-10-22T20:00:00Z',player_points:16},{gameId:3,tipoff:'2026-10-20T20:00:00Z',player_points:0}]}]}, {available:true,players:[]}]};}
test('NBA player estimate shows actual above/below/equal counts and includes genuine zero',()=>{
 const r=project(data(),q,game,null,now);assert.equal(r.available,true);assert.equal(r.games,3);assert.equal(r.projection,10);assert.equal(r.above,1);assert.equal(r.below,1);assert.equal(r.equal,1);assert.equal(r.thin,true);
});
test('NBA player estimate withholds OUT, stale, mismatched, ambiguous and insufficient samples',()=>{
 assert.equal(project(data(),q,game,'Out',now).reason,'OUT');
 assert.equal(project(data(),q,game,null,now+1800001).available,false);
 assert.equal(project(data(),q,{...game,id:6},null,now).available,false);
 assert.equal(project(data(),q,game,null,Date.parse(game.tipoff)).available,false);
 const duplicate=data();duplicate.teams[1].players=[structuredClone(duplicate.teams[0].players[0])];assert.equal(project(duplicate,q,game,null,now).available,false);
 const partial=data();partial.teams[1].available=false;assert.equal(project(partial,q,game,null,now).available,true);
 partial.teams[0].available=false;assert.equal(project(partial,q,game,null,now).available,false);
 const fewer=data();fewer.teams[0].players[0].results[1].player_points=null;fewer.teams[0].players[0].results[2].player_points=null;assert.equal(project(fewer,q,game,null,now).available,false);
 const future=data();future.teams[0].players[0].results[0].tipoff=game.tipoff;assert.equal(project(future,q,game,null,now).available,false);
});


test('NBA minutes estimate responds to rotation scenarios without changing recorded results',()=>{
 const d=data();d.teams[0].players[0].results.forEach((r,i)=>{r.minutes=[28,32,10][i];r.player_points=r.minutes/2;});
 const baseline=project(d,q,game,null,now),manual=project(d,q,game,null,now,{minutes:36});
 assert.equal(baseline.method,'recency and minutes');assert.equal(manual.projection,18);
 assert.equal(manual.projectedMinutes,36);assert.equal(manual.method,'manual minutes');
 assert.equal(manual.above,baseline.above);assert.equal(manual.below,baseline.below);
 assert.equal(manual.equal,baseline.equal);assert.equal(manual.average,baseline.average);
 for(const minutes of [0,-1,49,NaN,Infinity,'30'])assert.equal(project(d,q,game,null,now,{minutes}).available,false);
 assert.equal(project(data(),q,game,null,now,{minutes:30}).available,false);
});

test('NBA minutes trends are chronological and never label a confirmed starting role',()=>{
 const d=data();d.teams[0].players[0].results=Array.from({length:5},(_,i)=>({gameId:i+1,tipoff:`2026-10-${24-i*2}T20:00:00Z`,minutes:i<2?32:20,player_points:i<2?16:10})).reverse();
 const r=project(d,q,game,null,now);assert.equal(r.minuteChange.direction,'up');assert.equal(r.minuteChange.recent,32);assert.equal(r.minuteChange.previous,20);
 assert.ok(r.projection>12);assert.ok(r.projectedMinutes<=48);assert.equal(r.games,5);
 const future=data();future.teams[0].players[0].results[0].tipoff='2026-10-26T21:00:00Z';
 assert.equal(project(future,q,game,null,now).available,false);
});


test('NBA props withhold players with an unverified appearance even when other results are valid',()=>{
 const d=data();d.teams[0].players[0].available=false;
 assert.equal(project(d,q,game,null,now).available,false);
});

test('missing NBA projections explain history gaps without implying injury adjustments',()=>{
 assert.equal(project(null,q,game,'Questionable',now).reason,'Player history unavailable');
 const missing=data();missing.teams[0].players=[];
 assert.equal(project(missing,q,game,null,now).reason,'No matched player history');
 const duplicate=data();duplicate.teams[1].players=[structuredClone(duplicate.teams[0].players[0])];
 assert.equal(project(duplicate,q,game,null,now).reason,'Player match is ambiguous');
 const thin=data();thin.teams[0].players[0].results.length=1;
 assert.equal(project(thin,q,game,null,now).reason,'Fewer than 2 verified games');
 assert.equal(project(data(),q,game,null,now+1800001).reason,'Verified history unavailable');
 assert.deepEqual(project(data(),q,game,'Questionable',now),project(data(),q,game,null,now));
 assert.equal(project(null,q,game,'Out',now).reason,'OUT');
});

test('a single missing market value or player game cannot produce a partial-sample estimate',()=>{
 for(const market of ['player_points','player_rebounds','player_assists','player_threes']){
 const d=data(),p=d.teams[0].players[0];p.results.forEach(r=>r[market]=5);p.results[1][market]=null;
 assert.equal(project(d,{...q,market},game,null,now).available,false);
 p.results[1][market]=0;assert.equal(project(d,{...q,market},game,null,now).available,true);
 p.missing=[{gameId:'8'}];assert.equal(project(d,{...q,market},game,null,now).available,false);
 }
});

test('manual player scenarios preserve observed results and never compound',()=>{
 const {withScenario}=require('../public/nba-player-model');
 const base=project(data(),q,game,null,now);
 for(const [mode,factor] of [['off',1],['boost',1.1],['dud',.9],['fatigue',.95]]){
  const result=withScenario(base,mode);
  assert.equal(result.projection,base.projection*factor);
  for(const field of ['games','above','below','equal','average','median','baseline','delta','projectedMinutes'])assert.deepEqual(result[field],base[field]);
  assert.deepEqual(result.recentValues,base.recentValues);
  assert.equal(withScenario(result,mode).projection,result.projection);
  assert.equal(withScenario(result,'off').projection,base.projection);
 }
 assert.equal(withScenario(base,'unknown').projection,base.projection);
 const unavailable=project(data(),q,game,'Out',now);
 assert.deepEqual(withScenario(unavailable,'boost'),unavailable);
 const d=data();d.teams[0].players[0].results.forEach(r=>{r.minutes=20;r.player_points=10;});
 const minutes=project(d,q,game,null,now,{minutes:30});
 assert.equal(withScenario(minutes,'boost').projection,16.5);
 assert.equal(withScenario(minutes,'boost').projectedMinutes,30);
});

test('college regulation minutes cap estimates without altering actual overtime statistics',()=>{
 const d=data();d.teams[0].players[0].results.forEach(r=>{r.minutes=45;r.player_points=45;});
 const nba=project(d,q,game,null,now),college=project(d,q,game,null,now,{regulationMinutes:40});
 assert.equal(nba.projectedMinutes,45);assert.equal(nba.projection,45);
 assert.equal(college.projectedMinutes,40);assert.equal(college.projection,40);
 for(const field of ['average','median','games','above','below','equal'])assert.equal(college[field],nba[field]);
 assert.equal(project(d,q,game,null,now,{regulationMinutes:40,minutes:41}).available,false);
 assert.equal(project(d,q,game,null,now,{regulationMinutes:40,minutes:35}).projection,35);
 assert.equal(project(d,q,game,null,now,{regulationMinutes:45}).available,false);
});

test('basketball minutes trend states the historical comparison sample and hides unavailable estimates',()=>{
 const {minuteChangeText}=require('../public/nba-player-model');const d=data();
 d.teams[0].players[0].results=Array.from({length:5},(_,i)=>({gameId:i+1,tipoff:`2026-10-${24-i*2}T20:00:00Z`,minutes:i<2?32:20,player_points:10}));
 const r=project(d,q,game,null,now,{regulationMinutes:40});
 assert.equal(minuteChangeText(r),'Recent minutes up · 20.0 → 32.0 · last 2 vs earlier 3 games');
 assert.equal(minuteChangeText({...r,available:false}),null);
 assert.equal(minuteChangeText(project(data(),q,game,null,now)),null);
});

test('NBA and college injury gates normalize accents, punctuation and unique missing suffixes',()=>{
 const {injuryStatus}=require('../public/nba-player-model');
 for(const official of [true,false]){
  const report={gameId:game.id,tipoff:game.tipoff,reportAt:now,checkedAt:now,teams:[{available:true,players:[{name:'José O’Neal Jr.',status:'OUT'}]},{available:true,players:[]}]};
  const quote={...q,name:'Jose ONeal'};
  assert.equal(injuryStatus(report,quote,game,now,official),'Out');
  assert.equal(project(data(),quote,game,injuryStatus(report,quote,game,now,official),now).reason,'OUT');
  report.teams[0].players[0].status='Questionable';assert.equal(injuryStatus(report,quote,game,now,official),'Questionable');
  report.teams[0].players.push({name:'Jose ONeal',status:'Active'});
  assert.equal(injuryStatus(report,quote,game,now,official),'Unverified');
  assert.equal(project(data(),q,game,'Unverified',now).available,false);
 }
});

test('injury identity cannot cross suffix conflicts, stale reports or matchups',()=>{
 const {injuryStatus}=require('../public/nba-player-model');
 const report={gameId:game.id,tipoff:game.tipoff,reportAt:now,checkedAt:now,teams:[{available:true,players:[{name:'Jalen Smith Jr.',status:'Out'}]},{available:true,players:[]}]};
 assert.equal(injuryStatus(report,{...q,name:'Jalen Smith III'},game,now),'Unverified');
 assert.equal(injuryStatus(report,q,{...game,id:99},now),'Unverified');
 assert.equal(injuryStatus({...report,reportAt:now-7200001},q,game,now),'Unverified');
 assert.equal(injuryStatus({...report,checkedAt:now-900001},q,game,now,false),'Unverified');
 report.teams[0].available=false;assert.equal(injuryStatus(report,q,game,now),'Unverified');
 assert.equal(injuryStatus(null,q,game,now),null);
 assert.equal(injuryStatus(report,{...q,name:'Different Player'},game,now),null);
});

test('NBA and college histories share unique suffix matching with injury reports',()=>{
 for(const regulationMinutes of [40,48]){
  const d=data();d.teams[0].players[0].name='Jalén Smith Jr.';
  const estimate=project(d,q,game,null,now,{regulationMinutes});
  assert.equal(estimate.available,true);assert.equal(estimate.games,3);assert.equal(estimate.average,10);
  assert.equal(project(d,{...q,name:'Jalen Smith Sr.'},game,null,now,{regulationMinutes}).available,false);
  d.teams[1].players=[{...d.teams[0].players[0],name:'Jalen Smith Sr.'}];
  // Even an exact suffix must not silently choose between a colliding base name.
  for(const name of ['Jalen Smith','Jalen Smith Jr.'])assert.equal(project(d,{...q,name},game,null,now,{regulationMinutes}).available,false);
 }
});

for(const regulationMinutes of [40,48])test(regulationMinutes+' minute basketball excludes DNP and rejects contradictory participation',()=>{
 const d=data(),player=d.teams[0].players[0];
 player.inactive=[{gameId:4,tipoff:'2026-10-18T20:00:00Z'}];
 const p=project(d,q,game,null,now,{regulationMinutes});
 assert.equal(p.available,true);assert.equal(p.games,3);assert.equal(p.below,1);assert.equal(p.equal,1);
 player.inactive.push({gameId:1,tipoff:player.results[0].tipoff});
 assert.equal(project(d,q,game,null,now,{regulationMinutes}).available,false);
 player.inactive=[{gameId:4,tipoff:game.tipoff}];
 assert.equal(project(d,q,game,null,now,{regulationMinutes}).available,false);
});

test('basketball availability wording distinguishes unknown, conditional and listed available',()=>{
 const {availabilityNote}=require('../public/nba-player-model');
 assert.match(availabilityNote(null),/unconfirmed/);
 for(const s of ['Questionable','Doubtful','Probable'])assert.match(availabilityNote(s),/assumes participation/);
 assert.match(availabilityNote('Available'),/starting role and minutes are not confirmed/);
});
