'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');
const {createHealth}=require('../data-health');
const url=p=>new URL(p,'http://localhost');
const row=(health,id)=>health.snapshot().feeds.find(x=>x.id===id);
test('passive health starts unchecked, isolates sports and retains last success after failure',()=>{
 let now=1800000000000;const h=createHealth({now:()=>now});
 assert.ok(h.snapshot().feeds.every(x=>x.status==='unchecked'));
 h.observe(url('/api/games?league=1'),200,{response:[{id:1}]});
 const success=row(h,'nfl:games').lastSuccessAt;
 assert.equal(row(h,'nfl:games').status,'working');assert.equal(row(h,'ncaaf:games').status,'unchecked');
 now+=1000;h.observe(url('/api/games?league=1'),503,{error:'secret provider URL'});
 assert.equal(row(h,'nfl:games').status,'failed');assert.equal(row(h,'nfl:games').lastSuccessAt,success);
 assert.ok(!JSON.stringify(h.snapshot()).includes('secret'));
 h.observe(url('/api/games?league=1'),400,{});assert.equal(row(h,'nfl:games').status,'failed');
});
test('cached old timestamps stay stale; absent source timestamps stay unknown',()=>{
 let now=1800000000000;const h=createHealth({now:()=>now});
 const data={props:[{updatedAt:now-31*60000,line:12}]};
 h.observe(url('/api/nba/props'),200,data);assert.equal(row(h,'nba:props').status,'stale');
 now+=1000;h.observe(url('/api/nba/props'),200,data);assert.equal(row(h,'nba:props').status,'stale');
 h.observe(url('/api/ncaab/games'),200,{games:[{id:1}]});assert.equal(row(h,'ncaab:games').sourceAt,null);
 now+=31*60000;assert.equal(row(h,'ncaab:games').status,'stale');
});
test('empty and partial coverage never claim complete availability',()=>{
 const h=createHealth();
 h.observe(url('/api/availability?league=1'),200,{current:true,teams:[{roster:{available:true},injuries:{available:false}}]});assert.equal(row(h,'nfl:injuries').status,'partial');
 h.observe(url('/api/nba/injuries'),200,{teams:[{players:[]},{players:[]}]});assert.equal(row(h,'nba:injuries').status,'empty');
 h.observe(url('/api/nba/props'),200,{props:[]});assert.equal(row(h,'nba:props').status,'empty');
 h.observe(url('/api/nba/odds'),200,{available:false});assert.equal(row(h,'nba:odds').status,'unavailable');
 h.observe(url('/api/availability?league=2'),200,{current:false,teams:[]});assert.equal(row(h,'ncaaf:injuries').status,'unavailable');
});
test('War Room source failures and empty feeds are reported separately by league',()=>{
 const h=createHealth();h.observe(url('/api/outside-picks?league=mlb'),200,{sources:[{source:'covers',status:'available'},{source:'wagertalk',status:'unavailable'},{source:'boyds',status:'empty'}]});
 assert.equal(row(h,'mlb:covers').status,'working');assert.equal(row(h,'mlb:wagertalk').status,'failed');assert.equal(row(h,'mlb:boyds').status,'empty');assert.equal(row(h,'nfl:covers').status,'unchecked');
});

test('NBA game lines are working even when the shared response has an empty props array',()=>{
 const h=createHealth();h.observe(url('/api/nba/odds'),200,{available:true,props:[],spread:{away:3.5,updatedAt:Date.now()}});
 assert.equal(row(h,'nba:odds').status,'working');
 h.observe(url('/api/nba/props'),200,{available:false,props:[]});assert.equal(row(h,'nba:props').status,'unavailable');
});

test('a failed whole War Room request invalidates prior source status',()=>{
 const h=createHealth();h.observe(url('/api/outside-picks?league=nba'),200,{sources:[{source:'covers',status:'available'}]});
 h.observe(url('/api/outside-picks?league=nba'),500,{error:'unavailable'});
 assert.equal(row(h,'nba:covers').status,'failed');assert.equal(row(h,'nba:boyds').status,'failed');
});

