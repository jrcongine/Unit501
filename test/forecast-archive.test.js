'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {capture,save,read,key}=require('../public/forecast-archive');
function fixture(){
 const now=2000000,game={id:'99',kickoff:3000000,season:'2026',league:'1',awayId:'0',homeId:'1'};
 const teams=Array.from({length:32},(_,i)=>({id:String(i),games:4,metrics:Object.fromEntries(['pointsFor','pointsAgainst'].map(k=>[k,{average:24,games:4,rank:i+1,pool:32}]))}));
 return {now,inputs:{game,data:{before:game.kickoff,season:'2026',teams,coverage:{pointsFor:{ranked:true,expected:32},pointsAgainst:{ranked:true,expected:32}}},options:{away:2,home:-1,venueMode:'home',injury:{awayOffense:4},forecast:{roof:'outdoor',available:true,kickoff:game.kickoff,forecastTime:game.kickoff,fetchedAt:now,windMph:25}},availability:{current:true,teams:[]},lineupInputs:{scenarios:[]}}};
}
test('archive holds both forecasts at one timestamp with identical weather, venue and manual ratings',()=>{
 const {inputs,now}=fixture(),s=capture(inputs,now);
 assert.equal(s.baseline.away,25*.9);assert.equal(s.adjusted.away,21*.9);
 assert.equal(s.baseline.home,s.adjusted.home);assert.equal(s.baseline.weather.reduction,s.adjusted.weather.reduction);
 assert.equal(s.records[0].forecastAt,now);assert.equal(s.records[0].actual,null);assert.equal(s.records[0].resultKnownAt,null);
 inputs.data.teams[0].metrics.pointsFor.average=999;inputs.availability.current=false;
 assert.equal(s.inputs.data.teams[0].metrics.pointsFor.average,24);assert.equal(s.inputs.availability.current,true);
});
test('past games, games beyond seven days, missing data and unadjusted forecasts cannot enter archive',()=>{
 const {inputs,now}=fixture();assert.equal(capture(inputs,inputs.game.kickoff),null);
 assert.equal(capture({...inputs,game:{...inputs.game,kickoff:now+7*86400000+1}},now),null);
 assert.equal(capture({...inputs,data:null},now),null);assert.equal(capture({...inputs,options:{}},now),null);
 assert.equal(capture({...inputs,game:{...inputs.game,id:undefined}},now),null);
});
test('first game forecast persists, later versions never overwrite, storage failure is explicit',()=>{
 const map=new Map(),storage={getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)};
 const {inputs,now}=fixture(),s=capture(inputs,now);assert.equal(save(storage,s).saved,true);
 assert.equal(save(storage,{...s,adjusted:{away:999}}).saved,false);assert.equal(read(storage).snapshots[0].adjusted.away,s.adjusted.away);
 const raw=map.get(key);storage.setItem=()=>{throw Error('quota');};
 assert.equal(save(storage,{...s,game:{...s.game,id:'100'}}).saved,false);assert.equal(map.get(key),raw);
 map.set(key,'corrupted');assert.equal(save(storage,s).saved,false);assert.equal(map.get(key),'corrupted');
});
test('player targets retain their first forecast independently of score and other player markets',()=>{
 const {inputs,now}=fixture();const args={game:inputs.game,teamId:'0',playerId:'7',market:'recYds',baseline:20,adjusted:30,inputs:{history:[{recYds:20}],workload:75}};
 const s=require('../public/forecast-archive').captureProp(args,now);
 assert.equal(s.records[0].baseline,20);assert.equal(s.records[0].adjusted,30);assert.equal(s.records[0].actual,null);
 args.inputs.history[0].recYds=999;assert.equal(s.inputs.history[0].recYds,20);
 const data=new Map(),storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};
 assert.equal(save(storage,capture(inputs,now)).saved,true);assert.equal(save(storage,s).saved,true);
 assert.equal(save(storage,s).saved,false);
 assert.equal(save(storage,require('../public/forecast-archive').captureProp({...args,market:'rec'},now)).saved,true);
 assert.equal(read(storage).snapshots.length,3);
 assert.equal(require('../public/forecast-archive').captureProp({...args,teamId:'99'},now),null);
 assert.equal(require('../public/forecast-archive').captureProp(args,inputs.game.kickoff),null);
});
test('archive import restores complete targets and never overwrites existing forecasts',()=>{
 const {inputs,now}=fixture(),s=capture(inputs,now),data=new Map();
 const storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};
 const text=JSON.stringify({schema:1,snapshots:[s]});
 assert.deepEqual(require('../public/forecast-archive').importArchive(storage,text,now+1),{imported:1,skipped:0});
 const modified=structuredClone(s);modified.adjusted.away=1;modified.records[0].adjusted=1;
 assert.deepEqual(require('../public/forecast-archive').importArchive(storage,JSON.stringify({schema:1,snapshots:[modified]}),now+1),{imported:0,skipped:1});
 assert.equal(read(storage).snapshots[0].adjusted.away,s.adjusted.away);
});
test('import rejects malformed, late, duplicate and inconsistent targets atomically',()=>{
 const {inputs,now}=fixture(),s=capture(inputs,now),data=new Map([[key,JSON.stringify({schema:1,snapshots:[]})]]);
 const storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)},before=data.get(key);
 for(const edit of [s=>s.records[0].forecastAt=s.game.kickoff,s=>s.records[0].actual=0,s=>s.records[0].teamId='99',s=>s.records[0].baseline=999,s=>s.records[1]=s.records[0],s=>s.game.league='3']){
  const bad=structuredClone(s);edit(bad);
  assert.throws(()=>require('../public/forecast-archive').importArchive(storage,JSON.stringify({schema:1,snapshots:[bad]}),now+1));assert.equal(data.get(key),before);
 }
 assert.throws(()=>require('../public/forecast-archive').importArchive(storage,JSON.stringify({schema:1,snapshots:[s,s]}),now+1));
 assert.equal(data.get(key),before);
 storage.setItem=()=>{throw Error('quota');};assert.throws(()=>require('../public/forecast-archive').importArchive(storage,JSON.stringify({schema:1,snapshots:[s]}),now+1));assert.equal(data.get(key),before);
});
