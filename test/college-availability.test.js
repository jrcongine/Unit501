'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createCollegeAvailability,matchReports,localEpoch}=require('../college-availability');
const {assess}=require('../public/injury-model');
const now=Date.parse('2026-10-10T20:00:00Z'),kickoff=Date.parse('2026-10-10T23:30:00Z');
const q={league:'2',season:'2026',game:'100',away:'1',home:'2'};
const g={league:{id:2,season:2026},game:{date:{timestamp:kickoff/1000}},teams:{away:{id:1,name:'Georgia'},home:{id:2,name:'Alabama'}}};
const report=()=>({publishDate:'2026-10-10',postedTime:'14:00:00',conferenceTimeZone:'CT',footer:{date:'2026-10-10',time:'18:30:00'},games:[{teamName:'Georgia',rows:[{name:'QB #1 Player One',status:'Out'}]},{teamName:'Alabama',rows:[{name:'WR #2 Other',status:'Game Time Decision'}]}]});
const teams=()=>[{id:'1',roster:{available:true,checkedAt:now,rows:[{id:'10',name:'Player One',position:'QB'}]},injuries:{available:false,rows:[]}},{id:'2',roster:{available:true,checkedAt:now,rows:[{id:'20',name:'Other',position:'WR'}]},injuries:{available:false,rows:[]}}];
test('conference times use actual DST offsets and reject unknown zones or invalid dates',()=>{
 assert.equal(localEpoch('2026-10-10','18:30:00','CT'),kickoff);
 assert.equal(localEpoch('2026-10-10','19:30:00','ET'),kickoff);
 assert.equal(localEpoch('2026-12-10','18:30:00','CT'),Date.parse('2026-12-11T00:30:00Z'));
 for(const [date,time,zone] of [['2026-02-30','12:00:00','CT'],['2026-10-10','25:00:00','CT'],['2026-10-10','12:00:00','Unknown']])assert.ok(Number.isNaN(localEpoch(date,time,zone)));
});
test('official college reports require both schools, exact kickoff and a valid prior publication',()=>{
 assert.equal(matchReports({x:report()},g,'2026',now).length,1);
 for(const mutate of [r=>r.footer.time='18:00:00',r=>r.games[0].teamName='Georgia Tech',r=>r.postedTime='17:00:00',r=>r.publishDate='2026-09-01',r=>r.conferenceTimeZone='Unknown']){const r=report();mutate(r);assert.equal(matchReports({x:r},g,'2026',now).length,0);}
});
test('official college Out gates without provider coverage and uncertain statuses remain conditional',async()=>{
 let calls=0;const get=createCollegeAvailability(async()=>({response:[g]}),()=>now,async conf=>{calls++;return conf==='SEC'?{x:report()}:{};});
 const t=teams();await get(q,t);await get(q,teams());assert.equal(calls,4);
 assert.equal(t[0].official.publisher,'SEC');assert.equal(t[0].official.rows[0].id,'10');
 const data={current:true,teams:t},game={id:'100',kickoff};assert.equal(assess(data,game,'1','10',now,true).blocked,true);
 assert.equal(assess(data,game,'2','20',now,true).state,'conditional');
 t[0].official.rows[0].status='Out - (1st Half)';assert.equal(assess(data,game,'1','10',now,true).blocked,false);
 t[0].official.checkedAt=now-900001;assert.equal(assess(data,game,'1','10',now,true).state,'unknown');
});
test('ambiguous reports, duplicated roster names, wrong games and provider/source failures cannot guess college status',async()=>{
 const t=teams();t[0].roster.rows.push({id:'11',name:'Player One'});
 const get=createCollegeAvailability(async()=>({response:[g]}),()=>now,async conf=>conf==='SEC'?{x:report()}:{});await get(q,t);assert.equal(t[0].official.rows.length,0);assert.equal(t[0].official.unmatched,1);
 const ambiguous=createCollegeAvailability(async()=>({response:[g]}),()=>now,async()=>({x:report()}));const a=teams();await ambiguous(q,a);assert.equal(a[0].official.available,false);
 const wrong=teams();await get({...q,home:'99'},wrong);assert.equal(wrong[0].official.available,false);
 const broken=createCollegeAvailability(async()=>({response:[g]}),()=>now,async()=>{throw Error('source unavailable');});const b=teams();await broken(q,b);assert.equal(b[0].official.available,false);
});

