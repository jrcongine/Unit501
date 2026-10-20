const {test}=require('node:test');
const assert=require('node:assert/strict');
const {build,grade}=require('../public/power-ratings');
const {project}=require('../public/team-model');

function fixture(size=32){
  const league=size===32?'1':'2';
  const teams=Array.from({length:size},(_,i)=>{
    const fields={
      pointsFor:32-i*.2,pointsAgainst:14+i*.2,
      passFor:290-i,passAgainst:180+i,
      rushFor:150-i*.5,rushAgainst:90+i*.5
    };
    const metrics=Object.fromEntries(Object.entries(fields).map(([key,average])=>
      [key,{average,games:4,rank:i+1,pool:size}]));
    return {id:String(i),name:'Team '+String(i).padStart(3,'0'),games:4,metrics,opponents:[]};
  });
  const coverage=Object.fromEntries(Object.keys(teams[0].metrics).map(k=>
    [k,{ranked:true,expected:size,complete:size}]));
  const game={league,season:'2026',kickoff:1000,awayId:'0',homeId:'1',a:'Team 000',h:'Team 001'};
  return {game,data:{season:'2026',before:1000,teams,coverage,detailCoverage:{limited:true}}};
}
test('power leaderboard covers the complete league and sorts with neutral-field point units',()=>{
  const {game,data}=fixture();
  const result=build(data,game);
  assert.equal(result.available,true);
  assert.equal(result.teams.length,32);
  assert.equal(result.teams[0].rank,1);
  assert.equal(result.teams[0].overallGrade,10);
  assert.equal(result.teams[31].overallGrade,1);
  assert.ok(result.teams.every((t,i)=>i===0||result.teams[i-1].rating>=t.rating));
  assert.ok(result.teams[0].rating>result.teams[31].rating);
  assert.ok(result.teams.every(t=>t.grades.length===6));
  assert.equal(result.scheduleAdjusted,false);
});
test('grades map verified best and worst league ranks to 10 and 1; invalid is unknown',()=>{
  assert.equal(grade(1,32),10);assert.equal(grade(32,32),1);
  assert.equal(grade(1,138),10);assert.equal(grade(138,138),1);
  for(const r of [0,33,NaN,1.25,null])assert.equal(grade(r,32),null);
});
test('fewer points allowed is a stronger defensive grade, not weaker',()=>{
  const {game,data}=fixture();const teams=build(data,game).teams;
  assert.equal(teams.find(t=>t.id==='0').grades.find(g=>g.key==='pointsAgainst').grade,10);
  assert.equal(teams.find(t=>t.id==='31').grades.find(g=>g.key==='pointsAgainst').grade,1);
});
test('withhold all rankings for missing scoring data or incomplete verified field',()=>{
  const {game,data}=fixture();
  data.teams.pop();assert.equal(build(data,game).available,false);
  const fresh=fixture();
  fresh.data.coverage.pointsFor.ranked=false;assert.equal(build(fresh.data,fresh.game).available,false);
  fresh.data.coverage.pointsFor.ranked=true;
  fresh.data.teams[1].metrics.pointsAgainst.games=3;assert.equal(build(fresh.data,fresh.game).available,false);
});
test('rankings use only the pre-kickoff season snapshot, not future or wrong-season data',()=>{
  const {game,data}=fixture();
  assert.equal(build(data,{...game,kickoff:1001}).available,false);
  assert.equal(build(data,{...game,season:'2027'}).available,false);
});
test('scoring grades remain when sampled passing/rushing reports prevent yardage grades',()=>{
  const {game,data}=fixture();
  for(const key of ['passFor','passAgainst','rushFor','rushAgainst'])data.coverage[key].ranked=false;
  const result=build(data,game);
  assert.equal(result.available,true);
  const team=result.teams[0];
  assert.equal(team.grades.filter(g=>g.grade!==null).length,2);
  assert.ok(team.grades.filter(g=>g.grade===null).every(g=>g.rank===null));
  assert.equal(result.detailLimited,true);
});
test('apply schedule adjustment only when every team has a verified full schedule',()=>{
  const {game,data}=fixture();
  const raw=build(data,game);
  assert.equal(raw.scheduleAdjusted,false);
  for(let i=0;i<32;i++){
    data.teams[i].opponents=Array.from({length:4},(_,j)=>({id:String((i+j+1)%32),scored:25,allowed:22}));
  }
  const corrected=build(data,game);
  assert.equal(corrected.scheduleAdjusted,true);
  assert.equal(corrected.scheduleCoverage,32);
  data.teams[31].opponents.pop();
  const withheld=build(data,game);
  assert.equal(withheld.scheduleAdjusted,false);
  assert.equal(withheld.scheduleCoverage,31);
  const rawById=new Map(raw.teams.map(t=>[t.id,t.rating]));
  assert.ok(withheld.teams.every(t=>t.rating===rawById.get(t.id)));
});
test('FBS ratings use the full verified 138-school pool',()=>{
  const {game,data}=fixture(138);
  const result=build(data,game);
  assert.equal(result.available,true);
  assert.equal(result.expected,138);
  assert.equal(result.teams.length,138);
});
test('display calculation does not alter existing football score predictions',()=>{
  const {game,data}=fixture();
  const before=project(data,game);
  const snapshot=JSON.stringify(data);
  build(data,game);
  assert.equal(JSON.stringify(data),snapshot);
  const after=project(data,game);
  assert.equal(before.available,true);
  assert.equal(before.away,after.away);
  assert.equal(before.home,after.home);
  assert.equal(before.modelVersion,after.modelVersion);
});
