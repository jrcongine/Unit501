const {test}=require('node:test');
const assert=require('node:assert/strict');
const {project,simulate}=require('../public/team-model');
const {weatherEffect}=require('../public/team-model');
function forecast(windMph = 25) {
 const now=2000000, game={kickoff:3000000};
 return {now,game,data:{roof:'outdoor',available:true,kickoff:game.kickoff,
   fetchedAt:now,forecastTime:game.kickoff,windMph}};
}
test('wind affects scores only above threshold, with a bounded reduction',()=>{
 for (const [wind,reduction] of [[0,0],[15,0],[20,.05],[25,.1],[30,.15],[90,.15]]) {
  const {game,data,now}=forecast(wind);
  assert.equal(weatherEffect(game,data,true,now).reduction,reduction);
 }
});
test('domes, unknown roofs, disabled weather, stale and mismatched forecasts retain scores',()=>{
 const {game,data,now}=forecast();
 const variants=[null,{...data,roof:'indoor'},{...data,roof:'unknown'},
  {...data,available:false},{...data,kickoff:game.kickoff+1},
  {...data,fetchedAt:now-900001},{...data,fetchedAt:now+1},
  {...data,forecastTime:game.kickoff+1800001},
  {...data,windMph:null},{...data,windMph:-1},{...data,windMph:Infinity},
  {...data,windMph:201}];
 for(const value of variants) assert.equal(weatherEffect(game,value,true,now).reduction,0);
 assert.equal(weatherEffect(game,data,false,now).reduction,0);
 assert.equal(weatherEffect(game,data,true,game.kickoff).reduction,0);
});
test('rain probability and gusts alone never substitute for sustained wind',()=>{
 const {game,data,now}=forecast(10);
 assert.equal(weatherEffect(game,{...data,gustMph:60,precipitationChance:100,temperatureF:0},true,now).reduction,0);
});
test('weather flows into final scores and simulator after home-field and manual adjustments',()=>{
 const {game,data}=setup();
 const now=0;
 const weather={roof:'outdoor',available:true,kickoff:100,forecastTime:100,fetchedAt:0,windMph:25};
 const baseline=project(data,game,{away:2,home:-1,venueMode:'home',weatherEnabled:false});
 const p=project(data,game,{away:2,home:-1,venueMode:'home',forecast:weather,now});
 assert.equal(p.weather.applied,true);
 assert.equal(p.away,baseline.away*.9);
 assert.equal(p.home,baseline.home*.9);
 assert.equal(p.preWeatherAway,baseline.away);
 assert.ok(simulate(p,0,48,10000,rng()).over<simulate(baseline,0,48,10000,rng()).over);
});
function setup() {
 const game={kickoff:100,season:'2026',league:'1',awayId:'0',homeId:'1'};
 const teams=Array.from({length:32},(_,i)=>({id:String(i),games:4,metrics:Object.fromEntries(['pointsFor','pointsAgainst'].map(key=>[key,{average:24,games:4,rank:i+1,pool:32}]))}));
 return {game,data:{before:100,season:'2026',teams,coverage:{pointsFor:{ranked:true,expected:32},pointsAgainst:{ranked:true,expected:32}}}};
}
test('injury scenario lowers own offense and raises opponent scoring for a defense loss',()=>{
 const {game,data}=setup();
 const p=project(data,game,{injury:{awayOffense:4,awayDefense:3,homeOffense:2,homeDefense:1}});
 assert.equal(p.away,21);assert.equal(p.home,25);
 assert.equal(p.injury.awayChange,-3);assert.equal(p.injury.homeChange,1);
 assert.equal(p.injury.applied,true);
 assert.equal(project(data,game).injury.applied,false);
});
test('injury estimates validate independently and preserve manual, venue and wind ordering',()=>{
 const {game,data}=setup();
 for(const value of [-1,15,NaN,'4']) assert.equal(project(data,game,{injury:{awayOffense:value}}).available,false);
 const p=project(data,game,{away:2,home:-1,venueMode:'home',injury:{awayOffense:4,homeDefense:1},
   forecast:{roof:'outdoor',available:true,kickoff:100,forecastTime:100,fetchedAt:0,windMph:25},now:0});
 assert.equal(p.preInjuryAway,26);assert.equal(p.preVenueAway,23);
 assert.equal(p.preWeatherAway,22);assert.equal(p.away,19.8);
 for(const t of data.teams) for(const m of Object.values(t.metrics)) m.average=0;
 assert.equal(project(data,game,{injury:{awayOffense:14}}).away,0);
});
test('equal teams project league average; stronger scoring offense raises its own score',()=>{
 const {game,data}=setup();
 assert.equal(project(data,game).away,24);
 assert.equal(project(data,game).home,24);
 data.teams[0].metrics.pointsFor.average=40;
 const p=project(data,game);
 assert.ok(p.away>p.home);
 assert.ok(p.away<40); // early-season shrinkage, rather than raw average
});
test('opposing defense is applied to correct side and point overrides are explicit',()=>{
 const {game,data}=setup();
 data.teams[1].metrics.pointsAgainst.average=40;
 const p=project(data,game);
 assert.equal(p.away,32);
 assert.equal(p.home,24);
 const adjusted=project(data,game,{away:2,home:-3});
 assert.equal(adjusted.away,34);
 assert.equal(adjusted.home,21);
 assert.equal(project(data,game,{away:15}).available,false);
});
test('offense separation is not halved again and a strong opposing defense suppresses a weak offense',()=>{
 const {game,data}=setup();
 data.teams[0].metrics.pointsFor.average=8;
 data.teams[1].metrics.pointsFor.average=40;
 data.teams[0].metrics.pointsAgainst.average=40;
 data.teams[1].metrics.pointsAgainst.average=8;
 const p=project(data,game);
 assert.equal(p.away,8);assert.equal(p.home,40);
 assert.equal(p.home-p.away,32);
 // Old formula would have projected 16–32, halving this margin to 16.
});
test('stale matchup, incomplete pool, small samples and outside-pool teams block predictions',()=>{
 const {game,data}=setup();
 assert.equal(project(data,{...game,kickoff:101}).available,false);
 assert.equal(project(data,{...game,season:'2027'}).available,false);
 assert.equal(project(data,{...game,awayId:'FCS'}).available,false);
 data.teams[0].games=1;
 assert.equal(project(data,game).available,false);
 data.teams[0].games=4;
 data.coverage.pointsAgainst.ranked=false;
 assert.equal(project(data,game).available,false);
});
function rng() {let seed=123;return ()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};}
test('positive away spread increases cover rate; higher totals reduce over rate',()=>{
 const p={available:true,away:24,home:24};
 const a=simulate(p,-7,40,10000,rng());
 const b=simulate(p,7,60,10000,rng());
 assert.ok(b.cover>a.cover);
 assert.ok(b.over<a.over);
 assert.equal(a.win,b.win);
});
test('integer score pushes counted separately; fractional lines cannot push',()=>{
 const p={available:true,away:24,home:24};
 const a=simulate(p,0,48,10000,rng());
 assert.ok(a.spreadPush>0);
 assert.equal(a.spreadPush,a.tie);
 assert.ok(a.totalPush>0);
 const b=simulate(p,.5,48.5,10000,rng());
 assert.equal(b.spreadPush,0);
 assert.equal(b.totalPush,0);
});
test('flooring low scores does not inflate simulated scoring and zero means zero',()=>{
 const p={available:true,away:2,home:24};
 const result=simulate(p,0,26,50000,rng());
 assert.ok(Math.abs(result.meanAway-2)<.15);
 assert.ok(Math.abs(result.meanHome-24)<.2);
 assert.equal(simulate({...p,away:0},0,24,10000,rng()).meanAway,0);
});
test('simulation fits only validated earlier-error variance for the current model',()=>{
 const p={available:true,away:24,home:24};
 assert.match(simulate(p,0,48,10,rng()).varianceSource,/Default/);
 assert.match(simulate({...p,calibration:{modelVersion:'scoring-v2',games:30,awaySD:12,homeSD:12,correlation:.2}},0,48,10,rng()).varianceSource,/Earlier/);
 assert.match(simulate({...p,calibration:{modelVersion:'scoring-v1',games:30,awaySD:12,homeSD:12,correlation:.2}},0,48,10,rng()).varianceSource,/Default/);
});
test('college pool supported with 138 complete teams; insufficient pool is blocked',()=>{
 const {game,data}=setup();
 game.league='2';
 data.coverage.pointsFor.expected=138;
 data.coverage.pointsAgainst.expected=138;
 data.teams=Array.from({length:138},(_,i)=>({...data.teams[0],id:String(i),metrics:{pointsFor:{average:30,games:4,rank:i+1,pool:138},pointsAgainst:{average:25,games:4,rank:i+1,pool:138}}}));
 assert.equal(project(data,game).available,true);
 data.teams.pop();
 assert.equal(project(data,game).available,false);
});

