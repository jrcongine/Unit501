'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {applyReviewedHistory}=require('../public/player-stats');
const {project,summarize}=require('../public/player-form');
const {reconcileCoverage}=require('../nba-player-history');
function smith(){
 const rows=[['2026-09-13','Minnesota Vikings',22,39,2,50],['2026-09-20','New York Jets',20,17,0,0],['2026-09-24','Atlanta Falcons',14,35,2,16],['2026-10-04','Tampa Bay Buccaneers',17,14,1,19],['2026-10-11','Chicago Bears',31,7,0,0],['2026-10-18','Dallas Cowboys',23,13,0,0],['2026-10-25','Detroit Lions',17,20,1,9]];
 const p={name:'Jonnu Smith',team:'Green Bay Packers',teamId:'999',games:new Map()},calendar=new Map();
 rows.forEach(([date,name,scored,allowed,rec,recYds],i)=>{const id=String(i),time=Date.parse(date+'T20:00:00Z')/1000;
 calendar.set(id,{date:time,teams:new Map([['999',{name,scored,allowed}]])});
 p.games.set(id,{gameDate:time,opponent:name,...(rec?{rec,recYds}:{})});});
 return {p,records:new Map([['999:7',p]]),calendar};
}
test('official seven-game Smith review reaches real averages, counts and projection inputs',()=>{
 const {p,records,calendar}=smith(),scope={league:'1',season:'2026'};
 assert.equal(project([...p.games.values()],'recYds').withheld,true);
 assert.equal(applyReviewedHistory(records,calendar,scope),true);
 const rows=[...p.games.values()],form=summarize(rows,'recYds');
 assert.equal(form.average,94/7);assert.equal(form.coverage.missing,0);
 assert.equal(form.values.filter(n=>n>3.5).length,4);
 assert.equal(form.values.filter(n=>n<3.5).length,3);
 assert.equal(summarize(rows,'rec').values.filter(n=>n>1).length,2);
 assert.equal(summarize(rows,'rec').values.filter(n=>n===1).length,2);
 assert.equal(project(rows,'recYds').withheld,undefined);
 assert.equal(project(rows,'recYds').usage.games,4);
 assert.equal(rows.filter(g=>g.recYds===0).length,3);
 assert.ok(rows.every(g=>g.targets===undefined));
 assert.equal(applyReviewedHistory(records,calendar,scope),true,'idempotent');
});
test('review rejects wrong scope, opponent, final score, ambiguous identity and conflicts atomically',()=>{
 for(const mutate of [x=>x.p.team='Other',x=>x.p.name='Jonnu Smith Jr',x=>x.calendar.get('2').teams.get('999').scored=99,x=>x.calendar.get('2').teams.get('999').name='Other',x=>x.calendar.delete('2'),x=>x.p.games.get('6').recYds=10,x=>x.p.games.get('1').participation='dnp',x=>x.records.set('duplicate',{...x.p})]){
 const x=smith();mutate(x);assert.equal(applyReviewedHistory(x.records,x.calendar,{league:'1',season:'2026'}),false);
 assert.equal(x.p.games.get('1').recYds,undefined);
 }
 for(const scope of [{league:'2',season:'2026'},{league:'1',season:'2025'}]){const x=smith();assert.equal(applyReviewedHistory(x.records,x.calendar,scope),false);}
});
test('any football market gap withholds projections, but real zero values remain valid',()=>{
 for(const key of ['recYds','rec','rushYds','rushTD','carries','passYds','passTD']){
 const rows=[10,0,20].map((value,i)=>({gameDate:i+1,[key]:value}));
 assert.equal(project(rows,key).withheld,undefined);
 assert.equal(project([...rows,{gameDate:4}],key).withheld,true);
 }
});
test('basketball coverage separates verified DNP from missing traded or absent player rows',()=>{
 const p={results:[{gameId:'1'}],inactive:[{gameId:'2'}]},map=new Map([['7',p]]);
 reconcileCoverage(map,[{id:'1'},{id:'2'},{id:'3'}]);
 assert.deepEqual(p.coverage,{total:3,played:1,dnp:1,missing:1});
 assert.equal(p.missing[0].gameId,'3');assert.equal(p.results.length,1);
});
test('basketball duplicate, conflicting and out-of-window participation cannot certify coverage',()=>{
 for(const p of [
  {results:[{gameId:'1'},{gameId:'1'}],inactive:[]},
  {results:[{gameId:'1'}],inactive:[{gameId:'1'}]},
  {results:[{gameId:'2'}],inactive:[]}
 ]){reconcileCoverage(new Map([['7',p]]),[{id:'1'}]);assert.equal(p.available,false);}
});
test('Smith review never certifies a later game from blank statistics',()=>{
 const {p,records,calendar}=smith();p.games.set('8',{gameDate:Date.parse('2026-10-29T23:00:00Z')/1000});
 assert.equal(applyReviewedHistory(records,calendar,{league:'1',season:'2026'}),true);
 assert.equal(p.games.get('8').recYds,undefined);
 assert.equal(project([...p.games.values()],'recYds').withheld,true);
});
test('basketball DNP cannot override recorded minutes, points or shot attempts',()=>{
 const {conflictingDNP}=require('../nba-player-history');
 const keys=['minutes','points','threePointFieldGoalsMade-threePointFieldGoalsAttempted'];
 for(const stats of [['1','0','0-0'],['0','1','0-0'],['0','0','0-1']])assert.ok(conflictingDNP({didNotPlay:true,stats},keys));
 for(const stats of [[],['0','0','0-0'],['--','--','--']])assert.equal(conflictingDNP({didNotPlay:true,stats},keys),false);
});
test('duplicate football kickoffs remain a missing game across every supported player market',()=>{
 const {definitions}=require('../public/player-stats');
 for(const key of [...definitions.map(d=>d.key),'attempts','targets']){
  const history=[1,2,3,4].map(gameDate=>({gameDate,[key]:10}));
  const ambiguous=[...history,{...history[1],[key]:0}];
  const result=project(ambiguous,key);
  assert.equal(result.withheld,true,key);assert.equal(result.coverage.total,4);assert.equal(result.coverage.recorded,3);assert.equal(result.coverage.missing,1);assert.deepEqual(result.values,[10,10,10]);
  assert.equal(project(history,key).withheld,undefined);
  assert.equal(project([...history,{...history[1]}],key).withheld,true,'identical duplicates still need identity resolution');
 }
});

