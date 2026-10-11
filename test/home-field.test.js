'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {fitHomeField}=require('../home-field'),{venueEffect}=require('../public/team-model');
const games=require('../data/nfl-home-field-games-2024-2025.json'),profile=require('../public/home-field-profiles.json');
test('home-field fit excludes future results, requires full team pool and rejects conflicting game records',()=>{
 const cutoff=Date.parse('2025-03-01T00:00:00Z'),first=fitHomeField(games,cutoff),training=games.filter(g=>g.season==='2024');
 assert.deepEqual(first,fitHomeField(training,cutoff));
 assert.ok(first.historyThrough<cutoff);assert.equal(first.teams.length,32);assert.ok(first.teams.every(t=>t.margin>=0&&t.margin<=5));
 const one=training.find(g=>g.status==='FT');assert.throws(()=>fitHomeField([...training,{...one,homeScore:one.homeScore+1}],cutoff),/Conflicting/);
 assert.throws(()=>fitHomeField(training.filter(g=>g.homeId!=='23'&&g.awayId!=='23'),cutoff),/32-team/);
});
test('optional team estimate is exact-season scoped and neutral or unverified venues override context',()=>{
 const game={league:'1',season:'2026',kickoff:Date.parse('2026-10-11T17:00:00Z'),homeId:'17',venueName:'Test Stadium'},home={homeVenues:{teststadium:3}},away={homeVenues:{}};
 const settings={variableHomeField:true,homeFieldProfile:profile,homeContext:1.5},estimate=profile.teams.find(t=>t.id==='17').margin;
 const v=venueEffect(game,home,away,'auto',settings);assert.equal(v.margin,estimate+1.5);assert.equal(v.variable,true);assert.equal(v.context,1.5);
 assert.equal(venueEffect(game,home,away,'auto').margin,2);
 assert.equal(venueEffect(game,home,away,'neutral',settings).margin,0);
 assert.equal(venueEffect({...game,venueName:'Unknown'},home,away,'auto',settings).margin,0);
 for(const invalid of [{...profile,season:'2025'},{...profile,before:game.kickoff+1},{...profile,teams:profile.teams.slice(1)},{...profile,teams:profile.teams.map(t=>({...t,id:'17'}))}])assert.equal(venueEffect(game,home,away,'home',{...settings,homeFieldProfile:invalid}).variable,false);
 for(const homeContext of [-1,3.1,NaN,Infinity])assert.equal(venueEffect(game,home,away,'home',{homeContext}).valid,false);
 assert.ok(profile.validation.games>=30);assert.equal(profile.validation.automatic,false);assert.ok(profile.validation.candidateMarginMAE>profile.validation.baselineMarginMAE);
});
