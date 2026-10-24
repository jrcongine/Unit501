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

test('workload summary preserves recent calendar gaps and real zeros without promoting older games',()=>{
 const {workloadSummary,reviewChecks}=require('../public/player-form');
 const games=[{gameDate:1,carries:24,targets:5,attempts:30},{gameDate:4},{gameDate:3,carries:0},{gameDate:2,carries:12},{carries:999},{gameDate:0,carries:-1}];
 const result=workloadSummary(games,'rushYds');
 assert.deepEqual(result.recent,[null,0,12]);assert.equal(result.average,12);assert.equal(result.recorded,3);assert.equal(result.total,5);assert.equal(result.missing,2);
 assert.match(result.text,/missing, 0, 12/);assert.match(result.text,/3\/5 games recorded/);
 assert.equal(workloadSummary(games,'recYds').metric,'targets');assert.equal(workloadSummary(games,'rec').metric,'targets');assert.equal(workloadSummary(games,'passYds').metric,'attempts');
 assert.equal(workloadSummary([],'carries').average,null);
 const flags=reviewChecks({values:[1,2,3,4,5],form:{coverage:{missing:0}},workload:100,workloadHistory:result},{savedAt:1000},null,1000);
 assert.ok(flags.includes('Verify current workload'));
});

test('efficiency outlier damping reduces a single explosion without rewriting recorded outcomes',()=>{
 const {project}=require('../public/player-form');
 const rows=[40,40,40,400].map((recYds,i)=>({gameDate:i+1,rec:4,recYds}));
 const result=project(rows,'recYds');
 assert.equal(result.usage.dampened,1);assert.equal(result.usage.efficiencyCap,15);
 assert.equal(result.baseline,42.5);assert.equal(result.average,130);
 assert.deepEqual(result.values,[400,40,40,40]);assert.equal(rows[3].recYds,400);
 const stable=project(rows.map(g=>({...g,recYds:40})),'recYds');
 assert.equal(stable.baseline,40);assert.equal(stable.usage.dampened,0);
 const small=project(rows.slice(1),'recYds');assert.equal(small.usage.dampened,0);
 const negative=project(rows.map(g=>({...g,recYds:-4})),'recYds');assert.equal(negative.baseline,-4);
});
test('sustained higher efficiency is retained rather than treated as a single outlier',()=>{
 const {project}=require('../public/player-form');
 const rows=[40,40,100,100,100].map((recYds,i)=>({gameDate:i+1,rec:4,recYds}));
 const result=project(rows,'recYds');assert.equal(result.usage.dampened,0);assert.ok(result.baseline>70);
});

test('data support separates sample depth from model confidence and betting value',()=>{
  const {dataSupport}=require('../public/player-form');
  const model=count=>({values:Array(count).fill(50),form:{coverage:{recorded:count,total:count,missing:0,latestMissing:false}},workload:100,workloadHistory:{missing:0}});
  const thin=dataSupport(model(4),null);
  assert.equal(thin.sample,'Thin sample');assert.equal(thin.count,4);assert.equal(thin.needsReview,true);
  const developing=dataSupport(model(5),null);
  assert.equal(developing.sample,'Developing sample');assert.equal(developing.needsReview,false);
  const larger=dataSupport(model(9),null);
  assert.equal(larger.sample,'Larger sample');assert.equal(larger.needsReview,false);
  assert.match(larger.label,/No additional data flags/);
  assert.equal(larger.label.includes('probability'),false);
});

test('data support surfaces stat gaps, changing workload, outliers, scenarios and conditional availability',()=>{
  const {dataSupport}=require('../public/player-form');
  const dirty=dataSupport({
    values:Array(10).fill(100),
    form:{coverage:{recorded:10,total:12,missing:2,latestMissing:true},usage:{dampened:1},usageUnavailable:'Missing usage'},
    workload:75,workloadWarning:'Role changed',workloadHistory:{missing:1},lineupChange:{}
  },{state:'conditional'});
  assert.equal(dirty.sample,'Larger sample');assert.equal(dirty.needsReview,true);
  for(const flag of ['stat gaps','latest stat missing','workload uncertainty','efficiency outlier adjustment','scenario input','conditional availability'])
    assert.ok(dirty.flags.includes(flag),flag);
  assert.equal(dataSupport({
    values:Array(9).fill(0),form:{coverage:{recorded:9,total:9,missing:0}},
    workload:100,workloadHistory:{missing:0}
  },{state:'unknown'}).needsReview,false);
});

test('an isolated 229-yard receiving game is dampened when missing workload forces a fallback',()=>{
 const {project,dataSupport,reviewChecks}=require('../public/player-form');
 const history=[
  {gameDate:6}, // Latest completed team game has no recorded stat: never impute a zero.
  {gameDate:5,recYds:31},
  {gameDate:4,recYds:31},
  {gameDate:3,recYds:229},
  {gameDate:2,recYds:16},
  {gameDate:1,recYds:60}
 ];
 const model=project(history,'recYds');
 assert.equal(model.coverage.recorded,5);
 assert.equal(model.coverage.missing,1);
 assert.equal(model.coverage.latestMissing,true);
 assert.equal(model.values.includes(229),true);
 assert.ok(model.weighted>70,'Raw formula shows an exaggerated yardage estimate');
 assert.equal(model.usage,null);
 assert.equal(model.outlierAdjustment.count,1);
 assert.ok(model.outlierAdjustment.cap<229);
 assert.ok(model.baseline<55,'Fallback estimate limits the one-game spike');
 assert.ok(model.baseline>30,'Fallback is not just an arbitrary zero or median');
 assert.equal(history[3].recYds,229,'Historical game result must not be changed');
 const support=dataSupport({...model,values:model.values,form:model,workload:100,workloadHistory:{missing:6}},null);
 assert.ok(support.needsReview);
 assert.match(support.label,/yardage spike dampened/);
 const checks=reviewChecks({...model,form:model,workload:100,workloadHistory:{missing:6}},{savedAt:Date.now()},null);
 assert.ok(checks.includes('Review outlier-adjusted yardage'));
});
test('consistent receiving production is not suppressed by spike safeguard',()=>{
 const {project}=require('../public/player-form');
 const history=[90,85,80,75,70].map((recYds,i)=>({gameDate:10-i,recYds}));
 const model=project(history,'recYds');
 assert.equal(model.outlierAdjustment,null);
 assert.equal(model.baseline,model.weighted);
});

 test('cover ordering compares rates across metrics and preserves pushes and unknowns',()=>{
 const {compareCovers}=require('../public/player-form');
 const row=(name,values,line=10)=>({record:{name},def:{key:name},values,line});
 const frequent=row('frequent',[11,12,13,0]);
 const perfect=row('perfect',[11,12]);
 const pushes=row('pushes',[10,10,10]);
 const unders=row('unders',[0,0,0]);
 const unknown=row('unknown',[]);
 assert.deepEqual([frequent,unknown,perfect].sort((a,b)=>compareCovers(a,b,'most-covers')).map(r=>r.record.name),['perfect','frequent','unknown']);
 assert.deepEqual([pushes,unknown,unders,perfect].sort((a,b)=>compareCovers(a,b,'least-covers')).map(r=>r.record.name),['unders','pushes','perfect','unknown']);
 });
