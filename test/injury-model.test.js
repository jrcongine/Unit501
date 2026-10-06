const {test} = require('node:test');
const assert = require('node:assert/strict');
const {assess, workloadProjection} = require('../public/injury-model');
const now = Date.parse('2026-10-06T14:00:00Z');
function fixture(status = 'Out') {
  return {current:true, teams:[{id:'1',
    roster:{available:true,checkedAt:now,rows:[{id:'10',group:'Offense'}]},
    injuries:{available:true,checkedAt:now,rows:[{id:'10',teamId:'1',status,date:'2026-10-06T12:00:00Z'}]}}]};
}
const game = {kickoff:now + 86400000};
const check = data => assess(data, game, '1', '10', now);
test('fresh unavailable status withholds projection only for matching team and player', () => {
  const data = fixture();
  assert.equal(check(data).blocked, true);
  assert.equal(assess(data, game, '2', '10', now).blocked, false);
  assert.equal(assess(data, game, '1', '11', now).blocked, false);
  data.teams[0].injuries.rows[0].teamId = '2';
  assert.equal(check(data).blocked, false);
});
test('questionable and doubtful are conditional, never invented participation probabilities', () => {
  for (const status of ['Questionable','Doubtful','Probable','Active']) {
    assert.equal(check(fixture(status)).blocked, false);
    assert.equal(check(fixture(status)).state, 'conditional');
  }
});
test('missing, stale, future and conflicting reports remain unknown', () => {
  for (const date of [null,'bad','2026-09-01','2026-10-07']) {
    const data=fixture(); data.teams[0].injuries.rows[0].date=date;
    assert.equal(check(data).state,'unknown');
  }
  const data=fixture();
  data.teams[0].injuries.rows.push({...data.teams[0].injuries.rows[0],status:'Active'});
  assert.equal(check(data).state,'unknown');
  data.teams[0].injuries.rows=[];
  assert.equal(check(data).state,'unknown');
  assert.equal(check(null).state,'unknown');
  data.teams[0].injuries.available=false;
  assert.equal(check(data).state,'unknown');
});
test('latest report supersedes older status; expired fetch cannot gate players', () => {
  const data=fixture();
  data.teams[0].injuries.rows.push({...data.teams[0].injuries.rows[0],status:'Active',date:'2026-10-06T13:00:00Z'});
  assert.equal(check(data).blocked,false);
  data.teams[0].injuries.checkedAt=now-900001;
  assert.equal(check(data).state,'unknown');
});
test('current reports never gate historical or distant matchups', () => {
  for (const kickoff of [now-1,now,now+8*86400000,NaN])
    assert.equal(assess(fixture(),{kickoff},'1','10',now).state,'unknown');
  assert.equal(check({...fixture(),current:false}).state,'unknown');
});
test('fresh injured reserve roster gates even without injury coverage; stale roster does not', () => {
  const data=fixture();
  data.teams[0].roster.rows[0].group='Injured Reserve';
  data.teams[0].injuries.available=false;
  assert.equal(check(data).blocked,true);
  data.teams[0].roster.checkedAt=now-3600001;
  assert.equal(check(data).blocked,false);
});
test('explicit workload scenario scales stats and rejects invalid inputs', () => {
  assert.equal(workloadProjection(80,100),80);
  assert.equal(workloadProjection(80,75),60);
  assert.equal(workloadProjection(80,0),0);
  for (const p of [-1,101,NaN,'75']) assert.throws(() => workloadProjection(80,p));
});