function scheduled() {
 const value=setup();
 for(const team of value.data.teams) team.opponents=Array.from({length:4},()=>({id:'2',scored:24,allowed:24}));
 return value;
}
test('average schedule has zero correction and manual adjustments remain additive',()=>{
 const {game,data}=scheduled();
 const p=project(data,game);
 assert.equal(p.schedule.applied,true);
 assert.equal(p.away,p.unadjustedAway);
 assert.equal(p.home,p.unadjustedHome);
 const adjusted=project(data,game,{away:2,home:-3});
 assert.equal(adjusted.away,p.away+2);
 assert.equal(adjusted.home,p.home-3);
});
test('weak past defenses lower offensive projection; strong past offenses improve defensive projection',()=>{
 const {game,data}=scheduled();
 data.teams[1].opponents.forEach(p=>p.id='3');
 data.teams[2].metrics.pointsAgainst.average=40;
 data.teams[2].metrics.pointsFor.average=40;
 const p=project(data,game);
 assert.equal(p.schedule.applied,true);
 assert.ok(p.away<p.unadjustedAway);
 assert.ok(p.home<p.unadjustedHome);
 assert.ok(p.schedule.away.offense<0);
 assert.ok(p.schedule.away.defense<0);
});
test('opponent correction excludes the observed head-to-head result',()=>{
 const {game,data}=scheduled();
 data.teams[2].metrics.pointsAgainst.average=30;
 data.teams[0].opponents.forEach(p=>p.scored=48);
 // Opponent allowed 120 total, minus 48 head-to-head = 72 in three other games.
 const p=project(data,game);
 assert.ok(Math.abs(p.schedule.away.offense-(p.baseline-24)*3/14)<1e-9);
});
test('missing, outside-pool, one-game and invalid opponent samples keep both baseline scores',()=>{
 for(const modify of [
  d=>d.teams[0].opponents.pop(),
  d=>d.teams[0].opponents[0].id='FCS',
  d=>d.teams[0].opponents[0].allowed=null,
  d=>d.teams[2].games=1,
  d=>d.teams[0].opponents[0].scored=999
 ]) {
  const {game,data}=scheduled();modify(data);
  const p=project(data,game);
  assert.equal(p.schedule.applied,false);
  assert.equal(p.away,p.unadjustedAway);
  assert.equal(p.home,p.unadjustedHome);
 }
});
test('extreme opponent averages are capped before team sample smoothing',()=>{
 const {game,data}=scheduled();
 data.teams[2].metrics.pointsAgainst.average=1000;
 const p=project(data,game);
 assert.equal(p.schedule.away.offense,-6);
 assert.ok(Math.abs(p.away-p.unadjustedAway)<=3);
});

