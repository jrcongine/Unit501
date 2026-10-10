const {test}=require('node:test');
const assert=require('node:assert/strict');
const {buildRatings,createRatings,role}=require('../player-ratings');
function fixture(){
 const rosters=new Map([['1',Array.from({length:8},(_,i)=>({id:String(i+1),name:'QB '+i,position:'QB'})).concat({id:'99',name:'Lineman',position:'OT'})]]);
 const games=Array.from({length:10},(_,i)=>({game:{id:i+1,date:{timestamp:i+1},stage:'Regular Season',status:{short:'FT'}},teams:{home:{id:1},away:{id:2}}}));
 const boxes=new Map(games.map(g=>[String(g.game.id),[{team:{id:1},groups:[{name:'Passing',players:Array.from({length:8},(_,i)=>({player:{id:String(i+1)},statistics:[{name:'yards',value:100+i*20},{name:'rating',value:60+i*5},{name:'passing touch downs',value:i/4},{name:'interceptions',value:7-i}]}))}]}]]));
 return {games,boxes,rosters};
}
test('same-position production ranks stronger records higher, bounded and sample softened',()=>{
 const f=fixture(),ratings=buildRatings(f.games,f.boxes,f.rosters,20000);
 assert.ok(ratings.find(p=>p.id==='8').rating>ratings.find(p=>p.id==='1').rating);
 assert.ok(ratings.filter(p=>p.rating!==null).every(p=>p.rating>=0&&p.rating<=99));
 assert.equal(ratings.find(p=>p.id==='99').rating,null);
 assert.equal(ratings.find(p=>p.id==='8').coverage.length,4);
});
test('insufficient peers, games and missing metrics remain unrated; actual zero counts',()=>{
 const f=fixture();
 assert.ok(buildRatings(f.games.slice(0,1),f.boxes,f.rosters,20000).every(p=>p.rating===null));
 const small=new Map([['1',f.rosters.get('1').slice(0,7)]]);
 assert.ok(buildRatings(f.games,f.boxes,small,20000).every(p=>p.rating===null));
 const ratings=buildRatings(f.games,f.boxes,f.rosters,20000);
 assert.equal(ratings.find(p=>p.id==='1').coverage.find(c=>c.name==='passing touch downs').count,10);
});
test('future games, exact cutoff and preseason excluded; duplicate games do not inflate history',()=>{
 const f=fixture();
 const base=buildRatings(f.games,f.boxes,f.rosters,10000);
 assert.equal(base[0].games,9);
 const duplicate=buildRatings([...f.games,...f.games],f.boxes,f.rosters,10000);
 assert.deepEqual(duplicate,base);
 f.games[0].game.stage='Pre Season';
 assert.equal(buildRatings(f.games,f.boxes,f.rosters,10000)[0].games,8);
});
test('position families remain separate and unsupported blockers are not guessed',()=>{
 for(const [position,expected]of [['QB','QB'],['WR','WR'],['TE','TE'],['DT','DL'],['MLB','LB'],['CB','DB'],['K','K'],['PK','K'],['P','P'],['OT','OL'],['LS','LS']])assert.equal(role(position),expected);
});
test('recent improvement appears in trend without using a future box score',()=>{
 const f=fixture();
 for(const g of f.games){const stats=f.boxes.get(String(g.game.id))[0].groups[0].players[3].statistics;
  stats[0].value=g.game.id>7?500:100;stats[1].value=g.game.id>7?140:70;stats[2].value=g.game.id>7?5:1;stats[3].value=0;}
 const p=buildRatings(f.games,f.boxes,f.rosters,20000).find(p=>p.id==='4');
 assert.equal(p.trend,'Rising');
});
test('league build refuses incomplete team pool and reports provider errors',async()=>{
 for(const response of [{response:[]},{response:[],errors:{quota:'exceeded'}}]){
  const get=createRatings(async()=>response,{delayMs:0});const job=get({season:'2026',before:20000});
  for(let i=0;i<30&&job.state==='loading';i++)await new Promise(r=>setTimeout(r,2));
  assert.equal(job.state,'error');assert.equal(job.data,undefined);
 }
});
test('league job builds all 32 rosters, excludes future boxes and shares cached reports',async()=>{
 const games=Array.from({length:32},(_,i)=>({league:{id:1,season:2026},game:{id:i+1,date:{timestamp:i<16?1:2},stage:'Regular Season',status:{short:'FT'}},teams:{away:{id:(i%16)*2+1},home:{id:(i%16)*2+2}}}));
 const requested=[];
 const api=async endpoint=>{requested.push(endpoint);
  if(endpoint.startsWith('/games?'))return {response:[...games,{...games[0],game:{...games[0].game,id:99,date:{timestamp:30}}}]};
  if(endpoint.startsWith('/players?')){const id=Number(new URLSearchParams(endpoint.split('?')[1]).get('team'));return {response:[{id:id+100,position:'QB',name:'Player '+id}]};}
  const g=games.find(g=>g.game.id===Number(endpoint.split('=')[1]));
  return {response:[g.teams.away,g.teams.home].map(team=>({team,groups:[{name:'Passing',players:[{player:{id:team.id+100},statistics:[{name:'yards',value:200},{name:'rating',value:90}]}]}]}))};
 };
 const get=createRatings(api,{delayMs:0});
 async function finish(job){for(let i=0;i<300&&job.state==='loading';i++)await new Promise(r=>setTimeout(r,2));return job;}
 const job=await finish(get({season:'2026',before:20000}));
 assert.equal(job.state,'ready');assert.equal(job.completed,64);
 assert.equal(job.data.players.length,32);assert.ok(job.data.players.every(p=>p.rating===50));
 assert.ok(!requested.includes('/games/statistics/players?id=99'));
 const next=await finish(get({season:'2026',before:25000}));assert.equal(next.state,'ready');
 assert.equal(requested.filter(x=>x.startsWith('/players?')).length,32);
 assert.equal(requested.filter(x=>x.includes('/statistics/players')).length,32);
});

