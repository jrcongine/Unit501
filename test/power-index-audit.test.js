'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {historicalBoard,candidate}=require('../scripts/power-index-audit');
const source=require('../data/nfl-home-field-games-2024-2025.json');
test('historical index excludes cutoff and future results and is independent of row order',()=>{
 const before=Date.parse('2024-11-01T00:00:00Z');
 const baseline=historicalBoard(source,'2024',before);assert.ok(baseline?.available);
 const future=source.map(r=>r.kickoff>=before?{...r,homeScore:200,awayScore:0}:r);
 assert.deepEqual(historicalBoard(future,'2024',before),baseline);
 assert.deepEqual(historicalBoard([...source].reverse(),'2024',before),baseline);
 const atCutoff={...source.find(r=>r.season==='2024'),id:'cutoff',kickoff:before,homeScore:200,awayScore:0};
 assert.deepEqual(historicalBoard([...source,atCutoff],'2024',before),baseline);
});
test('duplicate eligible historical games cannot inflate a research rating',()=>{
 const r=source.find(r=>r.season==='2024');
 assert.throws(()=>historicalBoard([...source,r],'2024',Date.parse('2024-12-01')),/Duplicate/);
});
test('research correction preserves totals, orientation and nonnegative scores and requires verified teams',()=>{
 const game={awayId:'a',homeId:'h'},baseline={available:true,away:20,home:24};
 const board={available:true,teams:[{id:'a',score:20},{id:'h',score:80}]};
 const p=candidate(baseline,board,game);assert.deepEqual(p,{away:17,home:27,marginChange:6});
 const reversed=candidate({available:true,away:24,home:20},board,{awayId:'h',homeId:'a'});
 assert.equal(reversed.away,p.home);assert.equal(reversed.home,p.away);
 const low=candidate({available:true,away:1,home:24},board,game);
 assert.equal(low.away,0);assert.equal(low.home,25);
 assert.equal(candidate(baseline,null,game),null);
 assert.equal(candidate(baseline,board,{awayId:'unknown',homeId:'h'}),null);
});
