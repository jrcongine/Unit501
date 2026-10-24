const {test}=require('node:test'),assert=require('node:assert/strict');
const {consensus}=require('../pick-consensus');
const p={league:'nba',eventDate:'2026-10-24',matchup:'Heat vs Hornets',pick:'Under 231.5 -110',author:'A',url:'https://example.com'};
const source=(id,picks)=>({source:id,name:id,picks});
test('consensus counts named authors, deduplicates repeats and preserves line differences',()=>{
 const result=consensus([source('one',[p,p,{...p,author:'B'}]),source('two',[{...p,pick:'Under 231.5 (-105)'},{...p,pick:'Under 232.5 -110'}])]);
 assert.equal(result.length,1);assert.equal(result[0].count,3);assert.equal(result[0].sources.length,3);
});
test('consensus excludes unknown dates and keeps other games/dates separate',()=>{
 assert.deepEqual(consensus([source('one',[p]),source('two',[{...p,eventDate:null},{...p,eventDate:'2026-10-25'},{...p,matchup:'Bulls vs Hornets'}])]),[]);
});