test('basketball histories with missing games or market values are partial, including verified zeros',()=>{
 for(const sport of ['nba','ncaab']){
 const h=createHealth(),p={results:[{player_points:0,player_rebounds:0,player_assists:0,player_threes:0}],coverage:{missing:0}};
 const observe=()=>h.observe(url('/api/'+sport+'/player-history'),200,{teams:[{available:true,players:[p]}]});
 observe();assert.equal(row(h,sport+':player-history').status,'working');
 p.coverage.missing=1;observe();assert.equal(row(h,sport+':player-history').status,'partial');
 p.coverage.missing=0;p.results[0].player_assists=null;observe();assert.equal(row(h,sport+':player-history').status,'partial');
 }
});
test('official football participation distinguishes unsupported coverage from verified response',()=>{
 const h=createHealth(),u=new URL('http://local/api/football/participation?league=1');
 h.observe(u,200,{response:[{available:false}]});
 assert.equal(h.snapshot().feeds.find(r=>r.id==='nfl:participation').status,'unavailable');
 h.observe(u,200,{response:[{available:true,checkedAt:Date.now()}]});
 assert.equal(h.snapshot().feeds.find(r=>r.id==='nfl:participation').status,'working');
});

test('rate limits invalidate feed status while preserving successful response time',()=>{
 const h=createHealth();const u=url('/api/nba/props');h.observe(u,200,{props:[]});
 const success=row(h,'nba:props').lastSuccessAt;h.observe(u,429,{error:'rate limit'});
 assert.equal(row(h,'nba:props').status,'failed');assert.equal(row(h,'nba:props').lastSuccessAt,success);
});
test('unavailable or partial official injury coverage cannot become an empty healthy report',()=>{
 const h=createHealth();
 for(const league of ['nba','ncaab']){
  const u=url('/api/'+league+'/injuries');
  h.observe(u,200,{available:false,teams:[{players:[]}]});assert.equal(row(h,league+':injuries').status,'unavailable');
  h.observe(u,200,{teams:[{available:false,players:[]},{available:true,players:[]}]});assert.equal(row(h,league+':injuries').status,'partial');
 }
 h.observe(url('/api/availability?league=1'),200,{teams:[{roster:{available:true},injuries:{available:true},official:{available:false}}]});
 assert.equal(row(h,'nfl:injuries').status,'partial');
});
test('football team and player histories are tracked only with explicit league context',()=>{
 const h=createHealth();
 for(const league of ['1','2']){
  const sport=league==='1'?'nfl':'ncaaf';
  h.observe(url('/api/team-games?team=1&league='+league),200,{response:[{id:1}]});
  h.observe(url('/api/player-stats?game=1&league='+league),200,{response:[]});
  assert.equal(row(h,sport+':context').status,'working');assert.equal(row(h,sport+':player-history').status,'empty');
 }
 h.observe(url('/api/player-stats?game=1'),503,{});
 assert.equal(row(h,'nfl:player-history').status,'empty');
});

