'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createAvailability}=require('../availability');
const q={league:'1',season:'2026',away:'1',home:'2'};
const coverage=(current=true,injuries=true)=>({response:[{league:{id:1},seasons:[{year:2026,current,coverage:{players:true,injuries}}]}]});
test('reports stay team-scoped; timestamps reflect retrieval; concurrent calls share cache',async()=>{
 const calls=[];
 const get=createAvailability(async path=>{calls.push(path);if(path.startsWith('/leagues'))return coverage();if(path.startsWith('/players'))return {response:[{id:7,name:'Player',position:'QB'}]};return {response:[{player:{id:7,name:'Player'},team:{id:1},status:'Out',date:'2026-10-01',description:'Ankle'}]};},()=>1000);
 const [a,b]=await Promise.all([get(q),get(q)]);
 assert.deepEqual(a,b);assert.equal(calls.length,5);
 assert.equal(a.teams[0].injuries.rows[0].status,'Out');
 assert.equal(a.teams[1].injuries.rows.length,0);
 assert.equal(a.teams[0].roster.checkedAt,1000);
});
test('injury failures do not hide available rosters',async()=>{
 const get=createAvailability(async path=>path.startsWith('/leagues')?coverage():path.startsWith('/injuries')?{errors:{rate:'limited'},response:[]}:{response:[{id:8,name:'Player'}]});
 const r=await get(q);assert.equal(r.teams[0].roster.available,true);assert.equal(r.teams[0].injuries.available,false);
});
test('historical seasons and absent coverage never fetch current injury reports',async()=>{
 let calls=0;
 const get=createAvailability(async()=>{calls++;return coverage(false);});
 assert.equal((await get(q)).current,false);assert.equal(calls,1);
 const paths=[];
 const noInjuries=createAvailability(async path=>{paths.push(path);return path.startsWith('/leagues')?coverage(true,false):{response:[]};});
 assert.equal((await noInjuries(q)).teams[0].injuries.available,false);
 assert.equal(paths.some(p=>p.startsWith('/injuries')),false);
});
test('injury cache expires independently of roster cache',async()=>{
 let clock=1000;const paths=[];
 const get=createAvailability(async path=>{paths.push(path);return path.startsWith('/leagues')?coverage():{response:[]};},()=>clock);
 await get(q);clock+=900001;await get(q);
 assert.equal(paths.filter(p=>p.startsWith('/players')).length,2);
 assert.equal(paths.filter(p=>p.startsWith('/injuries')).length,4);
});
