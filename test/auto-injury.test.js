'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {evaluate}=require('../public/auto-injury');
const now=2000000;
const game={id:'90',league:'1',season:'2026',kickoff:now+3600000,awayId:'1',homeId:'2',a:'Seattle',h:'Denver'};
const build=()=>{
 const t=(id)=>({id,
  roster:{available:true,checkedAt:now,rows:[]},
  injuries:{available:true,checkedAt:now,rows:[]},
  official:{available:true,checkedAt:now,gameId:game.id,kickoff:game.kickoff,league:'1',season:'2026',
    url:'https://nfl.com/injuries',rows:[]},
  depth:{available:true,checkedAt:now,gameId:game.id,kickoff:game.kickoff,rows:[]}
 });
 return {current:true,teams:[t('1'),t('2')]};
};
function add(data,teamId,{id,name,position,rank=1,status='Out'}){
 const t=data.teams.find(t=>t.id===teamId);
 t.roster.rows.push({id,name,position});
 t.official.rows.push({id,teamId,name,status});
 t.depth.rows.push({id,position,rank,slot:position+':0'});
}
test('verified top-depth defensive starters receive bounded, transparent scenario points',()=>{
 const d=build();
 add(d,'2',{id:'10',name:'CB Starter',position:'CB'});
 add(d,'2',{id:'11',name:'Safety Starter',position:'S'});
 const r=evaluate(d,game,null,now);
 assert.equal(r.ready,true);assert.equal(r.injury.homeDefense,1);
 assert.equal(r.injury.homeOffense,0);assert.equal(r.injury.awayOffense,0);
 assert.deepEqual(r.applied.map(p=>[p.name,p.points]),[['CB Starter',0.5],['Safety Starter',0.5]]);
 assert.match(r.message,/uncalibrated|not validated|not measured/);
});
test('same player multiple official rows cannot double count, and per-team position caps apply',()=>{
 const d=build();for(let i=0;i<7;i++)add(d,'2',{id:String(10+i),name:'DB '+i,position:'CB'});
 d.teams[1].official.rows.push({...d.teams[1].official.rows[0]});
 const r=evaluate(d,game,null,now);
 assert.equal(r.injury.homeDefense,2);assert.equal(r.applied.length,4);
 assert.ok(r.withheld.some(s=>s.includes('capped')));
});
test('unmatched, stale, future, foreign-matchup, ambiguous and non-starter inputs do not add points',()=>{
 const d=build();add(d,'2',{id:'5',name:'Unmatched',position:'CB'});
 d.teams[1].roster.rows=[];
 assert.equal(evaluate(d,game,null,now).injury.homeDefense,0);
 d.teams[1].roster.rows=[{id:'5',name:'Unmatched',position:'CB'}];
 d.teams[1].depth.rows[0].rank=2;
 assert.equal(evaluate(d,game,null,now).injury.homeDefense,0);
 d.teams[1].depth.rows[0].rank=1;
 d.teams[1].depth.checkedAt=now-3600001;
 assert.equal(evaluate(d,game,null,now).injury.homeDefense,0);
 d.teams[1].depth.checkedAt=now;
 d.teams[1].official.gameId='wrong';
 assert.equal(evaluate(d,game,null,now).injury.homeDefense,0);
 d.teams[1].official.gameId=game.id;
 d.teams[1].official.checkedAt=now+1;
 assert.equal(evaluate(d,game,null,now).injury.homeDefense,0);
 d.teams[1].official.checkedAt=now;
 d.teams[1].depth.rows.push({...d.teams[1].depth.rows[0]});
 assert.equal(evaluate(d,game,null,now).injury.homeDefense,0);
});
test('questionable, conflicting or previously reported injury statuses are withheld',()=>{
 const d=build();add(d,'2',{id:'5',name:'Defender',position:'CB',status:'Questionable'});
 assert.equal(evaluate(d,game,null,now).injury.homeDefense,0);
 d.teams[1].official.rows[0].status='Out';
 d.teams[1].injuries.rows.push({id:'5',teamId:'2',status:'Active',date:new Date(now).toISOString()});
 assert.equal(evaluate(d,game,null,now).injury.homeDefense,0);
 d.teams[1].injuries.rows[0].status='Out';
 d.rosterOwnership={available:true,checkedAt:now,conflicts:[{id:'5',teamIds:['2','3']}]};
 assert.equal(evaluate(d,game,null,now).injury.homeDefense,0);
 d.rosterOwnership.conflicts=[];
 assert.equal(evaluate(d,game,null,now).injury.homeDefense,0.5);
});
test('reported QB absences are reviewed, not valued by a generic point guess',()=>{
 const d=build();add(d,'1',{id:'8',name:'Starting QB',position:'QB'});
 const r=evaluate(d,game,null,now);
 assert.equal(r.injury.awayOffense,0);assert.equal(r.applied.length,0);
 assert.match(r.withheld.join(' '),/requires confirmed replacement/);
});
test('already-reviewed lineup role does not get a second automatic offensive deduction',()=>{
 const d=build();add(d,'1',{id:'7',name:'WR One',position:'WR'});
 const without=evaluate(d,game,null,now);
 assert.equal(without.injury.awayOffense,0.35);
 const lineup={gameId:game.id,kickoff:game.kickoff,props:{'1:7':{receiving:{scale:0}}}};
 const r=evaluate(d,game,lineup,now);
 assert.equal(r.injury.awayOffense,0);
 assert.match(r.withheld.join(' '),/already has a lineup scenario/);
});
test("one team's missing official or depth coverage blocks adjustment to both sides",()=>{
 const d=build();add(d,'1',{id:'5',name:'Away Starter',position:'CB'});
 d.teams[1].official.available=false;
 const out=evaluate(d,game,null,now);
 assert.equal(out.ready,false);assert.equal(out.injury.awayDefense,0);
 assert.equal(out.injury.homeDefense,0);
 assert.equal(out.applied.length,0);
 assert.match(out.message,/No automatic points for either team/);
});

test('no live data, post-kickoff and non-NFL games never imply health or adjustments',()=>{
 assert.equal(evaluate(null,game,null,now).injury.homeDefense,0);
 assert.match(evaluate(null,game,null,now).message,/unknown, not healthy/);
 assert.equal(evaluate(build(),{...game,kickoff:now},null,now).ready,false);
 assert.equal(evaluate(build(),{...game,league:'2'},null,now).ready,false);
});
