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

test('American Conference exact game report matches Army–Tulsa only after publication and gates verified Out',async()=>{
 const start=Date.parse('2026-10-24T00:30:00Z'); // 7:30 PM CT on Oct 23
 const reportTime=Date.parse('2026-10-23T22:30:00Z'); // 5:30 PM CT, two hours before kickoff
 const matchup={league:{id:2,season:2026},game:{date:{timestamp:start/1000}},
   teams:{away:{id:201,name:'Army'},home:{id:202,name:'Tulsa'}}};
 const query={league:'2',season:'2026',game:'300',away:'201',home:'202'};
 const playerReport={
   conferenceTimeZone:'CT',publishDate:'2026-10-23',postedTime:'17:30:00',
   footer:{date:'2026-10-23',time:'19:30:00'},
   games:[{teamName:'Army',rows:[{name:'RB #10 Test Runner',status:'Out'}]},
          {teamName:'Tulsa',rows:[{name:'WR #20 Test Receiver',status:'Game Time Decision'}]}]
 };
 const roster=()=>[
   {id:'201',roster:{available:true,checkedAt:reportTime,rows:[{id:'110',name:'Test Runner',position:'RB'}]},injuries:{available:false,rows:[]}},
   {id:'202',roster:{available:true,checkedAt:reportTime,rows:[{id:'220',name:'Test Receiver',position:'WR'}]},injuries:{available:false,rows:[]}}
 ];
 let conferences=[];
 const fetchPublic=async conf=>{conferences.push(conf);return conf==='American'?{matching:playerReport}:{};};
 const before=roster();
 await createCollegeAvailability(async()=>({response:[matchup]}),()=>reportTime-1000,fetchPublic)(query,before);
 assert.equal(before[0].official.available,false);
 const after=roster();
 await createCollegeAvailability(async()=>({response:[matchup]}),()=>reportTime+1000,fetchPublic)(query,after);
 assert.ok(conferences.includes('American'));
 assert.equal(after[0].official.available,true);
 assert.equal(after[0].official.source,'American');
 assert.equal(after[0].official.url,'https://theamerican.org/sports/2026/8/6/football_player_availability.aspx');
 assert.equal(after[0].official.publishedAt,reportTime);
 assert.equal(after[0].official.rows[0].id,'110');
 assert.equal(after[1].official.rows[0].id,'220');
 const result={current:true,teams:after},game={id:'300',kickoff:start};
 assert.equal(assess(result,game,'201','110',reportTime+1000,true).blocked,true);
 assert.equal(assess(result,game,'202','220',reportTime+1000,true).state,'conditional');
 const wrongTeam=structuredClone(playerReport);wrongTeam.games[0].teamName='Memphis';
 assert.equal(matchReports({bad:wrongTeam},matchup,'2026',reportTime+1000).length,0);
 const wrongTime=structuredClone(playerReport);wrongTime.footer.time='18:30:00';
 assert.equal(matchReports({bad:wrongTime},matchup,'2026',reportTime+1000).length,0);
});
