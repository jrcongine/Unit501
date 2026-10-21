'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {gameLink,parseReceiving,createRecovery}=require('../official-player-history');
const {recoverReceiving}=require('../public/player-stats');
const html=fs.readFileSync(__dirname+'/fixtures/south-alabama-receiving-20261008.html','utf8');
const schedule="<tr><td>10/08/2026</td><th>at <a href='/boxscore.aspx?id=11381&path=football'>Arkansas State</a></th><td>W</td></tr>";
const source='https://usajaguars.com/boxscore.aspx?id=11381&path=football';
test('observed official table preserves Eager explicit zero receiving game',()=>{
 const result=parseReceiving(html,'2026-10-08','Arkansas State');
 assert.deepEqual(result.find(r=>r.name==='Anthony Eager'),{name:'Anthony Eager',rec:0,recYds:0,recTD:0});
 assert.equal(result.reduce((n,r)=>n+r.recYds,0),76);
 assert.equal(parseReceiving(html,'2026-10-09','Arkansas State'),null);
 assert.equal(parseReceiving(html,'2026-10-08','Marshall'),null);
 assert.equal(parseReceiving(html.replace('>36</td>','>37</td>'),'2026-10-08','Arkansas State'),null);
 assert.equal(parseReceiving(html.replace('>0</td>','>--</td>'),'2026-10-08','Arkansas State'),null);
});
test('game discovery rejects wrong dates, opponents, remote links and ambiguous games',()=>{
 assert.equal(gameLink(schedule,'2026-10-08','Arkansas State'),source);
 assert.equal(gameLink(schedule,'2026-10-09','Arkansas State'),null);
 assert.equal(gameLink(schedule,'2026-10-08','Marshall'),null);
 assert.equal(gameLink(schedule.replace('/boxscore.aspx','https://other.example/boxscore.aspx'),'2026-10-08','Arkansas State'),null);
 assert.equal(gameLink(schedule+schedule.replace('11381','12345'),'2026-10-08','Arkansas State'),null);
});
test('recovery is cached, school scoped and preserves source failures as unknown',async()=>{
 const requests=[];const recover=createRecovery(async url=>{requests.push(url);return {ok:true,url,text:async()=>url.includes('/stats/')?schedule:html};});
 const q={season:'2026',team:'South Alabama Jaguars',opponent:'Arkansas State Red Wolves',date:'2026-10-08'};
 const [a,b]=await Promise.all([recover(q),recover(q)]);
 assert.equal(a.status,'verified');assert.deepEqual(a,b);assert.equal(requests.length,2);
 assert.equal((await recover({...q,team:'Marshall'})).status,'unsupported');assert.equal(requests.length,2);
 assert.equal((await createRecovery(async()=>{throw Error('offline');})(q)).status,'unavailable');
});
test('merge fills an explicit zero, retains unknown players and refuses conflicting or duplicate identities',()=>{
 const data={status:'verified',source,rows:parseReceiving(html,'2026-10-08','Arkansas State')};
 const make=(name,id,game={})=>({name,teamId:'1',games:new Map([['game',{gameDate:1,...game}]])});
 const a=make('Anthony Eager','a'),missing=make('Not In Box Score','b'),other={...make('Anthony Eager','c'),teamId:'2'};
 const map=new Map([['a',a],['b',missing],['c',other]]);
 assert.equal(recoverReceiving(map,'1','game',data),1);
 assert.equal(a.games.get('game').recYds,0);assert.equal(a.games.get('game').recoveredReceiving.source,source);
 assert.equal(missing.games.get('game').recYds,undefined);assert.equal(other.games.get('game').recYds,undefined);
 const conflict=make('Anthony Eager','d',{recYds:10});
 assert.equal(recoverReceiving(new Map([['d',conflict]]),'1','game',data),0);
 assert.equal(conflict.games.get('game').rec,undefined);
 const duplicate=make('Anthony Eager','e');
 assert.equal(recoverReceiving(new Map([['d',make('Anthony Eager')],['e',duplicate]]),'1','game',data),0);
});
