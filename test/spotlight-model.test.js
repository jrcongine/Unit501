const {test}=require('node:test'),assert=require('node:assert/strict');
const s=require('../public/spotlight-model');
const game=date=>({league:'1',kickoff:Date.parse(date)});
const night=game('2026-10-19T00:20:00Z'),early=game('2026-10-18T17:00:00Z');
test('Spotlight uses Eastern schedule windows including DST and excludes other sports/times',()=>{
 assert.equal(s.windowFor(night),'spotlight');
 assert.equal(s.windowFor(game('2026-10-20T00:15:00Z')),'spotlight');
 assert.equal(s.windowFor(early),'early');
 for(const date of ['2026-10-18T20:25:00Z','2026-10-16T00:15:00Z','2026-10-18T13:30:00Z'])assert.equal(s.windowFor(game(date)),'none');
 assert.equal(s.windowFor(game('2026-11-09T01:20:00Z')),'spotlight');
 assert.equal(s.windowFor({...night,league:'2'}),'none');
});
test('yardage scenario amounts, workload scaling and exclusions',()=>{
 for(const [starRole,market,boost] of [['WR','recYds',12.5],['RB','rushYds',17.5],['QB','passYds',20]]){
  const args={game:night,market,value:100,starRole,enabled:true};
  assert.equal(s.player(args).value,100+boost);
  assert.equal(s.player({...args,game:early}).value,100-boost/2);
  assert.equal(s.player({...args,workload:50,weatherFactor:.8}).delta,boost*.4);
  for(const patch of [{enabled:false},{blocked:true},{workload:0},{market:'rec'},{starRole:null}])assert.equal(s.player({...args,...patch}).value,100);
 }
 assert.equal(s.player({game:early,market:'rushYds',value:2,starRole:'RB',enabled:true}).value,0);
});
test('star proxy requires three complete recent workload records and distinguishes primary rushers',()=>{
 const history=Array.from({length:3},(_,i)=>({gameDate:i,attempts:30,carries:18,targets:9}));
 assert.equal(s.role(history),'QB');
 assert.equal(s.role(history.map(g=>({...g,attempts:0}))),'RB');
 assert.equal(s.role(history.map(g=>({...g,attempts:0,carries:0}))),'WR');
 assert.equal(s.role(history.slice(1)),null);
 assert.equal(s.role([{gameDate:5},...history]),null);
});
test('Sunday scenario preserves totals and favors the market underdog only with agreeing score model',()=>{
 const args={game:early,away:20,home:30,awaySpread:7,enabled:true};
 assert.deepEqual([s.team(args).away,s.team(args).home],[20.75,29.25]);
 assert.equal(s.team({...args,home:50}).marginReduction,2);
 assert.equal(s.team({...args,away:30,home:20,awaySpread:-7}).away,29.25);
 for(const patch of [{enabled:false},{game:night},{awaySpread:0},{awaySpread:-7}])assert.equal(s.team({...args,...patch}).applied,false);
});
