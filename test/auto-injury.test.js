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
test("one team's missing coverage does not suppress verified adjustments for its opponent",()=>{
 const d=build();add(d,'1',{id:'5',name:'Away Starter',position:'CB'});
 d.teams[1].official.available=false;
 const out=evaluate(d,game,null,now);
 assert.equal(out.ready,true);assert.equal(out.partial,true);assert.equal(out.injury.awayDefense,0.5);
 assert.equal(out.injury.homeDefense,0);
 assert.equal(out.applied.length,1);
 assert.match(out.message,/Partial coverage/);
});

test('no live data, post-kickoff and unsupported leagues never imply health or adjustments',()=>{
 assert.equal(evaluate(null,game,null,now).injury.homeDefense,0);
 assert.match(evaluate(null,game,null,now).message,/unknown, not healthy/);
 assert.equal(evaluate(build(),{...game,kickoff:now},null,now).ready,false);
 assert.equal(evaluate(build(),{...game,league:'3'},null,now).ready,false);
});

test('college confirmed Out regular contributors adjust points; uncertain and missing roles do not',()=>{
 const d=build(),g={...game,league:'2'};
 add(d,'1',{id:'7',name:'WR One',position:'WR'});
 for(const t of d.teams){t.official.league='2';t.injuryUsage={...t.depth,league:'2',rows:t.depth.rows.map(r=>({id:r.id,position:r.position,role:'recent regular contributor'}))};delete t.depth;}
 assert.equal(evaluate(d,g,null,now).injury.awayOffense,0.35);
 d.teams[0].official.rows[0].status='Questionable';
 assert.equal(evaluate(d,g,null,now).injury.awayOffense,0);
 d.teams[0].official.rows[0].status='Out';
 d.teams[0].injuryUsage.rows=[];
 assert.equal(evaluate(d,g,null,now).injury.awayOffense,0);
 d.teams[1].injuryUsage.checkedAt=now-3600001;
 assert.equal(evaluate(d,g,null,now).partial,true);
});
test('QB score adjustment requires scoped workload and scoring context and cannot duplicate a lineup',()=>{
 const d=build();add(d,'1',{id:'10',name:'Starter',position:'QB'});
 d.teams[0].roster.rows.push({id:'11',name:'Backup',position:'QB'});
 d.teams[0].quarterback={available:true,checkedAt:now,gameId:game.id,kickoff:game.kickoff,rows:[{playerId:'10',replacementId:'11',replacement:'Backup',yardChange:-60,backupAttempts:30,starterAttempts:75}]};
 const context={before:game.kickoff,season:'2026',teams:[{id:'1',games:3,metrics:{pointsFor:{games:3,average:28},passFor:{games:3,average:250},rushFor:{games:3,average:100}}}]};
 assert.equal(evaluate(d,game,null,now,context).quarterback.away,-2.4);
 assert.equal(evaluate(d,game,null,now).quarterback.away,0);
 const lineup={applied:true,gameId:game.id,kickoff:game.kickoff,props:{'1:10':{passing:{scale:0}}}};
 assert.equal(evaluate(d,game,lineup,now,context).quarterback.away,0);
 d.teams[0].quarterback.kickoff++;
 assert.equal(evaluate(d,game,null,now,context).quarterback.away,0);
});

test('offensive line depth labels match provider position families without crossing positions',()=>{
 for(const [provider,chart,points] of [['T','LT',.35],['OT','RT',.35],['G','LG',.3],['OG','RG',.3]]){
  const d=build();add(d,'1',{id:'7',name:'Line Starter',position:provider});
  d.teams[0].depth.rows[0].position=chart;
  assert.equal(evaluate(d,game,null,now).injury.awayOffense,points);
  d.teams[0].depth.rows[0].position='C';
  assert.equal(evaluate(d,game,null,now).injury.awayOffense,0);
 }
});
test('conflict diagnostic names the conflicting provider status and its date without applying points',()=>{
 const d=build();add(d,'1',{id:'7',name:'Player',position:'RB'});
 const date=new Date(now).toISOString();
 d.teams[0].injuries.rows=[{id:'7',teamId:'1',status:'Questionable',date}];
 const result=evaluate(d,game,null,now);
 assert.equal(result.injury.awayOffense,0);
 assert.ok(result.withheld.some(s=>s.includes('official game report: out; provider: Questionable ('+date+')')));
});