test('conference State abbreviations resolve only to verified FBS schools',()=>{
 for(const name of ['Florida','Michigan','Ohio','Penn']){
  const r=report();r.games[0].teamName=name+' St.';
  const match={...g,teams:{...g.teams,away:{id:1,name:name+' State'}}};
  assert.equal(matchReports({x:r},match,'2026',now).length,1);
 }
 const r=report();r.games[0].teamName='Unknown St.';assert.equal(matchReports({x:r},g,'2026',now).length,0);
});

test('explicit Available clears generic conditional warnings, while exempt and missing remain unknown',async()=>{
 const r=report();r.games[0].rows[0].status='Available';
 const get=createCollegeAvailability(async()=>({response:[g]}),()=>now,async conf=>conf==='SEC'?{x:r}:{});
 const t=teams();await get(q,t);const data={current:true,teams:t},game={id:'100',kickoff};
 assert.equal(assess(data,game,'1','10',now,true).state,'available');
 assert.equal(require('../public/injury-model').statusLabel(assess(data,game,'1','10',now,true)),'Available');
 t[0].official.rows[0].status='Exempt';assert.equal(assess(data,game,'1','10',now,true).state,'unknown');
 t[0].official.rows=[];assert.equal(assess(data,game,'1','10',now,true).state,'unknown');
});
test('college suffix formatting matches one identity and retains unresolved names visibly',async()=>{
 const r=report();r.games[0].rows[0].name='QB #1 Player One Jr.';r.games[0].rows.push({name:'RB #9 Unmatched Name',status:'Out'});
 const t=teams();await createCollegeAvailability(async()=>({response:[g]}),()=>now,async conf=>conf==='SEC'?{x:r}:{})(q,t);
 assert.equal(t[0].official.rows[0].id,'10');assert.equal(t[0].official.unresolved[0].name,'Unmatched Name');
});
test('newer published official availability supersedes older provider report but not a newer contradiction',async()=>{
 const r=report();r.games[0].rows[0].status='Available';
 const t=teams();await createCollegeAvailability(async()=>({response:[g]}),()=>now,async conf=>conf==='SEC'?{x:r}:{})(q,t);
 t[0].injuries={available:true,checkedAt:now,rows:[{id:'10',teamId:'1',status:'Questionable',date:new Date(now-7200000).toISOString()}]};
 const data={current:true,teams:t},game={id:'100',kickoff};assert.equal(assess(data,game,'1','10',now,true).state,'available');
 t[0].injuries.rows[0].date=new Date(now).toISOString();assert.equal(assess(data,game,'1','10',now,true).state,'conflict');
});


test('Texas Smothers nickname mismatch resolves official Out and highlights Brown using the reported matchup values',async()=>{
 // Minimal regression from the user's exported game 24745 report.
 const now=Date.parse('2026-10-24T21:56:30.918Z'),kickoff=1792884600000;
 const game={id:24745,league:'2',season:'2026',kickoff};
 const q={league:'2',season:'2026',game:'24745',away:'131',home:'195'};
 const g={league:{id:2,season:2026},game:{date:{timestamp:kickoff/1000}},teams:{away:{id:131,name:'Ole Miss'},home:{id:195,name:'Texas'}}};
 const texas={id:'195',roster:{available:true,checkedAt:1792878792604,rows:[{id:'15918',name:'Raleek Brown',position:'RB'},{id:'39057',name:'Daylan Smothers',position:'RB'}]},
  injuries:{available:true,checkedAt:now,rows:[]},injuryUsage:{available:true,checkedAt:1792878945897,gameId:'24745',kickoff,league:'2',season:'2026',rows:[
   {id:'15918',position:'RB',metric:'carries',values:[8,5,17],role:'recent regular contributor'},
   {id:'39057',position:'RB',metric:'carries',values:[12,12,null],role:'recent regular contributor'}]}};
 const official={publishDate:'2026-10-23',postedTime:'19:10:00',conferenceTimeZone:'CT',footer:{date:'2026-10-24',time:'18:30:00'},games:[
  {teamName:'Ole Miss',rows:[]},{teamName:'Texas',rows:[{name:'RB #0 Raleek Brown',status:'Available'},{name:'RB #2 Hollywood Smothers',status:'Out'}]}]};
 await createCollegeAvailability(async()=>({response:[g]}),()=>now,async conf=>conf==='SEC'?{r:official}:{})(q,[{id:'131',roster:{rows:[]}},texas]);
 assert.equal(texas.official.unmatched,0);
 assert.equal(texas.official.rows.find(p=>p.name==='Hollywood Smothers').id,'39057');
 const data={current:true,teams:[texas]};
 assert.equal(assess(data,game,'195','39057',now,true).blocked,true);
 assert.equal(assess(data,game,'195','15918',now,true).state,'available');
 const history=[8,5,17].map((carries,i)=>({carries,gameDate:kickoff/1000-86400*(i+1)}));
 const role=require('../public/player-form').roleContext(history,'rushYds',texas,'15918',game,'',now);
 assert.equal(role.active,true);assert.match(role.alerts.find(a=>a.source==='absence').detail,/Hollywood Smothers ruled out/);
});
test('college nickname aliases require the reviewed league, season, school, ID and position',()=>{
 const {matchPlayer}=require('../player-name-match');
 const row={name:'Hollywood Smothers',position:'RB'},player={id:'39057',name:'Daylan Smothers',position:'RB'},scope={league:'2',season:'2026'};
 assert.equal(matchPlayer(row,[player],'195',scope),player);
 for(const s of [{},{league:'1',season:'2026'},{league:'2',season:'2025'}])assert.equal(matchPlayer(row,[player],'195',s),null);
 assert.equal(matchPlayer(row,[player],'131',scope),null);
 assert.equal(matchPlayer(row,[{...player,id:'other'}],'195',scope),null);
 assert.equal(matchPlayer(row,[{...player,position:'WR'}],'195',scope),null);
 assert.equal(matchPlayer(row,[player,{...player,id:'other',name:'Hollywood Smothers'}],'195',scope),null);
});