test('Daniels verified absences leave four passing games and the played zero',()=>{
 const player={name:'Jayden Daniels',team:'Washington Commanders',teamId:'18',games:new Map()};
 const calendar=new Map(), records=new Map([['qb',player]]);
 const rows=[
  ['09-13','Philadelphia Eagles',22,24,164,2],['09-20','Dallas Cowboys',20,37,96,1],
  ['09-27','Seattle Seahawks',33,31],['10-04','Indianapolis Colts',13,30],
  ['10-11','New York Giants',27,27,199,0],['10-19','San Francisco 49ers',17,23,300,2]
 ];
 for(const [day,name,scored,allowed,passYds,passTD] of rows){
  const date=Date.parse('2026-'+day+'T18:00:00Z')/1000;
  calendar.set(day,{date,teams:new Map([['18',{name,scored,allowed}]])});
  player.games.set(day,{gameDate:date,opponent:name,passYds,passTD});
 }
 assert.equal(applyReviewedHistory(records,calendar,{league:'1',season:'2025'}),false);
 assert.equal(applyReviewedHistory(records,calendar,{league:'1',season:'2026'}),true);
 for(const [key,line] of [['passYds',198.5],['passTD',1.5]]){
  const history=[...player.games.values()],form=summarize(history,key);
  assert.equal(form.coverage.dnp,2);
  assert.equal(form.values.length,4);
  assert.equal(form.values.filter(x=>x>line).length,2);
  assert.equal(form.values.filter(x=>x<line).length,2);
  assert.ok(!project(history,key).withheld);
 }
});

test('Washington inactive reports only fill empty slots for the named player and exact game',()=>{
 const calendar=new Map(),records=new Map();
 for(const [id,date,name,scored,allowed] of [['4','2026-10-04','Indianapolis Colts',13,30],['5','2026-10-11','New York Giants',27,27]]){
  calendar.set(id,{date:Date.parse(date+'T17:00Z')/1000,teams:new Map([['18',{name,scored,allowed}]])});
 }
 for(const name of ['Rachaad White','Stefon Diggs']){
  const games=new Map([...calendar].map(([id,g])=>[id,{gameDate:g.date,opponent:g.teams.get('18').name}]));
  records.set(name,{name,team:'Washington Commanders',teamId:'18',games});
 }
 applyReviewedHistory(records,calendar,{league:'1',season:'2026'});
 for(const [name,id,played] of [['Rachaad White','4','5'],['Stefon Diggs','5','4']]){
  const games=records.get(name).games;
  assert.equal(games.get(id).verification.participation,true);
  assert.equal(games.get(id).participation,'dnp');
  assert.equal(games.get(played).participation,undefined);
 }
});
