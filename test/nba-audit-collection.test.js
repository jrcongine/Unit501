'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {collect}=require('../scripts/collect-nba-audit');
const archive=require('../data/nba-public-2024-2025-audit.json');
const names=new Map(archive.counts.map(t=>[Number(t.id),t.name]));
function fetcher(change=()=>{}){return async url=>{
 const team=Number(/teams\/(\d+)\//.exec(url)[1]);
 const events=archive.rows.filter(r=>r[2]===team||r[3]===team).map(([id,date,a,h,af,hf,arena])=>({id:String(id),season:{year:2025,type:2},competitions:[{date,venue:{fullName:arena},status:{type:{name:'STATUS_FINAL',state:'post',completed:true}},competitors:[{homeAway:'away',team:{id:a,displayName:names.get(a)},score:String(af)},{homeAway:'home',team:{id:h,displayName:names.get(h)},score:String(hf)}]}]}));
 change(events,team);return {ok:true,json:async()=>({season:{year:2027},events})};
};}
test('research collection reconciles all team schedules using event season, not stale wrapper metadata',async()=>{
 const d=await collect(2024,fetcher());assert.equal(d.rows.length,1230);assert.equal(d.counts.length,30);assert.ok(d.counts.every(t=>t.games===82));
 assert.ok(d.sources.every(t=>t.wrapperSeason===2027));assert.equal(d.season,2024);
});
test('research collection rejects incomplete, duplicate, conflicting and foreign-season schedules',async()=>{
 for(const mutate of [(e,t)=>{if(t===1)e.pop();},(e,t)=>{if(t===1)e.push(e[0]);},(e,t)=>{if(t===2)e[0].competitions[0].competitors[0].score='999';},(e,t)=>{if(t===1)e[0].season.year=2026;}])await assert.rejects(collect(2024,fetcher(mutate)));
});
