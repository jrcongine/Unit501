const {test}=require('node:test');
const assert=require('node:assert/strict');
const {summarize}=require('../public/player-form');
const history=values=>values.map((yards,i)=>({gameDate:100-i,yards}));
test('stable production retains its level and does not invent a talent rating',()=>{
 const form=summarize(history([50,50,50,50,50]),'yards');
 assert.equal(form.average,50);assert.equal(form.weighted,50);
 assert.equal(form.trend,'Holding steady');assert.equal(form.rating,undefined);
});
test('breakout and declining production move baseline while retaining season history',()=>{
 const up=summarize(history([100,100,100,20,20,20,20,20,20,20]),'yards');
 const down=summarize(history([20,20,20,100,100,100,100,100,100,100]),'yards');
 assert.equal(up.values.length,10);assert.ok(up.weighted>up.average);
 assert.ok(up.weighted<100);assert.equal(up.trend,'Trending up');
 assert.ok(down.weighted<down.average);assert.equal(down.trend,'Trending down');
});
test('missing stats remain missing, actual zeros count, and chronology determines weights',()=>{
 const form=summarize(history([100,null,undefined,0,20]).reverse(),'yards');
 assert.deepEqual(form.values,[100,0,20]);assert.equal(form.average,40);
 const missing=summarize(history([100,undefined,undefined,0]),'yards');
 assert.ok(missing.recentWeighted>summarize(history([100,0]),'yards').recentWeighted);
 assert.equal(summarize(history([null,10]),'yards'),null);
});
test('small samples and sparse trends are labeled; negative values and invalid dates excluded',()=>{
 const form=summarize([...history([30,20]),{gameDate:NaN,yards:999},{gameDate:90,yards:-3}],'yards');
 assert.equal(form.values.length,2);assert.equal(form.sample,'Limited sample');
 assert.equal(form.trend,'Insufficient history for a trend');
});
