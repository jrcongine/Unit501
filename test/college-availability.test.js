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
 const t=teams();await get(q,t);await get(q,teams());assert.equal(calls,1);
 assert.equal(t[0].official.publisher,'SEC');assert.equal(t[0].official.rows[0].id,'10');
 const data={current:true,teams:t},game={id:'100',kickoff};assert.equal(assess(data,game,'1','10',now,true).blocked,true);
 assert.equal(assess(data,game,'2','20',now,true).state,'conditional');
 t[0].official.rows[0].status='Out - (1st Half)';assert.equal(assess(data,game,'1','10',now,true).blocked,false);
 t[0].official.checkedAt=now-900001;assert.equal(assess(data,game,'1','10',now,true).state,'unknown');
});
test('ambiguous reports, duplicated roster names, wrong games and provider/source failures cannot guess college status',async()=>{
 const t=teams();t[0].roster.rows.push({id:'11',name:'Player One'});
 const get=createCollegeAvailability(async()=>({response:[g]}),()=>now,async conf=>conf==='SEC'?{x:report()}:{});await get(q,t);assert.equal(t[0].official.rows.length,0);assert.equal(t[0].official.unmatched,1);
 const ambiguous=createCollegeAvailability(async()=>({response:[g]}),()=>now,async()=>({x:report(),y:report()}));const a=teams();await ambiguous(q,a);assert.equal(a[0].official.available,false);
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

test('CUSA matchups expose an honest manual fallback without inventing availability or extra paid calls',async()=>{
 for(const [away,home] of [['FIU','Middle Tennessee'],['Missouri State','Delaware']]){
  let calls=0;
  const game={...g,teams:{away:{id:1,name:away},home:{id:2,name:home}}};
  const get=createCollegeAvailability(async()=>{calls++;return {response:[game]};},()=>now,async()=>({}));
  const t=teams();await get(q,t);
  assert.equal(calls,1);
  for(const team of t){
   assert.equal(team.official.available,false);
   assert.equal(team.official.coverage,'unsupported');
   assert.equal(team.official.source,'CUSA');
   assert.match(team.official.message,/manual points/);
   assert.match(team.official.url,/^https:\/\/conferenceusa.com\//);
   assert.deepEqual(team.official.rows,[]);
  }
 }
});

test('Big 12, MAC and American use verified provider IDs and map report school aliases',async()=>{
 for(const [code,provider,away,home,reportAway] of [
  ['B12','B12','Kansas State','Arizona State','Kansas St.'],
  ['MAC','MAC','Western Michigan','Toledo','Western Mich.'],
  ['AAC','American','Army','Tulsa','Army West Point']
 ]){
  const calls=[],r=report();r.games[0].teamName=reportAway;r.games[1].teamName=home;
  const game={...g,teams:{away:{id:1,name:away},home:{id:2,name:home}}};
  const t=teams();await createCollegeAvailability(async()=>({response:[game]}),()=>now,async c=>{calls.push(c);return {x:r};})(q,t);
  assert.deepEqual(calls,[provider]);
  assert.equal(t[0].official.source,code);assert.equal(t[0].official.coverage,'verified');
  assert.equal(t[0].official.rows[0].status,'Out');assert.equal(t[0].official.rows[0].id,'10');
 }
});
test('pending reports never certify empty injury lists even after their scheduled publication',async()=>{
 const r=report();r.ReportType='Report Pending';
 assert.deepEqual(matchReports({x:r},g,'2026',now),[]);
 const t=teams();await createCollegeAvailability(async()=>({response:[g]}),()=>now,async()=>({x:r}))(q,t);
 assert.equal(t[0].official.available,false);assert.equal(t[0].official.coverage,'incomplete');
});
test('independents retain school fallback but can receive exact-match opponent conference reports',async()=>{
 const game={...g,teams:{away:{id:1,name:'Notre Dame'},home:{id:2,name:'Stanford'}}};
 const r=report();r.games[0].teamName='Notre Dame';r.games[1].teamName='Stanford';
 const t=teams(),calls=[];
 await createCollegeAvailability(async()=>({response:[game]}),()=>now,async c=>{calls.push(c);return {};})(q,t);
 assert.deepEqual(calls,['ACC']);assert.equal(t[0].official.source,'ND');assert.equal(t[0].official.available,false);
 assert.match(t[0].official.url,/fightingirish/);
 await createCollegeAvailability(async()=>({response:[game]}),()=>now,async()=>({x:r}))(q,t);
 assert.equal(t[0].official.available,true);assert.equal(t[0].official.rows[0].id,'10');
 // A one-team report cannot certify the whole matchup.
 r.games.pop();assert.deepEqual(matchReports({x:r},game,'2026',now),[]);
});
test('unsupported vs unknown vs source failure are distinct and failure does not mean healthy',async()=>{
 for(const [away,home,source] of [['UConn','Notre Dame','UCONN'],['Boise State','Texas State','PAC12'],['James Madison','Louisiana Tech','SBC'],['UNLV','Northern Illinois','MW']]){
  const game={...g,teams:{away:{id:1,name:away},home:{id:2,name:home}}};const t=teams();
  await createCollegeAvailability(async()=>({response:[game]}),()=>now,async()=>{throw Error('Must not fetch unimplemented sources');})(q,t);
  assert.equal(t[0].official.source,source);assert.equal(t[0].official.coverage,'unsupported');assert.equal(t[0].official.available,false);
 }
 const t=teams();await createCollegeAvailability(async()=>({response:[g]}),()=>now,async()=>{throw Error('Offline');})(q,t);
 assert.equal(t[0].official.coverage,'unavailable');assert.match(t[0].official.message,/could not be read/);
});
