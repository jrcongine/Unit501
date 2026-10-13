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

test('workload review flags limited appearances without inferring starter status',()=>{
 const {workloadWarning}=require('../public/player-form');
 assert.match(workloadWarning([{gameDate:1,attempts:2},{gameDate:2,attempts:3}],'passYds'),/Limited recorded workload/);
 assert.match(workloadWarning([{gameDate:1},{gameDate:2}],'recYds'),/Workload unverified/);
 assert.equal(workloadWarning([{gameDate:1,attempts:30},{gameDate:2,attempts:32}],'passYds'),null);
});
test('workload review detects both increasing and decreasing recent usage',()=>{
 const {workloadWarning}=require('../public/player-form');
 const rows=values=>values.map((carries,i)=>({gameDate:i+1,carries}));
 assert.match(workloadWarning(rows([3,3,15,15]),'rushYds'),/Workload change/);
 assert.match(workloadWarning(rows([15,15,3,3]),'rushYds'),/Workload change/);
 assert.equal(workloadWarning(rows([10,11,12,11]),'rushYds'),null);
});
test('workload review uses targets for receiving and ignores invalid usage',()=>{
 const {workloadWarning}=require('../public/player-form');
 assert.match(workloadWarning([{gameDate:1,targets:1},{gameDate:2,targets:2}],'rec'),/Limited recorded workload/);
 assert.match(workloadWarning([{gameDate:1,attempts:-1},{gameDate:2,attempts:NaN}],'passTD'),/Workload unverified/);
});
test('undated records cannot contaminate paired yardage efficiency',()=>{
 const {project}=require('../public/player-form');
 const valid=[{gameDate:1,rec:4,recYds:40},{gameDate:2,rec:4,recYds:40}];
 const a=project(valid,'recYds'),b=project([...valid,{gameDate:NaN,rec:1,recYds:10000}],'recYds');
 assert.equal(b.baseline,a.baseline);assert.equal(b.usage.games,2);assert.equal(b.usage.efficiency,10);
});
test('two latest missing games withhold an old appearance baseline even at half coverage',()=>{
 const {project}=require('../public/player-form');
 const form=project([{gameDate:4},{gameDate:3},{gameDate:2,recYds:100,rec:5},{gameDate:1,recYds:50,rec:3}],'recYds');
 assert.equal(form.withheld,true);assert.equal(form.coverage.latestConsecutiveMissing,2);
 const zero=project([{gameDate:4,recYds:0,rec:0},{gameDate:3,recYds:0,rec:0},{gameDate:2,recYds:100,rec:5},{gameDate:1,recYds:50,rec:3}],'recYds');
 assert.equal(zero.withheld,undefined);assert.equal(zero.coverage.latestConsecutiveMissing,0);
});
test('missing latest usage does not import older workload into fresh yardage',()=>{
 const {project}=require('../public/player-form');
 const form=project([{gameDate:3,rushYds:15},{gameDate:2,rushYds:100,carries:20},{gameDate:1,rushYds:100,carries:20}],'rushYds');
 assert.equal(form.usage,null);assert.equal(form.baseline,form.weighted);assert.match(form.usageUnavailable,/Latest workload/);
});
test('missing latest workload is flagged instead of calling older appearances recent',()=>{
 const {workloadWarning}=require('../public/player-form');
 assert.match(workloadWarning([{gameDate:3},{gameDate:2,carries:20},{gameDate:1,carries:20}],'rushYds'),/latest completed team game/);
});

test('prop review keeps participation unknown and flags stale lines and scenario assumptions',()=>{
 const {reviewChecks}=require('../public/player-form');
 const model={values:[40,45,50,55,60],form:{coverage:{missing:0}},workload:100};
 assert.deepEqual(reviewChecks(model,{savedAt:1000},{state:'unknown'},1000),['Verify participation']);
 const flags=reviewChecks({...model,workload:50,workloadWarning:'Role changed',values:[40,45],form:{coverage:{missing:1}}},{savedAt:1000},{state:'conditional'},1801001);
 for(const flag of ['Conditional availability: verify participation','Fewer than 5 recorded games','Missing game statistics','Verify current workload','Scenario-adjusted projection','Refresh line']) assert.ok(flags.includes(flag));
 assert.ok(reviewChecks(model,{savedAt:1001},null,1000).includes('Refresh line'));
});