test('older generic conditional reports do not cancel current game Out; recent or scoped conflicts remain',()=>{
 const current=Date.parse('2026-10-18T16:22:00Z'),g={...game,kickoff:current+3600000};
 for(const status of ['Questionable','Doubtful']){
  const d=build();add(d,'1',{id:'7',name:'Player',position:'RB'});
  for(const t of d.teams)for(const field of ['roster','injuries','official','depth']){
   t[field].checkedAt=current;
   if(['official','depth'].includes(field))t[field].kickoff=g.kickoff;
  }
  const row={id:'7',teamId:'1',status,date:'2026-10-14'};
  d.teams[0].injuries.rows=[row];
  assert.equal(evaluate(d,g,null,current).injury.awayOffense,.25);
  row.gameId=g.id;
  assert.equal(evaluate(d,g,null,current).injury.awayOffense,0);
  delete row.gameId;row.date='2026-10-18';
  assert.equal(evaluate(d,g,null,current).injury.awayOffense,0);
  row.date='2026-10-14';row.status='Active';
  assert.equal(evaluate(d,g,null,current).injury.awayOffense,0);
  row.status=status;d.teams[0].official.publishedAt=Date.parse('2026-10-13');
  assert.equal(evaluate(d,g,null,current).injury.awayOffense,0);
  d.teams[0].official.publishedAt=Date.parse('2026-10-16');
  assert.equal(evaluate(d,g,null,current).injury.awayOffense,.25);
  d.teams[0].official.checkedAt=current-900001;
  assert.equal(evaluate(d,g,null,current).injury.awayOffense,0);
 }
});

test('broad defensive depth labels use the uniquely matched provider position for scoring',()=>{
 for(const [provider,chart,points] of [['DE','DL',.5],['DT','DL',.3],['CB','DB',.5],['S','DB',.5]]){
  const d=build();add(d,'1',{id:'7',name:'Defender',position:provider});d.teams[0].depth.rows[0].position=chart;
  assert.equal(evaluate(d,game,null,now).injury.awayDefense,points);
  d.teams[0].depth.rows[0].position='LB';assert.equal(evaluate(d,game,null,now).injury.awayDefense,0);
 }
});
test('NFL second-string contributors require current matched workload; backups are not automatically valued',()=>{
 const d=build();add(d,'1',{id:'7',name:'WR Two',position:'WR',rank:2});
 assert.equal(evaluate(d,game,null,now).injury.awayOffense,0);
 d.teams[0].injuryUsage={available:true,checkedAt:now,gameId:game.id,kickoff:game.kickoff,rows:[{id:'7',position:'WR',role:'recent regular contributor'}]};
 assert.equal(evaluate(d,game,null,now).injury.awayOffense,.35);
 assert.equal(evaluate(d,game,null,now).applied[0].role,'recent regular contributor');
 d.teams[0].injuryUsage.gameId='wrong';assert.equal(evaluate(d,game,null,now).injury.awayOffense,0);
 d.teams[0].injuryUsage.gameId=game.id;d.teams[0].injuryUsage.checkedAt=now-3600001;
 assert.equal(evaluate(d,game,null,now).injury.awayOffense,0);
});

test('NFL unique RB2 Out uses smaller depth sensitivity, with workload taking precedence',()=>{
 const d=build();add(d,'1',{id:'7',name:'RB Two',position:'RB',rank:2});
 let r=evaluate(d,game,null,now);
 assert.equal(r.injury.awayOffense,.1);
 assert.equal(r.applied[0].status,'Out');
 assert.match(r.applied[0].role,/RB2.*assumption/);
 d.teams[0].injuryUsage={available:true,checkedAt:now,gameId:game.id,kickoff:game.kickoff,rows:[{id:'7',position:'RB'}]};
 assert.equal(evaluate(d,game,null,now).injury.awayOffense,.25);
 delete d.teams[0].injuryUsage;
 d.teams[0].depth.rows.push({...d.teams[0].depth.rows[0],id:'8'});
 assert.equal(evaluate(d,game,null,now).injury.awayOffense,0);
 assert.match(evaluate(d,game,null,now).withheld[0],/RB Two \(OUT\)/);
 d.teams[0].depth.rows.pop();d.teams[0].depth.rows[0].rank=3;
 assert.equal(evaluate(d,game,null,now).injury.awayOffense,0);
 d.teams[0].depth.rows[0].rank=2;d.teams[0].official.rows[0].status='Questionable';
 assert.equal(evaluate(d,game,null,now).injury.awayOffense,0);
 d.teams[0].official.rows[0].status='Out';d.teams[0].depth.gameId='other';
 assert.equal(evaluate(d,game,null,now).injury.awayOffense,0);
});

