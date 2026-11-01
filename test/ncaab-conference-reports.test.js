'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {match,createReports}=require('../ncaab-conference-reports');
const game={awayId:'1',homeId:'2',tipoff:'2026-11-02T01:00:00Z'},now=Date.parse(game.tipoff)-3600000;
const teams=['Kansas','Iowa State'].map((location,i)=>({id:String(i+1),team:{location}}));
const baseline=teams.map(()=>({available:false,players:[]}));
const r={ReportType:'Gameday Report',publishDate:'2026-11-01',postedTime:'17:00',footer:{date:'2026-11-01',time:'19:00'},games:[{teamName:'Iowa State',rows:[]},{teamName:'Kansas',rows:[{name:'#21 Test Player',status:'Out'}]}]};
test('accepts a published report by exact schools and Central tipoff; blank side stays unknown',async()=>{
 const read=createReports(async url=>({ok:true,json:async()=>url.includes('!2')?{r}:{}}),()=>now);
 const out=await read(game,teams,baseline);assert.equal(out[0].players[0].status,'Out');assert.equal(out[1],baseline[1]);
 const conflicting=await read(game,teams,[{players:[{name:'Test Player',status:'Questionable'}]},baseline[1]]);
 assert.equal(conflicting[0].available,false);assert.equal(conflicting[0].players[0].status,'Unverified');
});
test('rejects pending, wrong opponent, stale, misdated and future publications',()=>{
 for(const patch of [{ReportType:'Report Pending'},{postedTime:'18:30'},{publishDate:'2026-10-20'},{footer:{date:'2026-11-02',time:'19:00'}},{games:[r.games[1],r.games[1]]}])assert.deepEqual(match({r:{...r,...patch}},'Big 12',game,teams,now),[]);
});
test('Big Ten publication without timestamp only used in final pregame window; identical timestamps ambiguous',async()=>{
 const entry={...r,publishDate:undefined,postedTime:undefined};assert.equal(match({entry},'Big Ten',game,teams,now).length,1);assert.deepEqual(match({entry},'Big Ten',game,teams,now-4*3600000),[]);
 const read=createReports(async url=>({ok:true,json:async()=>url.includes('!0')?{one:entry,two:entry}:{}}),()=>now);
 assert.equal(await read(game,teams,baseline),baseline);
});
