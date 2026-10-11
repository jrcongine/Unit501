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