test('breakout production raises the rating over successive weekly cutoffs',()=>{
 const f=fixture();
 for(const g of f.games){const stats=f.boxes.get(String(g.game.id))[0].groups[0].players[3].statistics;
  const breakout=g.game.id>4;
  stats[0].value=breakout?500:100;stats[1].value=breakout?140:60;
  stats[2].value=breakout?5:0;stats[3].value=breakout?0:4;
 }
 const at=cutoff=>buildRatings(f.games,f.boxes,f.rosters,cutoff).find(p=>p.id==='4');
 const early=at(5000),middle=at(8000),late=at(11000);
 assert.equal(early.games,4);assert.equal(middle.games,7);assert.equal(late.games,10);
 assert.ok(middle.rating>early.rating);assert.ok(late.rating>middle.rating);
 assert.equal(late.trend,'Rising');
 const original=at(5000);
 for(const g of f.games.filter(g=>g.game.id>=5))for(const p of f.boxes.get(String(g.game.id))[0].groups[0].players)for(const s of p.statistics)s.value=9999;
 assert.deepEqual(at(5000),original);
});

test('declining production lowers the rating as subsequent games are recorded',()=>{
 const f=fixture();
 for(const g of f.games){const stats=f.boxes.get(String(g.game.id))[0].groups[0].players[3].statistics;
  const decline=g.game.id>4;
  stats[0].value=decline?50:500;stats[1].value=decline?40:140;
  stats[2].value=decline?0:5;stats[3].value=decline?5:0;
 }
 const at=cutoff=>buildRatings(f.games,f.boxes,f.rosters,cutoff).find(p=>p.id==='4');
 assert.ok(at(11000).rating<at(5000).rating);
 assert.equal(at(11000).trend,'Falling');
});

test('replacement profiles parse combined attempts, keep missing latest games unknown and separate team histories',()=>{
 const f=fixture();
 for(const g of f.games)for(const p of f.boxes.get(String(g.game.id))[0].groups[0].players)p.statistics.push({name:'Comp/Att',value:'18/30'});
 const p=buildRatings(f.games,f.boxes,f.rosters,20000).find(p=>p.id==='8');
 assert.equal(p.profiles.passing.usage,30);assert.equal(p.profiles.passing.games,10);assert.equal(p.profiles.passing.latestMissing,false);
 const latest=f.games.at(-1);f.boxes.set(String(latest.game.id),[{team:{id:1},groups:[]}]);
 assert.equal(buildRatings(f.games,f.boxes,f.rosters,20000).find(p=>p.id==='8').profiles.passing.latestMissing,true);
});
test('college production includes completed non-NFL stages; NFL retains the regular-season gate',()=>{
 const f=fixture();for(const g of f.games)g.game.stage='NCAA';
 assert.ok(buildRatings(f.games,f.boxes,f.rosters,20000,'2').some(p=>p.rating!==null));
 assert.ok(buildRatings(f.games,f.boxes,f.rosters,20000,'1').every(p=>p.rating===null));
});
test('college league build uses all verified FBS rosters and rejects missing membership',async()=>{
 const membership=require('../fbs-2026.json');
 const teams=membership.teams.map((t,i)=>({id:i+1,name:t.name}));
 const games=teams.filter((t,i)=>i%2===0).map((t,i)=>({league:{id:2,season:2026},game:{id:i+1,date:{timestamp:1},stage:'NCAA',status:{short:'NS'}},teams:{away:t,home:teams[i*2+1]}}));
 const calls=[];
 const get=createRatings(async endpoint=>{calls.push(endpoint);return {response:endpoint.startsWith('/games?')?games:[{id:1,position:'OL',name:'Lineman'}]};},{delayMs:0});
 const job=get({league:'2',season:'2026',before:20000});
 for(let i=0;i<400&&job.state==='loading';i++)await new Promise(r=>setTimeout(r,2));
 assert.equal(job.state,'ready');assert.equal(job.data.league,'2');assert.equal(job.data.players.length,138);
 assert.equal(job.completed,job.total);assert.ok(job.total>=138);
 assert.ok(calls.includes('/games?league=2&season=2026'));assert.equal(calls.filter(p=>p.startsWith('/players?')).length,138);
 assert.ok(job.data.players.every(p=>p.rating===null&&p.role==='OL'));
});
