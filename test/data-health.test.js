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