test('saved health survives restart without renewing timestamps; failures preserve last success',()=>{
 const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'unit-health-')),file=path.join(dir,'health.json');
 let now=1800000000000;
 try{
  const a=createHealth({now:()=>now,file});a.observe(url('/api/nba/odds'),200,{available:true,updatedAt:now,secret:'must not persist'});a.flush();
  const original=row(a,'nba:odds');assert.equal(a.snapshot().storage.persistent,true);
  now+=3600001;const b=createHealth({now:()=>now,file});assert.equal(row(b,'nba:odds').status,'stale');
  assert.equal(row(b,'nba:odds').lastSuccessAt,original.lastSuccessAt);assert.equal(row(b,'nba:odds').sourceAt,original.sourceAt);
  b.observe(url('/api/nba/odds'),503,{error:'private URL'});b.flush();const c=createHealth({now:()=>now,file});
  assert.equal(row(c,'nba:odds').status,'failed');assert.equal(row(c,'nba:odds').lastSuccessAt,original.lastSuccessAt);
  assert.doesNotMatch(fs.readFileSync(file,'utf8'),/secret|private URL|must not persist/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('damaged or oversized persistence files are preserved and never claim durable status',()=>{
 const fs=require('node:fs'),os=require('node:os'),path=require('node:path');const dir=fs.mkdtempSync(path.join(os.tmpdir(),'unit-health-')),file=path.join(dir,'health.json');
 try{for(const bad of ['not json','x'.repeat(262145)]){
  fs.writeFileSync(file,bad);const h=createHealth({file});h.observe(url('/api/nba/games'),200,{games:[]});h.flush();
  assert.equal(h.snapshot().storage.persistent,false);assert.match(h.snapshot().storage.error,/preserved/);assert.equal(fs.readFileSync(file,'utf8'),bad);
 }}finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('unwritable persistence does not interrupt a valid feed response',()=>{
 const h=createHealth({file:'/dev/null/feed-health.json'});h.observe(url('/api/nba/games'),200,{games:[]});assert.doesNotThrow(h.flush);
 assert.equal(row(h,'nba:games').status,'empty');assert.equal(h.snapshot().storage.persistent,false);
});
test('rankings builds, component availability and live-score freshness are distinguished',()=>{
 let now=1800000000000;const h=createHealth({now:()=>now});
 h.observe(url('/api/rankings?league=2'),200,{state:'loading',data:{teams:[]}});
 assert.equal(row(h,'ncaaf:rankings').status,'loading');assert.equal(row(h,'ncaaf:rankings').lastSuccessAt,null);
 h.observe(url('/api/rankings?league=2'),200,{state:'error'});assert.equal(row(h,'ncaaf:rankings').status,'failed');
 h.observe(url('/api/nba/live-watch'),200,{games:[],checkedAt:now});now+=180001;assert.equal(row(h,'nba:live-watch').status,'stale');
 h.observe(url('/api/availability?league=1'),200,{teams:[{roster:{available:true,checkedAt:now},official:{available:false}},{roster:{available:true,checkedAt:now},official:{available:true,checkedAt:now}}]});
 assert.equal(row(h,'nfl:roster').status,'working');assert.equal(row(h,'nfl:official').status,'partial');assert.equal(row(h,'nfl:depth').status,'unavailable');
 h.observe(url('/api/league-pulse?league=mlb'),200,{power:{available:true,asOf:now},headlines:{available:false}});
 assert.equal(row(h,'mlb:standings').status,'working');assert.equal(row(h,'mlb:headlines').status,'unavailable');
 h.observe(url('/api/nba/travel'),200,{away:{available:true},home:{available:false}});assert.equal(row(h,'nba:travel').status,'partial');
});

test('team context telemetry labels known NBA and college history gaps partial',()=>{
 const {assessment}=require('../data-health');
 for(const side of [{unverifiedGames:1},{conflicts:1},{coverage:{unverifiedGames:1}},{coverage:{invalid:1}},{coverage:{conflictingGames:1}}]){
  assert.equal(assessment({away:side,home:{}},'context',Date.now()).status,'partial');
 }
});

test('neutral football player-line endpoint records successful, partial and failed feeds per sport',()=>{
 for(const [league,sport] of [['1','nfl'],['2','ncaaf']]){
  const h=createHealth(),u=url('/api/football/player-lines?league='+league),id=sport+':props';
  h.observe(u,200,{props:[{line:1.5,updatedAt:Date.now()}],audit:{rejected:0,missingMarkets:[]}});assert.equal(row(h,id).status,'working');
  h.observe(u,200,{props:[{line:1.5}],audit:{rejected:0,missingMarkets:['player_receptions']}});assert.equal(row(h,id).status,'partial');
  h.observe(u,503,{error:'source failed'});assert.equal(row(h,id).status,'failed');
 }
 for(const sport of ['nba','ncaab']){
  const h=createHealth();h.observe(url('/api/'+sport+'/props'),200,{props:[{line:10}],audit:{rejected:1,missingMarkets:[]}});assert.equal(row(h,sport+':props').status,'partial');
 }
});
test('unresolved official identities remain partial in aggregate and official subfeed',()=>{
 const h=createHealth(),t={roster:{available:true},injuries:{available:true,rows:[{id:'1'}]},official:{available:true,unmatched:1,rows:[],unresolved:[{name:'Unknown',status:'Out'}]}};
 for(const [league,sport] of [['1','nfl'],['2','ncaaf']]){
  h.observe(url('/api/availability?league='+league),200,{current:true,teams:[t,t]});
  assert.equal(row(h,sport+':injuries').status,'partial');assert.equal(row(h,sport+':official').status,'partial');
 }
});