test('Big 12 report reaches availability and automatic scoring only with matched roster and workload',async()=>{
 const snapshot=require('./fixtures/big12-baylor-ucf-20261030.json'),r=snapshot.report;
 const now=Date.parse('2026-10-30T20:00:00Z'),kickoff=Date.parse('2026-10-30T23:30:00Z');
 const q={league:'2',season:'2026',game:'100',away:'1',home:'2'};
 const g={league:{id:2,season:2026},game:{date:{timestamp:kickoff/1000}},teams:{away:{id:1,name:'Baylor'},home:{id:2,name:'UCF'}}};
 // Synthetic provider IDs test identity reconciliation; these are not live roster IDs.
 const teams=r.games.map((side,i)=>({id:String(i+1),roster:{available:true,checkedAt:now,rows:side.rows.map((p,j)=>{const m=/^([A-Z]+) #\d+ (.+)$/.exec(p.name);return {id:String(1000+i*100+j),name:m[2],position:m[1]};})},injuryUsage:{available:true,checkedAt:now,gameId:'100',kickoff,league:'2',season:'2026',rows:[]}}));
 const read=createCollegeAvailability(async()=>({response:[g]}),()=>now,async conf=>conf==='B12'?{3407:r}:{});
 await read(q,teams);assert.ok(teams.every(t=>t.official.available));assert.equal(teams[0].official.publisher,'Big 12');assert.equal(teams[0].official.unmatched,0);
 const swint=teams[1].roster.rows.find(p=>p.name==='Taevion Swint'),barnett=teams[1].roster.rows.find(p=>p.name==='Alonza Barnett III');
 const matchup={id:'100',league:'2',season:'2026',kickoff,awayId:'1',homeId:'2'},data={current:true,teams};
 assert.equal(assess(data,matchup,'2',swint.id,now,true).blocked,true);
 assert.equal(assess(data,matchup,'2',barnett.id,now,true).state,'conditional');
 const {evaluate}=require('../public/auto-injury');
 assert.equal(evaluate(data,matchup,null,now).applied.length,0);
 teams[1].injuryUsage.rows=[{id:swint.id,position:'RB',metric:'carries',values:[10,11,9],role:'recent regular contributor'}];
 const scored=evaluate(data,matchup,null,now);assert.equal(scored.injury.homeOffense,.25);assert.equal(scored.applied.length,1);assert.equal(scored.applied[0].name,'Taevion Swint');
 teams[1].official.checkedAt=now-900001;
 const expired=evaluate(data,matchup,null,now);assert.equal(expired.partial,true);assert.equal(expired.injury.homeOffense,0);assert.equal(expired.applied.length,0);
});
