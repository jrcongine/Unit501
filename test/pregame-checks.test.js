'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {evaluate}=require('../public/pregame-checks');
const now=1800000000000,game={id:'1',league:'1',season:'2027',awayId:'10',homeId:'20',kickoff:now+3600000};
function fixture(){return {game,now,quotes:{awaySpread:3.5,total:45,spreadUpdated:now,totalUpdated:new Date(now).toISOString()},inputs:{spread:3.5,total:45},availability:{current:true,teams:['10','20'].map(id=>({id,roster:{available:true,rows:[{id:'7'}],checkedAt:now},injuries:{available:true,rows:[],checkedAt:now}}))}};}
const check=(f,id)=>evaluate(f).checks.find(x=>x.id===id);
test('fresh data marks feed checks only; empty injury reports never confirm starters or trades',()=>{
 const f=fixture();for(const id of ['spread','total','rosters','injuries'])assert.equal(check(f,id).status,'checked');
 for(const id of ['starters','changes'])assert.equal(check(f,id).status,'unknown');
 assert.match(check(f,'injuries').message,/do not confirm/);
});
test('checks expire with source time and at kickoff, without fetching anything',()=>{
 const f=fixture();f.now+=1800001;
 assert.equal(check(f,'spread').status,'review');assert.equal(check(f,'injuries').status,'unknown');assert.equal(check(f,'rosters').status,'checked');
 f.now=game.kickoff;assert.equal(evaluate(f).active,false);assert.deepEqual(evaluate(f).checks,[]);
});
test('future or missing quote timestamps and manual edits cannot appear checked',()=>{
 const f=fixture();f.quotes.spreadUpdated=now+1;assert.equal(check(f,'spread').status,'review');
 f.quotes.spreadUpdated=null;assert.equal(check(f,'spread').status,'review');
 f.quotes.spreadUpdated=now;f.inputs.spread=4;assert.equal(check(f,'spread').status,'review');
 f.inputs.spread=null;assert.equal(check(f,'spread').status,'review');
 f.quotes=null;assert.equal(check(f,'spread').status,'unknown');
});
test('missing, duplicate, historical or expired rosters remain unknown',()=>{
 const f=fixture();f.availability.teams[0].roster.rows=[];assert.equal(check(f,'rosters').status,'unknown');
 const g=fixture();g.availability.teams.push(g.availability.teams[0]);assert.equal(check(g,'rosters').status,'unknown');
 const h=fixture();h.availability.current=false;assert.equal(check(h,'injuries').status,'unknown');
 const j=fixture();j.availability.teams[0].roster.checkedAt=now-3600001;assert.equal(check(j,'rosters').status,'unknown');
});
test('official report fallback must match this game and kickoff',()=>{
 const f=fixture();for(const t of f.availability.teams){t.injuries.available=false;t.official={available:true,gameId:game.id,kickoff:game.kickoff,checkedAt:now};}
 assert.equal(check(f,'injuries').status,'checked');f.availability.teams[0].official.gameId='2';assert.equal(check(f,'injuries').status,'unknown');
});
test('reviewed starter announcements never become a complete starting lineup',()=>{
 const f=fixture();for(const t of f.availability.teams)t.starters={gameId:game.id,kickoff:game.kickoff,checkedAt:now,rows:[{publishedAt:new Date(now).toISOString()}]};
 assert.equal(check(f,'starters').status,'unknown');assert.match(check(f,'starters').message,/2 team/);
 f.availability.teams[0].starters.gameId='2';assert.match(check(f,'starters').message,/1 team/);
});
test('ownership conflicts and unverified transactions surface for review',()=>{
 const f=fixture();f.availability.rosterOwnership={conflicts:[{id:'7'}]};assert.equal(check(f,'changes').status,'review');
 const g=fixture();g.availability.teams[0].transactions={unverified:1};assert.equal(check(g,'changes').status,'review');
 assert.equal(evaluate().active,false);
});
