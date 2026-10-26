'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {windowFor,compare,audit}=require('../scripts/primetime-audit');
const archive=require('../data/nfl-home-field-games-2024-2025.json');
test('NFL kickoff windows use Central time and handle daylight saving',()=>{
 // Sunday 12:00 / 18:00 Central, before and after daylight saving ends.
 for(const date of ['2024-10-13T17:00:00Z','2024-11-10T18:00:00Z'])assert.equal(windowFor(Date.parse(date)),'sundayDay');
 for(const date of ['2024-10-13T23:00:00Z','2024-11-11T00:00:00Z','2024-10-11T00:15:00Z','2024-11-12T01:15:00Z'])assert.equal(windowFor(Date.parse(date)),'evening');
 for(const date of ['2024-10-12T23:00:00Z','2024-10-13T10:00:00Z','2024-10-14T17:00:00Z'])assert.equal(windowFor(Date.parse(date)),null);
 assert.equal(windowFor(NaN),null);
});
test('summary distinguishes model favorite from bookmaker favorite and excludes ties',()=>{
 const r=(normal,actualAway,actualHome)=>({id:'1',kickoff:1,normal,scenario:normal,actualAway,actualHome});
 const report=compare([r({away:20,home:24},21,30),r({away:24,home:20},21,30),r({away:24,home:24},20,30),r({away:20,home:24},20,20)]);
 assert.equal(report.modelFavoriteWins,1);assert.equal(report.modelFavoriteLosses,1);
 assert.equal(report.baseline.games,4);assert.equal(report.scenario.games,4);
});
test('replay is independent of schedule order and rejects duplicate completed games',()=>{
 assert.deepEqual(audit(archive),audit([...archive].reverse()));
 assert.throws(()=>audit([...archive,archive[0]]),/Duplicate/);
});