test('inferred home venue changes margin while preserving total and manual adjustments',()=>{
 const {game,data}=scheduled(); game.venueName='Test Stadium';
 data.teams[1].homeVenues={teststadium:2};
 const p=project(data,game,{away:2,home:-1});
 assert.equal(p.venue.appliedMargin,2);
 assert.equal(p.away,p.preVenueAway-1);
 assert.equal(p.home,p.preVenueHome+1);
 assert.equal(p.away+p.home,p.preVenueAway+p.preVenueHome);
 assert.match(p.venue.reason,/inferred/);
});
test('neutral selection overrides inferred home venue; unknown and shared venues get no boost',()=>{
 const {game,data}=scheduled();game.venueName='Test Stadium';
 data.teams[1].homeVenues={teststadium:2};
 assert.equal(project(data,game,{venueMode:'neutral'}).venue.appliedMargin,0);
 data.teams[0].homeVenues={teststadium:1};
 assert.equal(project(data,game).venue.appliedMargin,0);
 delete data.teams[0].homeVenues;
 data.teams[1].homeVenues.teststadium=1;
 assert.equal(project(data,game).venue.appliedMargin,0);
 game.venueName='';
 assert.equal(project(data,game).venue.appliedMargin,0);
 assert.equal(project(data,game,{venueMode:'home'}).venue.appliedMargin,2);
 assert.equal(project(data,game,{venueMode:'invalid'}).available,false);
});
test('college home assumption is explicit and nonnegative scores preserve the total',()=>{
 const {venueEffect}=require('../public/team-model');
 assert.equal(venueEffect({league:'2'},{},{},'home').margin,3);
 const {game,data}=setup();
 for(const team of data.teams) for(const m of Object.values(team.metrics)) m.average=0;
 const p=project(data,game,{venueMode:'home'});
 assert.equal(p.away,0);assert.equal(p.home,0);assert.equal(p.venue.appliedMargin,0);
});