function missingPlayer(d,teamIndex=0,name='Missing Defender',position='LB',rank=1){
 const t=d.teams[teamIndex];
 t.official.unresolved=[{name,position,status:'Out'}];t.official.unmatched=1;
 t.depth.unresolved=[{name,position,rank,slot:position+':0',reason:'No matching player identity in the provider roster.'}];
 t.depth.url='https://team.example/team/depth-chart';
 return t;
}
test('missing provider identity can use unique official Out and team depth evidence across teams',()=>{
 const d=build();missingPlayer(d);missingPlayer(d,1,'Missing Runner','RB',2);
 const r=evaluate(d,game,null,now);
 assert.equal(r.injury.awayDefense,.35);assert.equal(r.injury.homeOffense,.10);
 assert.equal(r.applied.length,2);
 for(const p of r.applied){assert.equal(p.playerId,null);assert.equal(p.identitySource,'official-report-and-team-depth');assert.ok(p.depthEvidence);assert.match(p.role,/provider ID unavailable/);}
 assert.equal(d.teams[0].roster.rows.length,0);
});
test('official-name fallback does not count duplicate reports or bypass team caps',()=>{
 const d=build(),t=missingPlayer(d);
 t.official.unresolved.push({...t.official.unresolved[0]});
 assert.equal(evaluate(d,game,null,now).injury.awayDefense,.35);
 for(let i=0;i<4;i++)add(d,'1',{id:String(i+1),name:'Corner '+i,position:'CB'});
 assert.equal(evaluate(d,game,null,now).injury.awayDefense,2);
});
test('official-name fallback rejects stale, ambiguous, conflicting and unsupported evidence',()=>{
 const changes=[
  t=>t.depth.checkedAt=now-3600001,
  t=>t.depth.gameId='other',
  t=>t.depth.unresolved.push({...t.depth.unresolved[0]}),
  t=>t.depth.unresolved[0].unresolved=true,
  t=>t.depth.unresolved[0].reason='Position or identity conflict',
  t=>t.depth.unresolved[0].rank=2,
  t=>t.depth.unresolved[0].position='CB',
  t=>t.depth.unresolved[0].slot=null,
  t=>t.depth.rows.push({name:'Other',id:'9',rank:1,slot:'LB:0'}),
  t=>t.official.unresolved.push({name:'Missing Defender',position:'LB',status:'Active'}),
  t=>t.roster.rows.push({name:'Missing Defender Jr.',id:'9',position:'LB'}),
  t=>t.injuries.rows.push({name:'Missing Defender',status:'Active'}),
  t=>t.official.rows.push({name:'Missing Defender',id:'9',status:'Out'}),
  t=>{t.official.unresolved[0].position='QB';t.depth.unresolved[0].position='QB';},
  t=>t.depth.unresolved[0].name='Missing D. Defender'
 ];
 for(const change of changes){const d=build(),t=missingPlayer(d);change(t);const r=evaluate(d,game,null,now);assert.equal(r.applied.length,0,String(change));}
 const d=build();missingPlayer(d);assert.equal(evaluate(d,{...game,league:'2'},null,now).applied.length,0);
});

test('sided defensive line depth labels match their position family only',()=>{
 for(const [provider,chart,points] of [['DE','RDE',.5],['DE','LDE',.5],['DT','RDT',.3],['DT','LDT',.3]]){
  const d=build();add(d,'2',{id:'1013',name:'Defensive starter',position:provider});
  d.teams[1].depth.rows[0].position=chart;
  assert.equal(evaluate(d,game,null,now).injury.homeDefense,points);
  d.teams[1].depth.rows[0].position=provider==='DE'?'RDT':'RDE';
  assert.equal(evaluate(d,game,null,now).injury.homeDefense,0);
 }
});

test('college defensive usage reaches score adjustments, excluding conditional and unsupported players',()=>{
 const d=build(),g={...game,league:'2'};
 add(d,'2',{id:'7',name:'Defender',position:'DB'});
 for(const t of d.teams){t.official.league='2';delete t.depth;t.injuryUsage={available:true,checkedAt:now,gameId:g.id,kickoff:g.kickoff,league:'2',season:'2026',rows:[]};}
 const t=d.teams[1];
 t.injuryUsage.rows=[{id:'7',position:'DB',metric:'tackles',values:[4,3,0],role:'recent defensive contributor'}];
 const result=evaluate(d,g,null,now);
 assert.equal(result.injury.homeDefense,.5);assert.equal(result.applied[0].role,'recent defensive contributor');
 for(const values of [[0,4,3],[null,4,3],[3.5,4,3],[4,0,0]]){
  t.injuryUsage.rows[0].values=values;assert.equal(evaluate(d,g,null,now).injury.homeDefense,0);
 }
 t.injuryUsage.rows[0].values=[4,3,0];
 t.official.rows[0].status='Questionable';assert.equal(evaluate(d,g,null,now).injury.homeDefense,0);
 t.official.rows[0].status='Out';t.injuryUsage.checkedAt=now-3600001;
 assert.equal(evaluate(d,g,null,now).injury.homeDefense,0);
});
