const {test}=require('node:test');
const assert=require('node:assert/strict');
const {adjust}=require('../public/star-power');
test('game-day and rivalry modifiers are opt-in, bounded player-only scenarios',()=>{
 const game={kickoff:Date.parse('2026-10-22T20:15:00-04:00')};
 const normal=adjust(80,'off',game),boost=adjust(80,'boost',game);
 const dud=adjust(80,'dud',game),fatigue=adjust(80,'fatigue',game);
 assert.equal(normal.adjusted,80);assert.equal(normal.applied,false);
 assert.equal(boost.adjusted,88);assert.equal(boost.applied,true);
 assert.match(boost.label,/⚡/);assert.match(dud.label,/⚡/);assert.match(fatigue.label,/😴/);
 assert.equal(dud.adjusted,72);assert.equal(fatigue.adjusted,76);
 assert.equal(boost.weekday,'Thursday');
 assert.match(boost.warning,/short week/i);
 assert.equal(adjust(80,'invalid',game).adjusted,80);
 assert.equal(adjust(80,'boost',game).baseline,80);
});
test('invalid numbers are withheld, and no gameday fixture is required',()=>{
 assert.equal(adjust(-1,'boost'),null);
 assert.equal(adjust(Infinity,'boost'),null);
 assert.equal(adjust(NaN,'boost'),null);
 assert.equal(adjust(0,'boost').adjusted,0);
 assert.equal(adjust(20,'boost').weekday,null);
});
