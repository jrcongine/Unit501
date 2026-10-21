'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {sourceFor,sources}=require('../college-injury-sources');
const membership=require('../fbs-2026.json');
test('all 138 known FBS teams resolve exactly once to a season-scoped report source',()=>{
 const listed=require('../fbs-conferences-2026.json').conferences.flatMap(c=>c.teams);
 assert.equal(listed.length,138);assert.equal(new Set(listed).size,138);
 assert.deepEqual([...listed].sort(),membership.teams.map(t=>t.name).sort());
 for(const t of membership.teams){assert.ok(sourceFor(t,'2026'),t.name);assert.equal(sourceFor(t,'2027'),null);}
 assert.equal(sourceFor({name:'Unknown State'},'2026'),null);
 assert.equal(sourceFor({name:'Notre Dame'},'2026').code,'ND');
 assert.equal(sourceFor({name:'UConn'},'2026').code,'UCONN');
 assert.equal(sourceFor({name:'Northern Illinois'},'2026').code,'MW');
 assert.equal(sourceFor({name:'Louisiana Tech'},'2026').code,'SBC');
 assert.equal(sourceFor({name:'Texas State'},'2026').code,'PAC12');
 assert.equal(Object.values(sources).filter(s=>s.provider).length,6);
});
