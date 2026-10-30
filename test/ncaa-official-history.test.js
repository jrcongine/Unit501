'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {football,basketball,createNCAA}=require('../ncaa-official-history');
const {reconcile}=require('../nba-official-history');
const {applyParticipation}=require('../public/player-stats');
const main=require('./fixtures/ncaa-football-game.json'),box=require('./fixtures/ncaa-football-box.json'),slate=require('./fixtures/ncaa-football-slate.json');
const e={id:'123',sport:'MFB',season:2026,tipoff:'2026-10-24T16:00:00Z',teams:[{side:'away',id:'221',name:'Pittsburgh Panthers',score:23},{side:'home',id:'2390',name:'Miami Hurricanes',score:52}]};
const bmain=require('./fixtures/ncaa-basketball-game.json'),bbox=require('./fixtures/ncaa-basketball-box.json'),bg=bmain.data.contests[0];
const be={id:'456',sport:'MBB',season:2026,stage:2,tipoff:new Date(bg.startTimeEpoch*1000).toISOString(),teams:bg.teams.map(t=>({id:t.teamId,side:t.isHome?'home':'away',name:t.nameShort,score:t.score}))};
test('real NCAA football verifies a rushing appearance and zero receiving without fabricating targets or DNP',()=>{
 const r=football(main,box,e,6604312),m=r.teams[1].players.find(p=>p.name==='JAVIAN MALLORY');assert.equal(m.rec,0);assert.equal(m.recYds,0);assert.equal(m.rushYds,47);assert.equal(m.targets,undefined);assert.equal(m.participation,'played');assert(r.teams.every(t=>t.players.every(p=>p.participation!=='dnp')));
});
test('NCAA football wrong game, season, scores, duplicate player and totals fail safely',()=>{
 for(const change of [d=>d.data.contests[0].seasonYear=2025,d=>d.data.contests[0].teams[0].score=0,d=>d.data.contests[0].sportCode='MBB']){const d=structuredClone(main);change(d);assert.throws(()=>football(d,box,e,6604312));}
 const d=structuredClone(box);d.data.boxscore.teamBoxscore[0].teamStats.TeamReceivingStats.receivingYards='388';const r=football(main,d,e,6604312);assert(r.teams[1].players.every(p=>p.recYds===undefined));
 d.data.boxscore.teamBoxscore[0].playerStats.push(d.data.boxscore.teamBoxscore[0].playerStats[0]);assert.throws(()=>football(main,d,e,6604312),/ambiguous/);
});
test('NCAA official fields reach the same zero-inclusive client history',()=>{
 const r=football(main,box,e,6604312),record={name:'Javian Mallory',team:'Miami Hurricanes',teamId:'2390',games:new Map([['123',{gameDate:r.gameDate}]])},calendar=new Map([['123',{date:r.gameDate,teams:new Map([['2390',{name:'Pittsburgh Panthers',scored:52,allowed:23}]])}]]);
 assert.equal(applyParticipation(new Map([['player',record]]),calendar,r,{league:'2',season:'2026'}),1);assert.equal(record.games.get('123').recYds,0);
});
test('real NCAA basketball preserves zero-stat appearances and converts the season convention',()=>{
 const r=basketball(bmain,bbox,be,bg.id),p=r.teams[0].players.find(p=>p.name==='Aleks Alston');assert.equal(p.participation,'played');assert.equal(p.minutes,3.8);assert.deepEqual(p.values,{player_points:0,player_rebounds:0,player_assists:0,player_threes:0});assert.throws(()=>basketball(bmain,bbox,{...be,season:2025},bg.id));
});
test('zero rounded minutes and zero statistics are unknown, never an inferred college DNP',()=>{
 const b=structuredClone(bbox),row=b.data.boxscore.teamBoxscore[0].playerStats.find(p=>p.firstName==='Aleks');row.minutesPlayed='0';row.fieldGoalsAttempted='0';row.threePointsAttempted='0';row.freeThrowsAttempted='0';row.turnovers='0';row.personalFouls='0';row.steals='0';row.blockedShots='0';const r=basketball(bmain,b,be,bg.id),p=r.teams[0].players.find(p=>p.name==='Aleks Alston');assert.equal(p.participation,'unknown');
 const record={id:'10',name:p.name,available:true,results:[],inactive:[]};reconcile(new Map([[record.id,record]]),[{id:be.id,tipoff:be.tipoff}],new Map([[be.id,r]]),be.teams[0].id);assert.equal(record.inactive.length,0);assert.equal(record.results.length,0);
});
test('official NCAA source discovers query hashes, verifies identity and caches five public reads',async()=>{
 const sha='a'.repeat(64),index={scoreboard:{contestsDataUrl:'https://sdataprod.ncaa.com?meta=GetContests_web&extensions='+encodeURIComponent(JSON.stringify({persistedQuery:{sha256Hash:sha}}))}},game={gamecenter:{basePath:'/game/6604312',gqlShas:{GetGamecenterGameById_web:sha,NCAA_GetGamecenterBoxscoreFootballById_web:sha}}};let calls=0;
 const get=createNCAA({now:()=>Date.parse('2026-10-31T00:00Z'),fetcher:async url=>{calls++;const u=new URL(url);const data=u.hostname==='www.ncaa.com'?'<script data-drupal-selector="drupal-settings-json">'+JSON.stringify(u.pathname.startsWith('/scoreboard')?index:game)+'</script>':JSON.stringify(u.searchParams.get('meta')==='GetContests_web'?slate:u.searchParams.get('meta')==='GetGamecenterGameById_web'?main:box);return {ok:true,text:async()=>data};}});
 const r=await get(e);assert.equal(r.available,true);assert.equal(r.source,'https://www.ncaa.com/game/6604312');assert.equal((await get(e)).available,true);assert.equal(calls,5);
});