test('separately verified opponent schedules fill gaps without entering the ranking pool',()=>{
 const {game,data}=scheduled();
 data.teams[0].opponents[0].id='outside';
 const extra={...data.teams[2],id:'outside',name:'Outside opponent',scoringOnly:true,opponentScheduleVerified:true,
  metrics:{pointsFor:{average:24,games:4,rank:null,pool:0},pointsAgainst:{average:24,games:4,rank:null,pool:0}}};
 data.teams.push(extra);
 const p=project(data,game);
 assert.equal(p.schedule.applied,true);
 assert.equal(p.schedule.away.supplemental,1);
 assert.equal(p.baseline,24);
 extra.opponentScheduleVerified=false;
 const unavailable=project(data,game);
 assert.equal(unavailable.schedule.applied,false);
 assert.deepEqual(unavailable.schedule.away.missing,['Outside opponent']);
 extra.opponentScheduleVerified=true;extra.metrics.pointsAgainst.games=3;
 assert.equal(project(data,game).schedule.applied,false);
});

test('lineup effects require the exact matchup and run before venue/weather; manual points remain additional',()=>{
 const {data,game}=setup();game.id='99';
 const lineup={applied:true,gameId:'99',kickoff:game.kickoff,teams:{[game.awayId]:{points:-3},[game.homeId]:{points:2}}};
 const p=project(data,game,{lineup,injury:{awayOffense:1}});
 assert.equal(p.away,20);assert.equal(p.home,26);assert.equal(p.lineup.awayChange,-3);assert.equal(p.injury.awayChange,-1);
 assert.equal(project(data,game,{lineup:{...lineup,gameId:'98'}}).away,24);
 assert.equal(project(data,game,{lineup:{...lineup,teams:{[game.awayId]:{points:NaN}}}}).available,false);
});
test('probability fits are cutoff, league and season scoped and withheld for adjusted scenarios',()=>{
 const {data,game}=setup();
 const fit={method:'temperature-v1',games:150,slope:.5};
 data.validation={probabilityCalibration:{modelVersion:'scoring-v2',before:game.kickoff,league:game.league,season:game.season,win:fit,cover:fit,over:fit}};
 let p=project(data,game);assert.ok(p.probabilityCalibration);
 const r=simulate(p,7.5,48.5,100,()=>.5);assert.ok(Number.isFinite(r.calibrated.win));
 assert.equal(project(data,game,{away:1}).probabilityCalibration,null);
 assert.equal(project(data,game,{injury:{awayOffense:1}}).probabilityCalibration,null);
 assert.equal(project(data,game,{venueMode:'home'}).probabilityCalibration,null);
 data.validation.probabilityCalibration.league='2';assert.equal(project(data,game).probabilityCalibration,null);
});
