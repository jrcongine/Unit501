'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
// Minimal DOM harness for actual client scripts; it does not test rendering.
function harness(storage=new Map(),extras=false) {
 const nodes=new Map(),timers=[],created=[];
 class Node {
  constructor(tag='div'){this.tag=tag;this.children=[];this.listeners={};this.dataset={};this.style={};this.validity={badInput:false};this._value='';this._text='';this.isConnected=true;this.className='';const has=n=>this.className.split(/\s+/).includes(n);const change=(n,yes)=>{const names=new Set(this.className.split(/\s+/).filter(Boolean));yes?names.add(n):names.delete(n);this.className=[...names].join(' ');};this.classList={add:n=>change(n,true),remove:n=>change(n,false),contains:has,toggle:(n,yes)=>change(n,yes??!has(n))};}
  set id(v){this._id=v;nodes.set(v,this);}get id(){return this._id;}
  set value(v){this._value=String(v);}get value(){return this._value;}
  set textContent(v){this._text=String(v);this.children=[];}get textContent(){return this._text+this.children.map(c=>typeof c==='string'?c:c.textContent).join('');}
  set innerHTML(v){this.replaceChildren();}get innerHTML(){return '';}
  append(...children){for(const child of children){if(child&&typeof child==='object'){if(child.parentNode)child.parentNode.children=child.parentNode.children.filter(c=>c!==child);child.parentNode=this;}this.children.push(child);}if(this.tag==='select'&&!this.value&&children[0])this.value=children[0].value;}
  appendChild(child){this.append(child);return child;}
  replaceChildren(...children){this.children=[];this._text='';if(this.tag==='select')this.value='';this.append(...children);}
  before(){}after(){}setAttribute(){}scrollIntoView(){}focus(){}
  querySelectorAll(selector){return selector==='.game'?this.children.filter(c=>typeof c.className==='string'&&c.className.split(/\s+/).includes('game')):[];}
  addEventListener(name,fn){(this.listeners[name]??=[]).push(fn);}
  async dispatchEvent(event){for(const fn of this.listeners[event.type]||[])await fn(event);}
 }
 const document=new Node('document');document.createElement=tag=>{const n=new Node(tag);created.push(n);return n;};document.getElementById=id=>nodes.get(id)||null;
 const html=fs.readFileSync(path.join(__dirname,'../public/index.html'),'utf8');
 for(const match of html.matchAll(/<(\w+)[^>]*\bid="([^"]+)"[^>]*>/g)){const node=new Node(match[1]);node.id=match[2];}
 nodes.get('date').value='2026-10-10';nodes.get('league').value='1';nodes.get('weatherEnabled').checked=true;
 const context={document,console,URLSearchParams,AbortSignal,Date,Event:class{constructor(type){this.type=type;}},setInterval:()=>0,setTimeout:(fn,delay)=>{timers.push({fn,delay,active:true});return timers.length;},clearTimeout:id=>{if(timers[id-1])timers[id-1].active=false;},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)}};
 context.CustomEvent=class extends context.Event {constructor(type,options={}){super(type);this.detail=options.detail;}};
 context.window=context;context.addEventListener=(...args)=>document.addEventListener(...args);vm.createContext(context);
 const stamp=Math.floor((Date.now()+86400000)/1000);
 const game={league:{id:1,season:2026},game:{id:999,stage:'Regular Season',date:{timestamp:stamp},status:{short:'NS',long:'Scheduled'},venue:{name:'Test Stadium'}},teams:{away:{id:1,name:'Team A'},home:{id:2,name:'Team B'}},scores:{away:{total:null},home:{total:null}}};
 const teams=Array.from({length:32},(_,i)=>({id:String(i+1),games:4,opponents:[],metrics:Object.fromEntries(['pointsFor','pointsAgainst','rushAgainst','passAgainst','rushFor','passFor'].map(key=>[key,{average:key.startsWith('points')?24:key.startsWith('rush')?100:220,games:4,rank:i+1,pool:32}]))}));
 const data={season:'2026',before:stamp*1000,scope:'NFL regular season',teams,coverage:{pointsFor:{ranked:true,expected:32},pointsAgainst:{ranked:true,expected:32}},metrics:[['pointsFor','Scoring offense',false],['pointsAgainst','Scoring defense',true]],explanation:'Fixture'};
 let polls=0;
 context.fetch=async url=>{
  const u=new URL(url,'http://localhost');let response;
  if(u.pathname==='/api/health')response={ok:true,liveData:true};
  else if(u.pathname==='/api/games')response={response:[game]};
  else if(u.pathname==='/api/league-pulse'){
   const league=u.searchParams.get('league')||'nfl';
   const teams=Array.from({length:league==='ncaaf'?138:['nba','mlb'].includes(league)?30:32},(_,i)=>({
    id:String(i+1),name:i===0?'Team A':i===1?'Team B':'League Team '+(i+1),
    providerName:i===0?'Team A':i===1?'Team B':'League Team '+(i+1),
    record:'5-2',rank:i+1,score:95-i*1.1,trend:i%2?'down':'up',trendLabel:i%2?'Declining':'Ascending',streakLabel:i%2?'L2':'W2'
   }));
   response={league,checkedAt:new Date().toISOString(),power:{available:true,season:2026,count:teams.length,
    top:teams.slice(0,10),middle:teams.slice(10,-10),bottom:teams.slice(-10),teams,
    basis:'Current season standings; display only.'},
    headlines:{available:true,items:[{title:'Verified league update',url:'https://www.espn.com/nfl/story/_/id/1',
     source:'ESPN',publishedAt:new Date().toISOString(),category:'League update'}]}};
  }
  else if(u.pathname==='/api/rankings')response={state:++polls===1?'loading':'ready',completed:2,total:32,data};
  else if(u.pathname==='/api/fanduel')response={available:true,awaySpread:7.5,total:48.5,spreadUpdated:Date.now(),totalUpdated:Date.now()};
  else if(u.pathname==='/api/team-games')response={response:[1,2].map(id=>({...game,game:{...game.game,id,date:{timestamp:stamp-id*86400-1000},status:{short:'FT',long:'Finished'}}}))};
  else if(u.pathname==='/api/player-stats')response={response:['1','2'].map((id,i)=>({team:{id:Number(id),name:'Team '+(i?'B':'A')},groups:[{name:'Rushing',players:[{player:{id:i+7,name:'RB '+id},statistics:[{name:'Total Rushes',value:20},{name:'Yards',value:100}]}]},{name:'Receiving',players:[{player:{id:i+7,name:'RB '+id},statistics:[{name:'Receptions',value:4},{name:'Yards',value:24},{name:'Targets',value:5}]}]}]}))};
  else if(u.pathname==='/api/football/player-lines')response={props:[{name:'RB 1',stat:'carries',line:19.5,updatedAt:Date.now()},{name:'RB 1',stat:'recYds',line:22.5,updatedAt:Date.now()},{name:'RB 1',stat:'rec',line:3.5,updatedAt:Date.now()}],coverage:require('../fanduel-props').marketCoverage([{stat:'carries'},{stat:'recYds'},{stat:'rec'}]),message:'Fixture props'};
  else if(u.pathname==='/api/availability')response={current:true,teams:['1','2'].map(id=>({id,roster:{available:true,checkedAt:Date.now(),rows:[{id:id==='1'?'7':'8',name:'RB '+id,position:'RB'},...(id==='1'?[{id:'9',name:'ZZBackup',position:'RB'}]:[])]},injuries:{available:true,checkedAt:Date.now(),rows:context.injuryOut?[{id:'7',teamId:'1',status:'Out',date:new Date().toISOString()}]:[]}})),message:'Fixture'};
  else if(u.pathname==='/api/player-ratings')response={state:'ready',data:{league:'1',season:'2026',before:stamp*1000,players:[{id:'7',teamId:'1',name:'RB 1',position:'RB',role:'RB',rating:80,trend:'Steady',games:4,coverage:[{count:4}],profiles:{receiving:{usage:2,efficiency:6,games:4,latestMissing:false,coverage:{recorded:4,total:4}},rushing:{usage:20,efficiency:5,games:4,latestMissing:false,coverage:{recorded:4,total:4}}}},{id:'9',teamId:'1',name:'ZZBackup',position:'RB',role:'RB',rating:45,trend:'Steady',games:4,coverage:[{count:4}],profiles:{receiving:{usage:2,efficiency:6,games:4,latestMissing:false,coverage:{recorded:4,total:4}},rushing:{usage:5,efficiency:3,games:4,latestMissing:false,coverage:{recorded:4,total:4}}}}]}};
  else throw Error('Unexpected client request '+url);
  if(extras&&u.pathname==='/api/player-stats')response.response[0].groups[0].players.push({player:{id:9,name:'ZZBackup'},statistics:[{name:'Total Rushes',value:5},{name:'Yards',value:15}]});
  return {ok:true,json:async()=>response};
 };
 const run=source=>vm.runInContext(source,context);
 for(const file of ['weather-model.js','probability-calibration.js','pace-model.js','team-model.js','forecast-archive.js','forecast-results.js','score-audit.js','score-audit-ui.js','market-reliability.js','injury-backtest.js','forecast-dashboard.js','venue-weather.js','football-position.js','auto-injury.js','line-watch.js','market-pulse.js','unit501-shared-ui.js','league-pulse.js','football-travel.js','app.js','injury-model.js','player-form.js','player-stats.js','player-backtest.js','player-controls.js','star-power.js','last-opponent.js','predictions.js'])run(fs.readFileSync(path.join(__dirname,'../public',file),'utf8'));
 if(extras)for(const file of ['availability.js','lineup-model.js','player-ratings-ui.js','auto-prep.js'])run(fs.readFileSync(path.join(__dirname,'../public',file),'utf8'));
 const settle=()=>new Promise(resolve=>setImmediate(resolve));
 return {nodes,storage,run,game,data,timers,settle,context,created};
}
test('league-wide power tiers and headlines appear after loading NFL and selected teams show overall ranks in Game Lab',async()=>{
 const h=harness();await h.settle();await h.settle();
 const panel=h.nodes.get('league-pulse');
 assert.equal(panel.hidden,false);
 assert.match(h.nodes.get('league-pulse-power').textContent,/Top 10 · Contenders/);
 assert.match(h.nodes.get('league-pulse-power').textContent,/Middle of the Pack/);
 assert.match(h.nodes.get('league-pulse-power').textContent,/Bottom 10 · Bottom Feeders/);
 assert.match(h.nodes.get('league-pulse-headlines').textContent,/Verified league update/);
 h.run('choose(parseGame('+JSON.stringify(h.game)+'))');await h.settle();
 const matchup=h.nodes.get('league-pulse-matchup').textContent;
 assert.match(matchup,/Overall Power Ranks/);
 assert.match(matchup,/#1 of 32/);
 assert.match(matchup,/#2 of 32/);
 assert.match(matchup,/Not a historical pregame rating/);
 const scoring=h.nodes.get('team-context').textContent;
 assert.match(scoring,/Scoring is ready|completed games before this matchup|Building rankings/);
 h.run('Unit501LeaguePulse.show("mlb")');await h.settle();
 assert.equal(h.nodes.get('league-pulse-league').value,'mlb');
 assert.match(h.nodes.get('league-pulse-power').textContent,/Top 10/);
 assert.match(h.nodes.get('league-pulse-matchup').textContent,/#1 of 32/);
});

test('player ratings start compact, with both rosters and replacement controls available on demand',async()=>{
  const h=harness(new Map(),true);await h.settle();
  h.run(`choose(parseGame(${JSON.stringify(h.game)}))`);await h.settle();await h.settle();
  const panel=h.nodes.get('player-ratings-panel');
  assert.equal(panel.tag,'details');
  assert.equal(panel.open,false);
  await h.nodes.get('build-player-ratings').onclick();await h.settle();
  const find=(root,cssClass)=>[...root.children].flatMap(child=>typeof child==='string'?[]:[...(child.className===cssClass?[child]:[]),...find(child,cssClass)]);
  const results=h.nodes.get('ratings-results');
  const teams=find(results,'player-rating-team');
  const scenarios=find(results,'player-rating-scenario');
  assert.equal(teams.length,2);
  assert.ok(teams.every(t=>t.open===false));
  assert.equal(scenarios.length,2);
  assert.ok(scenarios.every(s=>s.open===false));
  assert.match(teams[0].textContent,/Team A · 2 rated \/ 2 players/);
  assert.ok(h.nodes.get('baseline-1:7'));
  assert.ok(h.nodes.get('replacement-1:7'));
  assert.match(h.nodes.get('lineup-status').textContent,/No confirmed replacement scenario/);
});
test('actual client home-context control changes margin and resets on game selection',async()=>{
 const h=harness();await h.settle();h.run('$("league").value="1"');h.run(`choose(parseGame(${JSON.stringify(h.game)}))`);await h.settle();
 h.run('$("venueMode").value="home"; sim()');const first=h.nodes.get('score').textContent;
 h.nodes.get('homeFieldMode').value='manual';await h.nodes.get('homeFieldMode').dispatchEvent({type:'change'});h.nodes.get('homeFieldReason').value='Playoff elimination stakes';h.nodes.get('homeContext').value='4';await h.nodes.get('homeContext').dispatchEvent({type:'input'});assert.equal(h.nodes.get('score').textContent,'—');
 h.run('sim()');assert.notEqual(h.nodes.get('score').textContent,first);assert.match(h.nodes.get('simulation-report-text').textContent,/Manual total home advantage/);
 h.nodes.get('variableHomeField').checked=true;h.run(`choose(parseGame(${JSON.stringify(h.game)}))`);await h.settle();
 assert.equal(h.nodes.get('homeContext').value,'3');assert.equal(h.nodes.get('homeFieldMode').value,'auto');assert.equal(h.nodes.get('variableHomeField').checked,false);
});
test('team context labels pending yardage and provider coverage gaps without treating them as zero',async()=>{
 const h=harness();await h.settle();
 for(const team of h.data.teams.slice(0,2))for(const key of ['rushFor','passFor','rushAgainst','passAgainst'])
  team.metrics[key]={average:null,games:0,rank:null,pool:0};
 h.data.metrics=[['rushFor','Rushing offense',false],['passFor','Passing offense',false],
  ['pointsFor','Scoring offense',false],['rushAgainst','Run defense',true],['passAgainst','Pass defense',true]];
 h.data.detailCoverage={requested:16,eligible:100,limited:true};
 h.run(`choose(parseGame(${JSON.stringify(h.game)}))`);await h.settle();
 h.run(`showTeamContext(${JSON.stringify(h.data)},selected,{loading:true})`);
 assert.match(h.nodes.get('team-context').textContent,/Checking box scores/);
 assert.match(h.nodes.get('team-context').textContent,/Only 16 of 100 eligible games/);
 h.run(`showTeamContext(${JSON.stringify(h.data)},selected,{warning:'Provider box scores failed.'})`);
 assert.match(h.nodes.get('team-context').textContent,/No usable rushing\/passing totals/);
 assert.match(h.nodes.get('team-context').textContent,/Provider box scores failed/);
});

test('verified league yardage ranks appear without replacing the paid scoring or prop context',async()=>{
 const h=harness();await h.settle();
 h.run('$("league").value="1"');
 h.run('choose(parseGame('+JSON.stringify(h.game)+'))');await h.settle();
 h.data.metrics=[
  ['rushFor','Rushing offense',false],['passFor','Passing offense',false],
  ['pointsFor','Scoring offense',false],['rushAgainst','Run defense',true],
  ['passAgainst','Pass defense',true],['pointsAgainst','Scoring defense',true]
 ];
 h.data.teams[0].metrics.rushFor={average:99.2,games:4,rank:null,pool:0};
 h.data.teams[1].metrics.rushFor={average:97.3,games:4,rank:null,pool:0};
 h.data.verifiedYardage={coverage:32,source:'nflverse team-week statistics (CC BY 4.0)',teams:{
  '1':{rushFor:{average:99.2,rank:20,pool:32,games:4}},
  '2':{rushFor:{average:97.3,rank:21,pool:32,games:4}}
 }};
 h.run('showTeamContext('+JSON.stringify(h.data)+',selected,{loading:true})');
 const displayed=h.nodes.get('team-context').textContent;
 // Sampling may still be running, but all six visible league ranks are independently verified.
 // Do not display an orange missing-yardage warning above valid national rankings.
 assert.doesNotMatch(displayed,/Checking detailed rushing\/passing box scores/);
 assert.doesNotMatch(displayed,/missing yardage is not zero/);

 assert.match(displayed,/99\.2 yds\/game/);
 assert.match(displayed,/#20 of 32 \(nflverse\)/);
 assert.match(displayed,/#21 of 32 \(nflverse\)/);
 assert.match(displayed,/Display-only: does not change score or player projections/);
 assert.equal(h.data.teams[0].metrics.rushFor.rank,null);
});

async function selectPlayer(h,value='1:7'){
 const picker=h.nodes.get('predict-player');picker.value=value;
 await picker.dispatchEvent({type:'change'});
}

test('actual client flow allows scoring during ranking build and persists manual RB prop lines across reload/refresh',async()=>{
 const h=harness();await h.settle();h.run('$("league").value="1"');h.run(`choose(parseGame(${JSON.stringify(h.game)}))`);await h.settle();
 assert.match(h.nodes.get('team-context').textContent,/Scoring is ready/);
 h.run('sim()');assert.equal(h.nodes.get('score').textContent,'23–26');
 await h.nodes.get('predict').dispatchEvent({type:'click'});await h.settle();
 await selectPlayer(h);
 assert.match(h.nodes.get('prop-feed-status').textContent,/3\/8 modeled markets/);
 assert.match(h.nodes.get('prop-feed-status').textContent,/No usable lines returned for: Passing yards/);
 assert.equal(h.nodes.get('line-1:7-carries').value,'19.5');
 assert.equal(h.nodes.get('line-1:7-recYds').value,'22.5');assert.equal(h.nodes.get('line-1:7-rec').value,'3.5');
 const input=h.nodes.get('line-1:7-carries');input.value='21.5';await input.dispatchEvent({type:'input'});
 assert.ok([...h.storage].some(([k,v])=>k.endsWith(':1:7:carries')&&JSON.parse(v).value==='21.5'));
 const next=harness(h.storage);await next.settle();next.run('$("league").value="1"');next.run(`choose(parseGame(${JSON.stringify(next.game)}))`);await next.settle();
 await next.nodes.get('predict').dispatchEvent({type:'click'});await next.settle();
 await selectPlayer(next);
 assert.equal(next.nodes.get('line-1:7-carries').value,'21.5');
 // A new ranking response must not discard a saved manual line.
 next.run(`showTeamContext(${JSON.stringify(next.data)},selected)`);await next.settle();assert.equal(next.nodes.get('line-1:7-carries').value,'21.5');
});

test('open matchup refreshes expired reports, skips hidden tabs and preserves data during a fresh refresh',async()=>{
 const h=harness(new Map(),true);await h.settle();h.run(`choose(parseGame(${JSON.stringify(h.game)}))`);await h.settle();await h.settle();
 h.run('sim()');const before=h.run('Unit501Availability.snapshot()');
 const originalFetch=h.context.fetch;let release,calls=0;
 h.context.fetch=async url=>{if(String(url).startsWith('/api/availability')){calls++;await new Promise(resolve=>{release=resolve;});}return originalFetch(url);};
 const pending=h.nodes.get('refresh-availability').onclick();await h.settle();
 assert.equal(h.run('Unit501Availability.snapshot()'),before);assert.equal(h.nodes.get('score').textContent,'23–26');
 release();await pending;assert.equal(h.nodes.get('score').textContent,'—'); // Refreshed injury evidence invalidates the prior simulation.
 const clock=Date.now()+900001;h.context.Date=class extends Date{static now(){return clock;}};
 let tick=h.timers.findLast(t=>t.active&&t.delay===60000);assert.ok(tick);
 h.context.document.hidden=true;await tick.fn();assert.equal(calls,1);
 h.context.document.hidden=false;tick=h.timers.findLast(t=>t.active&&t.delay===60000);
 const refreshing=tick.fn();await h.settle();assert.equal(calls,2);release();await refreshing;
});
test('completing an accepted pace model invalidates an older scoring simulation only once',async()=>{
 const h=harness();await h.settle();h.run(`choose(parseGame(${JSON.stringify(h.game)}))`);await h.settle();h.run('sim()');assert.equal(h.nodes.get('score').textContent,'23–26');
 for(const t of h.data.teams)t.pace={games:4,drives:40,opponentDrives:40};
 h.data.paceValidation={accepted:true,league:'1',season:'2026',before:h.data.before,evaluatedGames:30,scoreError:8,baselineScoreError:9,totalError:10,baselineTotalError:11,explanation:'Fixture'};
 h.run(`showTeamContext(${JSON.stringify(h.data)},selected)`);assert.equal(h.nodes.get('score').textContent,'—');
 h.run('sim()');assert.equal(h.nodes.get('score').textContent,'23–26');
 h.run(`showTeamContext(${JSON.stringify(h.data)},selected)`);assert.equal(h.nodes.get('score').textContent,'23–26');
});

test('actual ratings, roster, replacement, score and prop flows share one scenario and refresh gates it',async()=>{
 const h=harness(new Map(),true);await h.settle();h.run(`choose(parseGame(${JSON.stringify(h.game)}))`);await h.settle();await h.settle();
 await h.nodes.get('build-player-ratings').onclick();await h.settle();
 const confirm=h.nodes.get('baseline-1:7'),replacement=h.nodes.get('replacement-1:7'),workload=h.nodes.get('workload-1:7');
 h.run('sim()');assert.equal(h.nodes.get('score').textContent,'23–26');
 h.run("document.dispatchEvent(new Event('unit501:team-context-updated'))");assert.equal(h.nodes.get('score').textContent,'23–26');
 assert.ok(confirm);replacement.value='9';replacement.onchange();workload.value='0';workload.onchange();confirm.checked=true;confirm.onchange();
 const scenario=JSON.parse(h.run('JSON.stringify(window.Unit501Lineups.evaluate())'));assert.equal(scenario.applied,true);assert.equal(scenario.props['1:9'].rushing.extraUsage,20);
 h.run('sim()');assert.equal(h.nodes.get('score').textContent,'21–26');
 h.run("document.dispatchEvent(new Event('unit501:team-context-updated'))");assert.equal(h.nodes.get('score').textContent,'21–26');
 await h.nodes.get('predict').dispatchEvent({type:'click'});await h.settle();
 await selectPlayer(h);
 assert.match(h.nodes.get('predict-results').textContent,/0.0 projected/);
 h.nodes.get('predict-player').value='1:9';await h.nodes.get('predict-player').dispatchEvent({type:'change'});
 assert.match(h.nodes.get('predict-results').textContent,/75.0 projected/);
 const propArchive=h.run('Unit501ForecastArchive.read(localStorage).snapshots.find(s=>s.kind==="prop"&&s.records[0].playerId==="9"&&s.records[0].market==="rushYds")');
 assert.equal(propArchive.records[0].baseline,15);assert.equal(propArchive.records[0].adjusted,75);assert.ok(propArchive.inputs.lineupInputs);
 // An unavailable replacement invalidates transferred output after a report refresh.
 h.context.injuryOut=true;
 h.run("Unit501Availability.snapshot().teams[0].injuries.rows=[{id:'9',teamId:'1',status:'Out',date:new Date().toISOString()}];document.dispatchEvent(new Event('unit501:availability-updated'))");await h.settle();
 assert.equal(h.run('window.Unit501Lineups.evaluate().applied'),false);h.run('sim()');assert.equal(h.nodes.get('score').textContent,'23–26');
 // A confirmed baseline starter newly reported out loses all normal workload,
 // even if the scenario dropdown previously remained at 100 percent.
 h.run("Unit501Availability.snapshot().teams[0].injuries.rows=[{id:'7',teamId:'1',status:'Out',date:new Date().toISOString()}]");workload.value='100';workload.onchange();
 assert.equal(confirm.checked,false);assert.equal(h.run('window.Unit501Lineups.evaluate().applied'),false);
 confirm.checked=true;confirm.onchange();
 assert.equal(h.run('window.Unit501Lineups.evaluate().props["1:7"].rushing.scale'),0);
 replacement.value='';replacement.onchange();assert.equal(confirm.checked,false);assert.equal(h.run('window.Unit501Lineups.evaluate().applied'),false);
 h.run("Unit501Availability.snapshot().teams[0].injuries.rows=[{id:'7',teamId:'1',status:'Sidelined',date:new Date().toISOString()}];document.dispatchEvent(new Event('unit501:availability-updated'))");
 h.nodes.get('predict-player').value='1:7';await h.nodes.get('predict-player').dispatchEvent({type:'change'});
 assert.match(h.nodes.get('predict-results').textContent,/Projection and line comparison withheld/);
 assert.ok(h.nodes.get('predict-player').children.some(option=>option.value==='1:7'&&/Projection withheld/.test(option.textContent)));
});

test('opponent yardage factor also applies to transferred replacement touches',async()=>{
 const h=harness(new Map(),true);h.data.teams[1].metrics.rushAgainst.average=50;
 await h.settle();h.run(`choose(parseGame(${JSON.stringify(h.game)}))`);await h.settle();await h.settle();
 await h.nodes.get('build-player-ratings').onclick();await h.settle();
 const replacement=h.nodes.get('replacement-1:7'),workload=h.nodes.get('workload-1:7'),confirm=h.nodes.get('baseline-1:7');
 replacement.value='9';replacement.onchange();workload.value='0';workload.onchange();confirm.checked=true;confirm.onchange();
 await h.nodes.get('predict').dispatchEvent({type:'click'});await h.settle();
 h.nodes.get('predict-player').value='1:9';await h.nodes.get('predict-player').dispatchEvent({type:'change'});
 assert.match(h.nodes.get('predict-results').textContent,/69.4 projected/);
});

test('replacement estimate UI names the candidate and applies only after review',async()=>{
 const h=harness(new Map(),true);h.context.injuryOut=true;
 const original=h.context.fetch;h.context.fetch=async url=>{const res=await original(url);if(String(url).startsWith('/api/availability')){const data=await res.json();data.teams[0].depth={available:true,checkedAt:Date.now(),gameId:String(h.game.game.id),kickoff:h.game.game.date.timestamp*1000,url:'https://example.com/depth',rows:[{id:'7',position:'RB',rank:1,slot:'RB:0'},{id:'9',position:'RB',rank:2,slot:'RB:0'}]};return {ok:true,json:async()=>data};}return res;};
 await h.settle();h.run(`choose(parseGame(${JSON.stringify(h.game)}))`);await h.settle();await h.settle();
 await h.nodes.get('build-player-ratings').onclick();await h.settle();
 assert.match(h.nodes.get('ratings-results').textContent,/ZZBackup: role estimated; workload estimated/);
 assert.match(h.nodes.get('ratings-results').textContent,/25.0 estimated carries/);
 const button=h.nodes.get('estimate-1:7');assert.ok(button);button.onclick();
 assert.equal(h.run('window.Unit501Lineups.evaluate().applied'),false);
 const confirm=h.nodes.get('baseline-1:7');confirm.checked=true;confirm.onchange();
 assert.equal(h.run('window.Unit501Lineups.evaluate().props["1:9"].rushing.extraUsage'),20);
 await h.run("Unit501Availability.snapshot().teams[0].depth.checkedAt=Date.now()-3600001;document.dispatchEvent(new Event('unit501:availability-updated'))");
 assert.equal(h.run('window.Unit501Lineups.evaluate().applied'),false);
 assert.match(h.nodes.get('lineup-status').textContent,/evidence changed or expired/);
});

test('forecast shows incomplete injury coverage and clears its coverage claim when reports refresh',async()=>{
 const h=harness();await h.settle();h.run(`choose(parseGame(${JSON.stringify(h.game)}))`);await h.settle();h.run('sim()');
 assert.match(h.nodes.get('availability-score-status').textContent,/coverage incomplete or expired/);
 await h.run("document.dispatchEvent(new Event('unit501:availability-updated'))");
 assert.equal(h.nodes.get('availability-score-status').textContent,'');
 assert.match(h.nodes.get('note').textContent,/Run the simulation again/);
 h.run("invalidateSimulation('Inputs changed')");assert.equal(h.nodes.get('availability-score-status').textContent,'');
});

test('simulation archives ordinary forecasts and keeps the first forecast across edits and reload',async()=>{
 const h=harness();await h.settle();h.run(`choose(parseGame(${JSON.stringify(h.game)}))`);await h.settle();
 h.run('$("autoInjuries").checked=false; $("venueMode").value="neutral"; injuryModeChanged()');h.run('sim()');assert.equal(h.run('Unit501ForecastArchive.read(localStorage).snapshots.length'),1);
 h.run('$("awayOffenseLoss").value="4"; sim()');
 const saved=h.run('Unit501ForecastArchive.read(localStorage).snapshots[0]');
 assert.equal(saved.baseline.away,24);assert.equal(saved.adjusted.away,24);assert.equal(saved.records[0].actual,null);
 assert.ok(saved.forecastAt<saved.game.kickoff);
 h.run('$("awayOffenseLoss").value="7"; sim()');
 assert.equal(h.run('Unit501ForecastArchive.read(localStorage).snapshots[0].adjusted.away'),24);
 const next=harness(h.storage);await next.settle();assert.equal(next.run('Unit501ForecastArchive.read(localStorage).snapshots.length'),1);
});

test('ordinary prop forecasts and chosen picks stay separate with exact line and price',async()=>{
 const h=harness();await h.settle();h.run(`choose(parseGame(${JSON.stringify(h.game)}))`);await h.settle();
 await h.nodes.get('predict').dispatchEvent({type:'click'});await h.settle();
 await selectPlayer(h);
 const archive=()=>h.run('Unit501ForecastArchive.read(localStorage).snapshots');
 assert.ok(archive().some(s=>s.kind==='prop'&&!s.selection&&s.records[0].market==='carries'));
 const input=h.nodes.get('line-1:7-carries');input.value='21.5';await input.dispatchEvent({type:'input'});
 h.nodes.get('pick-direction-1:7-carries').value='under';h.nodes.get('pick-price-1:7-carries').value='-136';
 await h.nodes.get('save-pick-1:7-carries').dispatchEvent({type:'click'});
 const pick=archive().find(s=>s.selection);assert.equal(pick.selection.line,21.5);assert.equal(pick.selection.price,-136);assert.equal(pick.selection.direction,'under');
 const firstCount=archive().length;
 input.value='30.5';await input.dispatchEvent({type:'input'});assert.equal(h.nodes.get('pick-price-1:7-carries').value,'');
 await h.nodes.get('save-pick-1:7-carries').dispatchEvent({type:'click'});
 assert.equal(archive().length,firstCount);assert.equal(archive().find(s=>s.selection).selection.line,21.5);
});

test('switching matchups clears scenarios and ignores late injury, rating, ranking, odds and prop responses',async()=>{
 const h=harness(new Map(),true);await h.settle();h.run(`choose(parseGame(${JSON.stringify(h.game)}))`);await h.settle();await h.settle();
 await h.nodes.get('build-player-ratings').onclick();await h.nodes.get('predict').dispatchEvent({type:'click'});await h.settle();
 await selectPlayer(h);
 const replacement=h.nodes.get('replacement-1:7'),workload=h.nodes.get('workload-1:7'),confirm=h.nodes.get('baseline-1:7');
 replacement.value='9';replacement.onchange();workload.value='0';workload.onchange();confirm.checked=true;confirm.onchange();
 assert.equal(h.run('Unit501Lineups.evaluate().applied'),true);
 const line=h.nodes.get('line-1:7-carries');line.value='21.5';await line.dispatchEvent({type:'input'});
 h.nodes.get('awayOffenseLoss').value='6';h.nodes.get('awayRating').value='9';
 const next=structuredClone(h.game);next.game.id=1000;next.game.date.timestamp+=3600;
 const original=h.context.fetch,releases=[];let hold=true;
 h.context.injuryOut=true;
 h.context.fetch=async url=>{
  const response=await original(url),body=await response.json(),u=new URL(url,'http://localhost');
  if(hold){await new Promise(resolve=>releases.push(resolve));}
  else if(u.pathname==='/api/rankings'){body.data={...body.data,before:next.game.date.timestamp*1000};}
  return {ok:true,json:async()=>body};
 };
 const injury=h.nodes.get('refresh-availability').onclick();
 const rating=h.nodes.get('build-player-ratings').onclick();
 const props=h.nodes.get('prop-feed-status');
 const odds=h.run('loadFanDuel()');h.run('loadTeamContext(selected)');
 const propButton=h.created.find(n=>n.tag==='button'&&n.textContent==='Refresh FanDuel props');
 const propRequest=propButton.dispatchEvent({type:'click'});
 await h.settle();assert.equal(releases.length,5);
 hold=false;h.context.injuryOut=false;h.run(`choose(parseGame(${JSON.stringify(next)}))`);await h.settle();await h.settle();
 assert.equal(h.run('Unit501Lineups.snapshot()'),null);assert.equal(h.run('Unit501Lineups.evaluate()'),null);
 assert.equal(h.nodes.get('predict-results').textContent,'');assert.equal(h.nodes.get('saved-line-comparisons').textContent,'');assert.equal(props.textContent,'');
 assert.equal(h.nodes.get('spread').value,'7.5');assert.equal(h.nodes.get('score').textContent,'—');
 assert.equal(h.nodes.get('awayOffenseLoss').value,''); // Automatic injury coverage is pending for the new matchup.assert.equal(h.nodes.get('awayRating').value,'0');
 const current=h.run('Unit501Availability.snapshot()');assert.equal(current.teams[0].injuries.rows.length,0);
 for(const release of releases)release();await Promise.all([injury,rating,odds,propRequest]);await h.settle();await h.settle();
 assert.equal(h.run('Unit501Availability.snapshot()'),current);assert.equal(h.run('scoringContext.game.id'),1000);
 assert.equal(h.nodes.get('ratings-results').textContent,'');assert.equal(h.nodes.get('build-player-ratings').disabled,undefined);
 assert.equal(h.nodes.get('predict-results').textContent,'');assert.equal(h.nodes.get('prop-feed-status').textContent,'');assert.equal(propButton.disabled,true);
});

test('player view shows quoted comparisons without the unpriced overview',async()=>{
 const h=harness();await h.settle();h.run(`choose(parseGame(${JSON.stringify(h.game)}))`);await h.settle();
 await h.nodes.get('predict').dispatchEvent({type:'click'});await h.settle();await h.settle();
 await selectPlayer(h);
 assert.equal(h.nodes.get('all-player-projections'),undefined);
 assert.match(h.nodes.get('saved-line-comparisons').textContent,/Our projections vs FanDuel/);
 assert.match(h.nodes.get('saved-line-comparisons').textContent,/19.5/);
 assert.equal(h.nodes.get('line-1:7-carries').value,'19.5');
});

test('an old player-stat load cannot repopulate projections after a matchup switch',async()=>{
 const h=harness();await h.settle();h.run(`choose(parseGame(${JSON.stringify(h.game)}))`);await h.settle();
 const original=h.context.fetch;let release;
 h.context.fetch=async url=>{const response=await original(url);if(String(url).startsWith('/api/player-stats'))await new Promise(resolve=>{release=resolve;});return response;};
 const pending=h.nodes.get('predict').dispatchEvent({type:'click'});await h.settle();assert.ok(release);
 const next=structuredClone(h.game);next.game.id=1000;h.run(`choose(parseGame(${JSON.stringify(next)}))`);await h.settle();
 release();await pending;await h.settle();
 assert.equal(h.nodes.get('predict-player').children.length,0);assert.equal(h.nodes.get('predict-results').textContent,'');
 assert.match(h.nodes.get('predict-status').textContent,/Tap Load Player Projections/);assert.equal(h.nodes.get('predict').disabled,false);
});

test('saved manual lines stay scoped to a game and return only when that exact game is reloaded',async()=>{
 const h=harness();await h.settle();
 const next=structuredClone(h.game);next.game.id=1000;next.game.date.timestamp+=3600;
 const original=h.context.fetch;
 h.context.fetch=async url=>{const u=new URL(url,'http://localhost');if(u.pathname==='/api/games')return {ok:true,json:async()=>({response:[h.game,next]})};return original(url);};
 h.run(`choose(parseGame(${JSON.stringify(h.game)}))`);await h.settle();await h.nodes.get('predict').dispatchEvent({type:'click'});await h.settle();
 await selectPlayer(h);
 const workload=h.nodes.get('player-workload-scenario');workload.value='50';workload.onchange();
 const line=h.nodes.get('line-1:7-carries');line.value='21.5';await line.dispatchEvent({type:'input'});
 h.run(`choose(parseGame(${JSON.stringify(next)}))`);await h.settle();await h.nodes.get('predict').dispatchEvent({type:'click'});await h.settle();
 await selectPlayer(h);
 assert.equal(h.nodes.get('line-1:7-carries').value,'19.5');
 assert.equal(h.nodes.get('player-workload-scenario').value,'100');
 assert.ok(![...h.storage].some(([k,v])=>k.includes(':1000:')&&JSON.parse(v).value==='21.5'));
 h.run(`choose(parseGame(${JSON.stringify(h.game)}))`);await h.settle();await h.nodes.get('predict').dispatchEvent({type:'click'});await h.settle();
 await selectPlayer(h);
 assert.equal(h.nodes.get('line-1:7-carries').value,'21.5');
});

test('open weather refresh skips hidden tabs, withdraws stale inputs and avoids overlapping requests',async()=>{
 const h=harness();await h.settle();h.game.game.venue.name='Soldier Field';
 let clock=Date.now(),calls=0,release,hold=false;
 h.context.Date=class extends Date{static now(){return clock;}};
 const original=h.context.fetch;
 h.context.fetch=async url=>{
  if(!String(url).startsWith('/api/weather'))return original(url);
  calls++;if(hold)await new Promise(resolve=>{release=resolve;});
  return {ok:true,json:async()=>({available:true,fetchedAt:clock,forecastTime:h.game.game.date.timestamp*1000,windMph:20,temperatureF:60,gustMph:25,precipitationChance:10})};
 };
 h.run(`choose(parseGame(${JSON.stringify(h.game)}))`);await h.settle();assert.equal(calls,1);
 h.run('sim()');assert.notEqual(h.nodes.get('score').textContent,'—');
 clock+=900001;h.context.document.hidden=true;
 h.timers.findLast(t=>t.active&&t.delay===60000).fn();assert.equal(calls,1);
 h.context.document.hidden=false;hold=true;
 await h.context.document.dispatchEvent({type:'visibilitychange'});await h.settle();assert.equal(calls,2);
 assert.equal(h.nodes.get('score').textContent,'—');assert.equal(h.run('forecastContext.data.available'),false);
 await h.context.document.dispatchEvent({type:'visibilitychange'});assert.equal(calls,2);
 release();await h.settle();assert.equal(h.run('forecastContext.data.available'),true);
 h.run('clearSelection()');assert.equal(h.run('weatherWatch'),null);
});

test('weather displays retractable and covered venues as context and skips fixed domes',async()=>{
 const h=harness();await h.settle();let calls=0;
 const original=h.context.fetch;
 h.context.fetch=async url=>String(url).startsWith('/api/weather')?(calls++,{ok:true,json:async()=>({available:true,fetchedAt:Date.now(),forecastTime:h.game.game.date.timestamp*1000,windMph:35})}):original(url);
 for(const name of ['AT&T Stadium','SoFi Stadium']) {
  h.game.game.venue.name=name;h.run(`choose(parseGame(${JSON.stringify(h.game)}))`);await h.settle();
  assert.equal(h.run('forecastContext.data.roof'),'unknown');
  assert.match(h.nodes.get('game-roof-status').textContent,/context only/);
  assert.equal(h.run('Unit501TeamModel.weatherEffect(selected,forecastContext.data).applied'),false);
 }
 assert.equal(calls,2);
 h.game.game.venue.name='Ford Field';h.run(`choose(parseGame(${JSON.stringify(h.game)}))`);await h.settle();
 assert.equal(calls,2);assert.equal(h.run('forecastContext.data.roof'),'indoor');assert.equal(h.run('weatherWatch'),null);
 h.game.game.venue.name='Tottenham Hotspur Stadium';h.run(`choose(parseGame(${JSON.stringify(h.game)}))`);await h.settle();
 assert.equal(calls,3);assert.equal(h.run('forecastContext.data.roof'),'outdoor');
 assert.equal(h.run('Unit501TeamModel.weatherEffect(selected,forecastContext.data).applied'),true);
});


test('prop board sorts largest raw discrepancy across stats or within a stat, with reset on game selection',async()=>{
 const h=harness();await h.settle();h.run(`choose(parseGame(${JSON.stringify(h.game)}))`);await h.settle();
 await h.nodes.get('predict').dispatchEvent({type:'click'});await h.settle();
 await selectPlayer(h);
 const markets=h.nodes.get('prop-filter-markets');markets.value='all';await markets.dispatchEvent({type:'change'});
 const input=h.nodes.get('line-1:7-carries');input.value='21.5';await input.dispatchEvent({type:'input'});
 const board=h.nodes.get('saved-line-comparisons');
 const walk=(node,tag)=>[...(node.tag===tag?[node]:[]),...node.children.filter(c=>typeof c!=='string').flatMap(c=>walk(c,tag))];
 const rows=()=>walk(board,'tbody')[0]?.children||[];
 const change=async(key,value)=>{const select=h.nodes.get('prop-filter-'+key);select.value=value;await select.dispatchEvent({type:'change'});};
 await selectPlayer(h,'');
 await change('direction','below');assert.equal(rows().length,1);assert.match(rows()[0].textContent,/1.5 below/);
 await change('direction','above');assert.equal(rows().length,2);assert.ok(rows().every(r=>r.textContent.includes('above')));
 await change('direction','');await change('sort','gap');assert.equal(rows().length,8);
 assert.equal(rows().filter(r=>r.textContent.includes('Line unavailable')).length,5);
 // Same market: the larger gap must lead even when that player loaded later.
 h.nodes.get('predict-player').value='2:8';await h.nodes.get('predict-player').dispatchEvent({type:'change'});
 const second=h.nodes.get('line-2:8-carries');second.value='25.5';await second.dispatchEvent({type:'input'});
 const receiving=h.nodes.get('line-1:7-recYds');receiving.value='6.5';await receiving.dispatchEvent({type:'input'});
 await selectPlayer(h,'');
 await change('stat','');
 await change('sort','gap');
 assert.equal(rows().length,8);
 assert.match(rows()[0].textContent,/Receiving yards/); // The +17.5 gap leads overall even though receiving follows rushing in stat order.
 assert.match(rows()[1].textContent,/RB 2/); // The -5.5 gap ranks second because raw distance is absolute.
 await change('sort','stat-gap');
 assert.match(rows()[0].textContent,/RB 2/); // Grouped sorting still begins with rushing attempts.
 const originalSupport=h.context.Unit501PlayerForm.dataSupport;
 h.context.Unit501PlayerForm.dataSupport=(model,availability)=>{
  const support=originalSupport(model,availability);
  // Simulate a clean rushing sample and a flagged receiving sample to verify priority.
  return {...support,needsReview:model.average!==20};
 };
 await change('sort','reviewed-gap');
 assert.match(rows()[0].textContent,/RB 2/);
 assert.match(rows()[0].textContent,/Rushing attempts/);
 assert.match(rows()[2].textContent,/Receiving yards/); // Larger flagged gap follows both clean rushing lines.
 await change('stat','carries');assert.equal(rows().length,2);assert.match(rows()[0].textContent,/RB 2/);
 await change('review','workload');assert.equal(rows().length,0);assert.match(board.textContent,/Reset the filters/);
 const next={...h.game,game:{...h.game.game,id:1000}};
 const original=h.context.fetch;
 h.context.fetch=async url=>{if(new URL(url,'http://localhost').pathname==='/api/games')return {ok:true,json:async()=>({response:[h.game,next]})};return original(url);};
 h.run(`choose(parseGame(${JSON.stringify(next)}))`);await h.settle();
 await h.nodes.get('predict').dispatchEvent({type:'click'});await h.settle();
 assert.equal(h.nodes.get('prop-filter-sort').value,'');assert.equal(h.nodes.get('prop-filter-review').value,'');assert.equal(h.nodes.get('prop-filter-stat').value,'');
});


test('copy prop board respects filters, rechecks stale quotes and offers clipboard fallback',async()=>{
 const h=harness();await h.settle();h.run(`choose(parseGame(${JSON.stringify(h.game)}))`);await h.settle();
 await h.nodes.get('predict').dispatchEvent({type:'click'});await h.settle();
 const markets=h.nodes.get('prop-filter-markets');markets.value='all';await markets.dispatchEvent({type:'change'});
 const filter=h.nodes.get('prop-filter-stat');filter.value='carries';await filter.dispatchEvent({type:'change'});
 let copied='';h.context.navigator={clipboard:{writeText:async text=>{copied=text;}}};
 await h.nodes.get('copy-prop-board').dispatchEvent({type:'click'});
 assert.match(copied,/RB 1 — Team A/);assert.match(copied,/Line 19.5/);assert.match(copied,/FanDuel automatic/);assert.match(copied,/Verify participation/);assert.match(copied,/Carries: 20, 20/);assert.doesNotMatch(h.nodes.get('saved-line-comparisons').textContent,/Carries: 20, 20/);assert.doesNotMatch(copied,/Line 22.5/);
 assert.match(h.nodes.get('copy-prop-board-status').textContent,/copied/);
 h.context.navigator.clipboard.writeText=async()=>{throw Error('Denied');};
 await h.nodes.get('copy-prop-board').dispatchEvent({type:'click'});
 assert.match(h.nodes.get('prop-board-copy-text').value,/Line 19.5/);
 assert.match(h.nodes.get('copy-prop-board-status').textContent,/Select and copy/);
 const future=Date.now()+1800001;h.context.Date=class extends Date{static now(){return future;}};
 copied='';h.context.navigator.clipboard.writeText=async text=>{copied=text;};
 await h.nodes.get('copy-prop-board').dispatchEvent({type:'click'});
 assert.match(copied,/Line unavailable/);assert.doesNotMatch(copied,/Line 19.5/);assert.match(copied,/Above\/below\/equal: Line required/);assert.match(h.nodes.get('copy-prop-board-status').textContent,/copied/);
});

test('shortlist preserves chosen markets through filters, copies current rows and resets for another matchup',async()=>{
 const h=harness();await h.settle();h.run(`choose(parseGame(${JSON.stringify(h.game)}))`);await h.settle();
 await h.nodes.get('predict').dispatchEvent({type:'click'});await h.settle();
 const markets=h.nodes.get('prop-filter-markets');markets.value='all';await markets.dispatchEvent({type:'change'});
 assert.equal(h.nodes.has('shortlist-1:7-carries'),false);
 await selectPlayer(h,'1:7');
 const select=h.nodes.get('shortlist-1:7-carries');assert.ok(select);
 select.checked=true;await select.dispatchEvent({type:'change'});
 const change=async(key,value)=>{const node=h.nodes.get('prop-filter-'+key);node.value=value;await node.dispatchEvent({type:'change'});};
 await change('shortlist','selected');
 let copied='';h.context.navigator={clipboard:{writeText:async text=>{copied=text;}}};
 await h.nodes.get('copy-prop-board').dispatchEvent({type:'click'});
 assert.match(copied,/my filtered prop shortlist/);
 assert.match(copied,/RB 1 — Team A/);
 assert.match(copied,/Rushing attempts/);
 assert.doesNotMatch(copied,/Receiving yards/);
 await selectPlayer(h,'');
 await change('direction','below');
 assert.equal(h.nodes.get('copy-prop-board').disabled,true);
 await change('direction','');
 assert.equal(h.nodes.get('shortlist-1:7-carries').checked,true);
 // Older automatic quotes are not copied, even if previously shortlisted.
 const future=Date.now()+1800001;h.context.Date=class extends Date{static now(){return future;}};
 copied='';await h.nodes.get('copy-prop-board').dispatchEvent({type:'click'});
 assert.match(copied,/Line unavailable/);assert.doesNotMatch(copied,/Line 19.5/);assert.match(copied,/Above\/below\/equal: Line required/);assert.match(h.nodes.get('copy-prop-board-status').textContent,/copied/);
 // Clear and game changes do not retain selection from the previous matchup.
 await h.nodes.get('clear-prop-shortlist').dispatchEvent({type:'click'});
 assert.match(h.nodes.get('saved-line-comparisons').textContent,/0 shortlisted/);
 const next={...h.game,game:{...h.game.game,id:1000}};
 const original=h.context.fetch;
 h.context.fetch=async url=>{if(new URL(url,'http://localhost').pathname==='/api/games')return {ok:true,json:async()=>({response:[h.game,next]})};return original(url);};
 h.run(`choose(parseGame(${JSON.stringify(next)}))`);await h.settle();
 await h.nodes.get('predict').dispatchEvent({type:'click'});await h.settle();
 assert.equal(h.nodes.get('prop-filter-shortlist').value,'');
 assert.match(h.nodes.get('saved-line-comparisons').textContent,/0 shortlisted/);
});

test('matchup review exposes unmatched official injury names without inventing roster identities',async()=>{
 const h=harness(new Map(),true);await h.settle();
 const original=h.context.fetch;
 h.context.fetch=async url=>{
  const response=await original(url);
  if(!String(url).startsWith('/api/availability'))return response;
  const data=await response.json();
  data.teams[0].official={available:true,checkedAt:Date.now(),week:6,rows:[],unmatched:1,url:'https://www.nfl.com/injuries',unresolved:[{name:'Unmatched Runner',position:'RB',status:'Out',description:'Knee',practice:'Limited'}]};
  return {ok:true,json:async()=>data};
 };
 h.run(`choose(parseGame(${JSON.stringify(h.game)}))`);await h.settle();await h.settle();
 const panel=h.created.find(n=>n.tag==='section'&&n.textContent.includes('Unmatched official reports'));
 assert.ok(panel);assert.match(panel.textContent,/Unmatched Runner \(RB\) — Out; Knee; Limited/);
 const report=h.context.Unit501Availability.snapshot().teams[0].official;
 assert.equal(report.rows.length,0);assert.equal(report.unresolved[0].id,undefined);
});

test('failed FanDuel props refresh keeps fresh automatic quotes and table lines',async()=>{
 const h=harness();await h.settle();
 h.run(`choose(parseGame(${JSON.stringify(h.game)}))`);await h.settle();
 await h.nodes.get('predict').dispatchEvent({type:'click'});await h.settle();await h.settle();
 await selectPlayer(h);
 assert.equal(h.nodes.get('line-1:7-carries').value,'19.5');
 assert.match(h.nodes.get('saved-line-comparisons').textContent,/19.5/);
 const original=h.context.fetch;
 h.context.fetch=async url=>new URL(url,'http://localhost').pathname==='/api/football/player-lines'
   ? {ok:false,status:500,json:async()=>({error:'FanDuel prop feed returned 401 (INVALID_KEY). Check ODDS_API_KEY.'})}
   : original(url);
 const refresh=h.created.find(node=>node.tag==='button'&&node.textContent==='Refresh FanDuel props');
 await refresh.dispatchEvent({type:'click'});await h.settle();
 assert.equal(h.nodes.get('line-1:7-carries').value,'19.5');
 assert.match(h.nodes.get('saved-line-comparisons').textContent,/19.5/);
 assert.match(h.nodes.get('saved-line-comparisons').textContent,/FanDuel/);
 assert.match(h.nodes.get('prop-feed-status').textContent,/401 \(INVALID_KEY\)/);
 assert.match(h.nodes.get('prop-feed-status').textContent,/Existing fresh quotes were kept/);
});
test('prop board omits price clutter while manual line edits still clear pick prices',async()=>{
 const h=harness();await h.settle();
 const original=h.context.fetch;
 h.context.fetch=async url=>{
  const response=await original(url);
  if(new URL(url,'http://localhost').pathname!=='/api/football/player-lines')return response;
  const data=await response.json();
  data.props=data.props.map(p=>({...p,over:p.stat==='rec'?99:-136,under:p.stat==='rec'?null:120}));
  return {ok:true,json:async()=>data};
 };
 h.run(`choose(parseGame(${JSON.stringify(h.game)}))`);await h.settle();
 await h.nodes.get('predict').dispatchEvent({type:'click'});await h.settle();
 let copied='';h.context.navigator={clipboard:{writeText:async text=>{copied=text;}}};
 await h.nodes.get('copy-prop-board').dispatchEvent({type:'click'});
 assert.doesNotMatch(copied,/break-even|price unavailable|over -136/);
 assert.doesNotMatch(h.nodes.get('saved-line-comparisons').textContent,/Prices|break-even/);
 h.nodes.get('predict-player').value='1:7';await h.nodes.get('predict-player').dispatchEvent({type:'change'});
 const input=h.nodes.get('line-1:7-carries');input.value='20.5';await input.dispatchEvent({type:'input'});
 const filter=h.nodes.get('prop-filter-stat');filter.value='carries';await filter.dispatchEvent({type:'change'});
 await h.nodes.get('copy-prop-board').dispatchEvent({type:'click'});
 assert.match(copied,/Line 20\.5/);
 assert.equal(h.nodes.get('pick-price-1:7-carries').value,'');
 assert.doesNotMatch(copied,/57\.6% break-even/);
});

test('data-support display and filters keep thin samples visible without claiming a betting probability',async()=>{
  const h=harness();await h.settle();
  h.run(`choose(parseGame(${JSON.stringify(h.game)}))`);await h.settle();
  await h.nodes.get('predict').dispatchEvent({type:'click'});await h.settle();
 const markets=h.nodes.get('prop-filter-markets');markets.value='all';await markets.dispatchEvent({type:'change'});
  const board=h.nodes.get('saved-line-comparisons');
  assert.match(board.textContent,/Data support/);
  assert.match(board.textContent,/Thin sample/);
  let copied='';
  h.context.navigator={clipboard:{writeText:async text=>{copied=text;}}};
  await h.nodes.get('copy-prop-board').dispatchEvent({type:'click'});
  assert.match(copied,/Data support: Thin sample/);
  const filter=h.nodes.get('prop-filter-support');
  assert.ok(filter);
  filter.value='thin';await filter.dispatchEvent({type:'change'});
  assert.equal(h.nodes.get('copy-prop-board').disabled,false);
  const currentFilter=h.nodes.get('prop-filter-support');
  currentFilter.value='clean';await currentFilter.dispatchEvent({type:'change'});
  assert.equal(h.nodes.get('copy-prop-board').disabled,true);
  assert.match(board.textContent,/No projections match these filters/);
});

test('Game Lab automatically scores a confirmed defender absence and cleanly switches back to manual',async()=>{
 const h=harness();await h.settle();h.run(`choose(parseGame(${JSON.stringify(h.game)}))`);await h.settle();
 const game=h.run('selected'),now=Date.now();
 const team=(id)=>({id,
   roster:{available:true,checkedAt:now,rows:id==='2'?[{id:'18',name:'Starting CB',position:'CB'}]:[]},
   injuries:{available:true,checkedAt:now,rows:[]},
   depth:{available:true,checkedAt:now,gameId:game.id,kickoff:game.kickoff,rows:id==='2'?[{id:'18',position:'CB',rank:1,slot:'CB:0'}]:[]},
   official:{available:true,checkedAt:now,league:'1',season:'2026',gameId:game.id,kickoff:game.kickoff,
     rows:id==='2'?[{id:'18',teamId:'2',name:'Starting CB',status:'Out'}]:[]}
 });
 const data={current:true,teams:[team('1'),team('2')]};
 h.context.Unit501Availability={snapshot:()=>data};
 const box=h.nodes.get('autoInjuries');box.checked=true;await box.dispatchEvent({type:'change'});
 assert.equal(h.nodes.get('homeDefenseLoss').disabled,true);
 h.run('sim()');
 assert.equal(h.nodes.get('homeDefenseLoss').value,'0.5');
 assert.match(h.nodes.get('auto-injury-status').textContent,/Starting CB.*OUT — factored in/);
 h.run("invalidateSimulation('Changed')");
 assert.match(h.nodes.get('auto-injury-status').textContent,/ready for next simulation/);
 h.run('sim()');
 assert.match(h.nodes.get('simulation-report-text').textContent,/Automatic experimental injury scenario/);
 assert.equal(h.run('latestForecast.inputs.options.injury.homeDefense'),0.5);
 box.checked=false;await box.dispatchEvent({type:'change'});
 assert.equal(h.nodes.get('homeDefenseLoss').disabled,false);
 assert.equal(h.nodes.get('homeDefenseLoss').value,'0');
 h.run('sim()');
 assert.equal(h.run('latestForecast.inputs.options.injury.homeDefense'),0);
 assert.doesNotMatch(h.nodes.get('simulation-report-text').textContent,/Automatic experimental injury scenario/);
});

test('missing auto-injury feed coverage leaves baseline visible but does not freeze an incomplete archived forecast',async()=>{
 const h=harness();await h.settle();h.run(`choose(parseGame(${JSON.stringify(h.game)}))`);await h.settle();
 h.nodes.get('autoInjuries').checked=true;
 await h.nodes.get('autoInjuries').dispatchEvent({type:'change'});
 h.run('sim()');
 assert.notEqual(h.nodes.get('score').textContent,'—');
 assert.equal(h.run('latestForecast'),null);
 assert.match(h.nodes.get('auto-injury-status').textContent,/unavailable|not loaded|incomplete/i);
});

test('Game Lab uses server history across devices rather than browser-local history',async()=>{
 const h=harness();await h.settle();h.run(`choose(parseGame(${JSON.stringify(h.game)}))`);await h.settle();
 const scope=h.run('selected'),key='unit501:observed-fanduel:v1:'+scope.league+':'+scope.season+':'+scope.id+':game:total';
 assert.equal(h.storage.has(key),false);
 const old=h.context.fetch;
 const at=Date.now()+10;
 h.context.fetch=async url=>String(url).startsWith('/api/fanduel')?
   {ok:true,json:async()=>({available:true,awaySpread:7.5,total:47.5,spreadUpdated:at,totalUpdated:at,history:{total:{scope:'server',persisted:true,firstLine:48.5,firstAt:at-60000,line:47.5,lastAt:at,delta:-1,changed:true,observations:2,changes:1}}})}:old(url);
 const btn=h.created.find(x=>x.textContent==='Refresh FanDuel lines');
 await btn.dispatchEvent({type:'click'});await h.settle();
 assert.equal(h.storage.has(key),false);
 const line=h.created.find(x=>x.tag==='p'&&x.textContent.includes('since first observed'));
 assert.ok(line);assert.match(line.textContent,/since first observed 48.5/);
});
test('automatic research queue omits thin samples and never casts board votes',async()=>{
 const h=harness();await h.settle();h.run(`choose(parseGame(${JSON.stringify(h.game)}))`);await h.settle();
 await h.nodes.get('predict').dispatchEvent({type:'click'});await h.settle();
 const markets=h.nodes.get('prop-filter-markets');markets.value='all';await markets.dispatchEvent({type:'change'});
 const choice=h.nodes.get('prop-filter-shortlist');
 choice.value='automatic';await choice.dispatchEvent({type:'change'});
 assert.match(h.nodes.get('saved-line-comparisons').textContent,/Automatic research queue only/);
 assert.match(h.nodes.get('saved-line-comparisons').textContent,/No projections match these filters/);
 assert.equal(h.nodes.get('war-stats')?.textContent||'', '');
});
test('auto prep waits for complete official injury coverage instead of freezing early forecasts',async()=>{
 const h=harness(new Map(),true);await h.settle();
 h.nodes.get('auto-prep-enabled').checked=true; // The minimal DOM harness does not parse checked attributes.
 h.nodes.get('autoInjuries').checked=true; // Real browser honors the checked attribute.
 h.run(`choose(parseGame(${JSON.stringify(h.game)}))`);await h.settle();await h.settle();
 await h.nodes.get('auto-prep-now').dispatchEvent({type:'click'});await h.settle();
 assert.match(h.nodes.get('auto-prep-status').textContent,/waiting for fresh, matching NFL/);
 assert.equal(h.nodes.get('score').textContent,'—');
});

test('player ratings automatically summarize reported missing starters without approving guesses',async()=>{
 const h=harness(new Map(),true);h.context.injuryOut=true;
 await h.settle();h.run(`choose(parseGame(${JSON.stringify(h.game)}))`);await h.settle();await h.settle();
 await h.nodes.get('build-player-ratings').onclick();await h.settle();
 const review=h.nodes.get('automatic-replacement-review');
 assert.ok(review);assert.match(review.textContent,/RB 1 \(RB\)/);
 assert.match(review.textContent,/Replacement: unknown/);
 assert.match(review.textContent,/nothing is applied/i);
 assert.equal(h.run('window.Unit501Lineups.evaluate().applied'),false);
});

test('college selection enables college injury scoring and preserves NFL defaults on return',async()=>{
 const h=harness(new Map(),true);await h.settle();
 h.nodes.get('league').value='2';
 h.run(`choose(parseGame(${JSON.stringify(h.game)}))`);await h.settle();
 assert.equal(h.nodes.get('autoInjuries').checked,true);
 assert.equal(h.nodes.get('homeDefenseLoss').disabled,true);
 await h.nodes.get('auto-prep-now').dispatchEvent({type:'click'});await h.settle();
 assert.doesNotMatch(h.nodes.get('auto-prep-status').textContent,/matching NFL roster/);
 h.nodes.get('league').value='1';
 h.run(`choose(parseGame(${JSON.stringify(h.game)}))`);await h.settle();
 assert.equal(h.nodes.get('autoInjuries').checked,true);
 assert.equal(h.nodes.get('homeDefenseLoss').disabled,true);
});


test('injury report download exports the selected report without another API request',async()=>{
 const h=harness(new Map(),true);await h.settle();h.run(`choose(parseGame(${JSON.stringify(h.game)}))`);await h.settle();await h.settle();
 let captured,downloaded=false;
 h.context.Blob=Blob;h.context.URL={createObjectURL(blob){captured=blob;return 'blob:report';},revokeObjectURL(){}};
 h.context.document.body={append(){}};
 const create=h.context.document.createElement;
 h.context.document.createElement=tag=>{const n=create(tag);if(tag==='a'){n.click=()=>{downloaded=n.download==='unit501-injuries-999.json';};n.remove=()=>{};}return n;};
 const button=h.nodes.get('download-injury-report');assert.ok(button);assert.equal(button.disabled,false);
 button.onclick();assert.equal(downloaded,true);
 const payload=JSON.parse(await captured.text());assert.equal(String(payload.game.id),'999');assert.equal(payload.availability.current,true);
 assert.equal(payload.availability.teams[0].roster.rows[0].id,'7');
});

test('prop history uses numeric game counts and manual enhance can be switched on and off',async()=>{
 const h=harness();await h.settle();
 h.run(`choose(parseGame(${JSON.stringify(h.game)}))`);await h.settle();
 await h.nodes.get('predict').dispatchEvent({type:'click'});await h.settle();
 const walk=n=>[n,...(n.children||[]).filter(c=>typeof c==='object').flatMap(walk)];
 const board=walk(h.nodes.get('saved-line-comparisons'));
 const table=board.find(n=>n.tag==='table');
 const rows=walk(table).filter(n=>n.tag==='tr').slice(1);
 assert.ok(rows.length>0);
 assert.ok(rows.every(r=>r.children.length===8&&/^\d+$/.test(r.children[2].textContent)));
 const history=board.filter(n=>n.className==='hit-rates');
 assert.ok(history.length>0);
 assert.ok(history.every(n=>n.children.length===2));
 assert.match(history[0].children[0].textContent,/Above\d+[\d.]+%/);
 h.nodes.get('predict-player').value='1:7';await h.nodes.get('predict-player').dispatchEvent({type:'change'});
 const values=()=>walk(h.nodes.get('predict-results')).find(n=>n.className==='scenario-comparison').children.map(n=>Number(n.children[1].textContent));
 const baseline=values();assert.equal(baseline[0],baseline[1]);
 let toggle=h.nodes.get('scenario-boost');assert.equal(toggle.checked,false);
 toggle.checked=true;await toggle.dispatchEvent({type:'change'});
 const boosted=values();assert.equal(boosted[0],baseline[0]);assert.equal(boosted[1],Number((baseline[0]*1.1).toFixed(1)));
 toggle=h.nodes.get('scenario-boost');toggle.checked=false;await toggle.dispatchEvent({type:'change'});
 assert.deepEqual(values(),baseline);
});

test('manual game mode invalidates results, reaches simulation, and resets for a matchup',async()=>{
 const h=harness();await h.settle();h.run(`choose(parseGame(${JSON.stringify(h.game)}))`);await h.settle();
 assert.equal(h.nodes.get('gameMode').value,'normal');h.run('sim()');
 h.nodes.get('gameMode').value='upset';await h.nodes.get('gameMode').dispatchEvent({type:'change'});
 assert.equal(h.nodes.get('score').textContent,'—');h.run('sim()');
 assert.match(h.nodes.get('simulation-report-text').textContent,/Manual upset: projected margin ×0.9/);
 h.nodes.get('gameMode').value='primetime';await h.nodes.get('gameMode').dispatchEvent({type:'change'});h.run('sim()');
 assert.match(h.nodes.get('simulation-report-text').textContent,/Manual primetime: projected margin ×1.1/);
 h.run(`choose(parseGame(${JSON.stringify(h.game)}))`);await h.settle();
 assert.equal(h.nodes.get('gameMode').value,'normal');
});

test('Game Lab removes tracking controls and result polling while simulations still complete',async()=>{
 const h=harness();await h.settle();
 for(const id of ['game-pick-direction','game-pick-price','save-game-pick','forecast-review','forecast-review-results','refresh-forecast-results','download-forecast-archive','import-forecast-archive','forecast-archive-status'])assert.equal(h.nodes.has(id),false,id);
 h.run(`choose(parseGame(${JSON.stringify(h.game)}))`);await h.settle();
 h.run('sim()');assert.notEqual(h.nodes.get('score').textContent,'—');
 assert.equal(h.timers.some(t=>String(t.fn).includes('checkForecastResults')),false);
});
test('Above/Below control ranks visible props by the selected historical percentage',async()=>{
 const h=harness();await h.settle();h.run(`choose(parseGame(${JSON.stringify(h.game)}))`);await h.settle();
 await h.nodes.get('predict').dispatchEvent({type:'click'});await h.settle();
 const check=async(side,expected)=>{
  const sort=h.nodes.get('prop-filter-sort');sort.value=expected;await sort.dispatchEvent({type:'change'});
  assert.equal(h.nodes.get('prop-filter-sort').value,expected);
  let copied='';h.context.navigator={clipboard:{writeText:async text=>{copied=text;}}};
  await h.nodes.get('copy-prop-board').dispatchEvent({type:'click'});
  const counts=[...copied.matchAll(/Above\/below\/equal: (\d+) \/ (\d+) \/ (\d+)/g)].map(m=>Number(m[side==='above'?1:2]));
  assert.ok(counts.length>1);
  const sign=expected.endsWith('desc')?-1:1;
  assert.deepEqual(counts,[...counts].sort((a,b)=>sign*(a-b)));
 };
 await check('above','above-desc');
 await check('below','below-desc');
});


test('selected-player controls precede comparisons and role reviews highlight every affected prop',async()=>{
 const h=harness();await h.settle();h.run(`choose(parseGame(${JSON.stringify(h.game)}))`);await h.settle();
 await h.nodes.get('predict').dispatchEvent({type:'click'});await h.settle();
 await selectPlayer(h);
 const controls=h.nodes.get('player-scenario-controls');
 assert.equal(controls.hidden,false);assert.match(controls.textContent,/Player controls.*RB 1/);
 assert.equal(h.nodes.get('player-power-controls').parentNode,h.nodes.get('scenario-picker'));
 assert.equal(h.nodes.get('scenario-boost').checked,false);
 const role=h.nodes.get('player-role-review');role.value='primary';await role.dispatchEvent({type:'change'});
 assert.match(h.nodes.get('saved-line-comparisons').textContent,/Primary option.*Your role review/);
 assert.doesNotMatch(h.nodes.get('saved-line-comparisons').textContent,/WHY HIGHLIGHTED/);
 const find=(n,c)=>[...(n.children||[])].flatMap(x=>typeof x==='string'?[]:[...(x.className===c?[x]:[]),...find(x,c)]);
 assert.ok(find(h.nodes.get('saved-line-comparisons'),'prop-role-alert').length>0);
 h.nodes.get('player-role-review').value='';await h.nodes.get('player-role-review').dispatchEvent({type:'change'});
 assert.doesNotMatch(h.nodes.get('saved-line-comparisons').textContent,/Your role review/);
 h.run(`choose(parseGame(${JSON.stringify(h.game)}))`);await h.settle();assert.equal(controls.hidden,true);
});


test('prop board automatically highlights a current same-position replacement opportunity',async()=>{
 const h=harness();await h.settle();h.run(`choose(parseGame(${JSON.stringify(h.game)}))`);await h.settle();
 await h.nodes.get('predict').dispatchEvent({type:'click'});await h.settle();
 assert.doesNotMatch(h.nodes.get('saved-line-comparisons').textContent,/Expanded role opportunity/);
 const game=h.run('selected'),now=Date.now();
 const data={current:true,teams:[{id:'1',roster:{available:true,checkedAt:now,rows:[{id:'7',position:'RB'}]},
 official:{available:true,gameId:game.id,kickoff:game.kickoff,checkedAt:now,rows:[{id:'9',teamId:'1',name:'Regular contributor',position:'RB',status:'Out'}]},
 injuryUsage:{available:true,gameId:game.id,kickoff:game.kickoff,checkedAt:now,league:game.league,season:game.season,rows:[{id:'9',position:'RB',role:'recent regular contributor'}]}}]};
 h.context.Unit501Availability={snapshot:()=>data,assess:()=>({blocked:false,state:'available'}),describe:()=> 'Available'};
 await h.context.document.dispatchEvent({type:'unit501:availability-updated'});
 assert.match(h.nodes.get('saved-line-comparisons').textContent,/Expanded role opportunity.*Regular contributor ruled out/);
 assert.doesNotMatch(h.nodes.get('saved-line-comparisons').textContent,/WHY HIGHLIGHTED/);
 const find=(n,c)=>[...(n.children||[])].flatMap(x=>typeof x==='string'?[]:[...(x.className===c?[x]:[]),...find(x,c)]);
 assert.ok(find(h.nodes.get('saved-line-comparisons'),'prop-role-alert').length>0);
});

test('Game Lab names outright upset picks, separates cover-only, and clears stale picks',async()=>{
 const h=harness();await h.settle();
 h.run(`choose(parseGame(${JSON.stringify(h.game)}))`);await h.settle();
 h.run('$("venueMode").value="neutral"; $("spread").value="10.5"; $("total").value="48.5"; $("awayRating").value="4"; $("homeRating").value="0"; sim()');
 assert.match(h.nodes.get('outright-pick').textContent,/UPSET ALERT.*Team A to win outright.*UNDERDOG UPSET PICK/);
 assert.equal(h.nodes.get('outright-pick').classList.contains('automatic-upset-pick'),true);
 assert.match(h.nodes.get('underdog-outlook').textContent,/Team A \+10.5: meets the upset review threshold/);
 assert.match(h.nodes.get('win-both').textContent,/Team A win.*Team B win.*tied scores/);
 h.run('$("awayRating").value="-4"; sim()');
 assert.match(h.nodes.get('outright-pick').textContent,/Team B to win outright/);
 assert.doesNotMatch(h.nodes.get('outright-pick').textContent,/UPSET PICK/);
 assert.equal(h.nodes.get('outright-pick').classList.contains('automatic-upset-pick'),false);
 assert.match(h.nodes.get('underdog-outlook').textContent,/cover, but lose outright/);
 h.run('$("spread").value="-10.5"; sim()');
 assert.match(h.nodes.get('outright-pick').textContent,/Team B to win outright.*UNDERDOG UPSET PICK/);
 h.run('$("awayRating").value="0"; sim()');
 assert.match(h.nodes.get('outright-pick').textContent,/no outright winner/);
 h.run('$("spread").value="0"; sim()');
 assert.match(h.nodes.get('underdog-outlook').textContent,/Pick’em line/);
 await h.nodes.get('spread').dispatchEvent({type:'input'});
 for(const id of ['outright-pick','underdog-outlook','win-both'])assert.equal(h.nodes.get(id).textContent,'—');
});

test('refreshing league rankings withdraws old Game Lab ranks when the source fails',async()=>{
 const h=harness();await h.settle();await h.settle();
 h.run(`choose(parseGame(${JSON.stringify(h.game)}))`);await h.settle();
 assert.match(h.nodes.get('league-pulse-matchup').textContent,/#1 of 32/);
 const request=h.context.fetch;
 h.context.fetch=async url=>{
  if(String(url).startsWith('/api/league-pulse'))throw Error('Provider unavailable');
  return request(url);
 };
 h.run('Unit501LeaguePulse.show("nfl")');await h.settle();
 assert.doesNotMatch(h.nodes.get('league-pulse-matchup').textContent,/#1 of 32/);
 assert.match(h.nodes.get('league-pulse-matchup').textContent,/when the current standings are verified/);
 assert.match(h.nodes.get('league-pulse-status').textContent,/could not load/);
});

test('expanded-role scenarios adjust only the selected player and reset on a new matchup',async()=>{
 const h=harness(new Map(),true);await h.settle();
 h.run(`choose(parseGame(${JSON.stringify(h.game)}))`);await h.settle();
 await h.nodes.get('predict').dispatchEvent({type:'click'});await h.settle();await h.settle();
 await selectPlayer(h);
 const control=h.nodes.get('player-workload-scenario');
 assert.deepEqual(control.children.map(c=>c.value),['100','125','150','200','75','50','25','0']);
 const walk=root=>[root,...root.children.flatMap(c=>typeof c==='object'?walk(c):[])];
 const table=()=>walk(h.nodes.get('saved-line-comparisons')).filter(n=>n.tag==='tr');
 const rows=()=>table().filter(n=>n.textContent.includes('Rushing attempts')&&n.textContent.includes('RB 1'));
 assert.equal(rows().length,1);
 const baseline=rows()[0].children[4].textContent;
 const selected=h.nodes.get('predict-player').value;
 control.value='150';control.onchange();
 assert.match(rows()[0].textContent,/150% workload/);
 const adjusted=rows()[0].children[4].textContent;
 assert.equal(Number.parseFloat(adjusted),Number.parseFloat(baseline)*1.5);
 assert.match(h.nodes.get('player-scenario-controls').textContent,/manual assumptions/);
 // Selecting a teammate keeps that teammate at the recorded baseline.
 const other=h.nodes.get('predict-player').children.find(c=>c.value&&c.value!==selected);
 assert.ok(other);h.nodes.get('predict-player').value=other.value;
 await h.nodes.get('predict-player').dispatchEvent({type:'change'});
 assert.equal(h.nodes.get('player-workload-scenario').value,'100');
 h.nodes.get('predict-player').value=selected;
 await h.nodes.get('predict-player').dispatchEvent({type:'change'});
 assert.equal(h.nodes.get('player-workload-scenario').value,'150');
 h.game.game.id=1000; // The fixture slate must also include the newly selected game.
 h.run(`choose(parseGame(${JSON.stringify(h.game)}))`);await h.settle();
 assert.equal(h.nodes.get('player-scenario-controls').hidden,true);
 await h.nodes.get('predict').dispatchEvent({type:'click'});await h.settle();
 await selectPlayer(h);
 assert.equal(h.nodes.get('player-workload-scenario').value,'100');
});

test('college board opens Top 25, collapses the remaining FBS tiers and retains every Game Lab rank',async()=>{
 const h=harness();await h.settle();await h.settle();
 await h.run('Unit501LeaguePulse.show("ncaaf")');
 const board=h.nodes.get('league-pulse-power');
 const groups=board.children.filter(n=>n.className==='league-pulse-group');
 assert.equal(groups.length,3);
 assert.deepEqual(groups.map(n=>n.open),[true,false,false]);
 assert.deepEqual(groups.map(n=>n.children[1].children.length),[25,25,88]);
 assert.deepEqual(groups.map(n=>n.children[1].start),[1,26,51]);
 assert.match(groups[0].textContent,/Top 25 · Unadjusted FBS Results/);
 assert.match(groups[1].textContent,/26–50 · Next Tier/);
 assert.match(groups[2].textContent,/51–138 · Rest of FBS/);
 assert.doesNotMatch(board.textContent,/Bottom Feeders|Top 10/);
 const g=structuredClone(h.game);g.league.id=2;g.teams.away={id:138,name:'League Team 138'};
 h.run(`$("league").value="2"; choose(parseGame(${JSON.stringify(g)}))`);await h.settle();
 assert.match(h.nodes.get('league-pulse-matchup').textContent,/#138 of 138/);
});

test('college rankings explain verified schedule strength and explicitly label unadjusted fallback',async()=>{
 const h=harness();await h.settle();await h.settle();
 const request=h.context.fetch;let adjusted=true;
 h.context.fetch=async url=>{
  const response=await request(url);
  if(!String(url).startsWith('/api/league-pulse'))return response;
  const data=await response.json();
  if(adjusted){
   data.power.provider='API-Sports results / ESPN standings';
   data.power.explanation='FBS wins and losses adjusted for opponent strength. The index is not a win probability.';
   data.power.scheduleAdjustment={applied:true};
   data.power.teams.forEach((t,i)=>{t.scheduleRank=i+1;t.fbsRecord='4-2';});
  }else{
   data.power.basis='Unadjusted record/scoring-margin index';
   data.power.scheduleAdjustment={applied:false,reason:'Season results and standings do not yet agree.'};
  }
  return {ok:true,json:async()=>data};
 };
 await h.run('Unit501LeaguePulse.show("ncaaf")');
 assert.match(h.nodes.get('league-pulse-power').textContent,/opponent strength.*not a win probability/);
 assert.match(h.nodes.get('league-pulse-power').textContent,/FBS 4-2 · schedule #1/);
 assert.match(h.nodes.get('league-pulse-status').textContent,/API-Sports results/);
 const g=structuredClone(h.game);g.league.id=2;
 h.run(`$("league").value="2"; choose(parseGame(${JSON.stringify(g)}))`);await h.settle();
 assert.match(h.nodes.get('league-pulse-matchup').textContent,/FBS 4-2 · schedule #1/);
 adjusted=false;await h.run('Unit501LeaguePulse.show("ncaaf")');
 assert.match(h.nodes.get('league-pulse-power').textContent,/Unadjusted record\/scoring-margin index/);
 assert.match(h.nodes.get('league-pulse-power').textContent,/do not yet agree/);
 assert.doesNotMatch(h.nodes.get('league-pulse-power').textContent,/FBS 4-2 · schedule/);
});

test('removed upset checkbox and panel stay absent while automatic preparation remains available',async()=>{
 const h=harness();await h.settle();
 for(const id of ['upsetAlertEnabled','upset-alert-panel','upset-alert-title','upset-alert-status']){
  assert.equal(h.nodes.has(id),false);
 }
 assert.equal(h.run('typeof updateUpsetAlert'),'undefined');
 assert.ok(h.nodes.get('venueMode'));
});

test('NFL and college show rest differences, short weeks and missing-history states',async()=>{
 for(const league of [1,2]){
  const h=harness();await h.settle();h.game.league.id=league;h.nodes.get('league').value=String(league);
  const kickoff=h.game.game.date.timestamp*1000;
  h.data.teams[0].recentGames=[{kickoff:kickoff-3*86400000,side:'away',opponent:'Prior host',scored:24,allowed:20}];
  h.data.teams[1].recentGames=[{kickoff:kickoff-7*86400000,side:'home',opponent:'Prior visitor',scored:20,allowed:24}];
  h.run('choose(parseGame('+JSON.stringify(h.game)+'))');await h.settle();await h.settle();
  const text=h.nodes.get('team-context').textContent;
  assert.match(text,/Short week/);assert.match(text,/3 days between kickoffs/);
  assert.doesNotMatch(text,/hours between kickoffs/);
  assert.match(text,/Team B has 4 more full day\(s\) off/);assert.match(text,/no automatic score adjustment/);
  h.data.teams[1].recentGames=[];
  h.run('showTeamContext('+JSON.stringify(h.data)+',selected)');
  assert.match(h.nodes.get('team-context').textContent,/Rest comparison unavailable/);
 }
});

test('college matchup labels unverified schedule strength and distinguishes adjusted results',async()=>{
 const h=harness();await h.settle();await h.settle();
 const original=h.context.fetch;let applied=false;
 h.context.fetch=async url=>{
  const response=await original(url);
  if(!String(url).includes('/api/league-pulse'))return response;
  const data=await response.json();data.power.scheduleAdjustment={applied};
  return {ok:true,json:async()=>data};
 };
 await h.context.document.dispatchEvent(new h.context.CustomEvent('unit501:matchup-selected',{detail:{league:'ncaaf',away:'Team A',home:'Team B'}}));
 await h.context.Unit501LeaguePulse.show('ncaaf');
 assert.match(h.nodes.get('league-pulse-matchup').textContent,/Unadjusted FBS Results/);
 assert.match(h.nodes.get('league-pulse-matchup').textContent,/Schedule strength unverified/);
 assert.doesNotMatch(h.nodes.get('league-pulse-matchup').textContent,/Overall Power Ranks/);
 applied=true;await h.context.Unit501LeaguePulse.show('ncaaf');
 assert.match(h.nodes.get('league-pulse-matchup').textContent,/Schedule-adjusted FBS Results/);
 assert.doesNotMatch(h.nodes.get('league-pulse-matchup').textContent,/Schedule strength unverified/);
});

test('pregame checklist follows selection, line edits and refresh clearing without new requests',async()=>{
 const h=harness(new Map(),true);await h.settle();
 let requests=0;const fetch=h.context.fetch;h.context.fetch=async(...args)=>{requests++;return fetch(...args);};
 for(const file of ['pregame-checks.js','pregame-checks-ui.js'])h.run(fs.readFileSync(path.join(__dirname,'../public',file),'utf8'));
 assert.ok(h.nodes.get('pregame-checks').classList.contains('hidden'));
 h.run('choose(parseGame('+JSON.stringify(h.game)+'))');await h.settle();await h.settle();
 const panel=h.nodes.get('pregame-checks');assert.equal(panel.classList.contains('hidden'),false);
 assert.match(panel.textContent,/Team rosters · Checked/);assert.match(panel.textContent,/Starting lineup · Unconfirmed/);
 const before=requests;await h.context.document.dispatchEvent(new h.context.Event('visibilitychange'));assert.equal(requests,before);
 h.run('gameQuotes={game:selected,data:{awaySpread:3.5,total:45,spreadUpdated:Date.now(),totalUpdated:Date.now()}}');
 h.nodes.get('spread').value='3.5';h.nodes.get('total').value='45';await h.context.document.dispatchEvent(new h.context.Event('unit501:odds-updated'));assert.match(panel.textContent,/Spread · Checked/);
 h.nodes.get('spread').value='99';await h.nodes.get('spread').dispatchEvent(new h.context.Event('input'));assert.doesNotMatch(panel.textContent,/Spread · Checked/);
 h.run('gameQuotes=null;document.dispatchEvent(new Event("unit501:odds-updated"))');assert.match(panel.textContent,/Spread · Unconfirmed/);
 await h.run('selected=null;document.dispatchEvent(new Event("unit501:selection-changed"))');assert.ok(panel.classList.contains('hidden'));
});
test('official historical DNP reaches the prop UI and is excluded without inventing a zero',async()=>{
 const h=harness(),original=h.context.fetch;let historical;
 h.context.fetch=async url=>{
  const u=new URL(url,'http://local');
  if(u.pathname==='/api/football/participation'){
   const id=u.searchParams.get('game'),g=historical.find(g=>String(g.game.id)===id);
   const report=id==='2'?{available:true,gameId:id,league:'1',season:String(g.league.season),gameDate:g.game.date.timestamp,source:'https://static.clubs.nfl.com/test',checkedAt:Date.now(),teams:[
    {id:'1',name:'Team A',scored:Number(g.scores.away.total),allowed:Number(g.scores.home.total),players:[{name:'R.1',participation:'dnp'}]},
    {id:'2',name:'Team B',scored:Number(g.scores.home.total),allowed:Number(g.scores.away.total),players:[]}
   ]}:{available:false};return {ok:true,json:async()=>({response:[report]})};
  }
  const r=await original(url);
  if(u.pathname==='/api/team-games'){
   const data=await r.json(),third=structuredClone(data.response[0]);third.game.id=3;third.game.date.timestamp-=4*86400;data.response.push(third);historical=data.response;
   return {ok:true,json:async()=>data};
  }
  if(u.pathname==='/api/player-stats'&&u.searchParams.get('game')==='2'){
   const data=await r.json();data.response[0].groups=[];return {ok:true,json:async()=>data};
  }
  return r;
 };
 h.run('choose(parseGame('+JSON.stringify(h.game)+'))');await h.settle();
 await h.nodes.get('predict').dispatchEvent({type:'click'});await h.settle();
 await selectPlayer(h);
 assert.match(h.nodes.get('predict-status').textContent,/1 player-game records verified/);
 assert.match(h.nodes.get('predict-results').textContent,/1 verified DNP game\(s\) excluded/);
 assert.match(h.nodes.get('predict-results').textContent,/100.0 average/);
});

test('football simulation shows entered-line differences and clears them when invalidated',async()=>{
 const h=harness();await h.settle();h.run('choose(parseGame('+JSON.stringify(h.game)+'))');await h.settle();await h.settle();h.run('sim()');
 assert.match(h.nodes.get('football-market-gap').textContent,/Entered lines.*Away margin gap.*Total gap/);
 h.run('invalidateSimulation("Inputs changed")');assert.equal(h.nodes.get('football-market-gap').hidden,true);assert.equal(h.nodes.get('football-market-gap').textContent,'');
});

test('football automatic quotes expire without a new provider call and preserve an edited field',async()=>{
 const h=harness();let clock=Date.now();h.context.Date=class extends Date{static now(){return clock;}};
 h.run('choose(parseGame('+JSON.stringify(h.game)+'))');await h.settle();await h.settle();
 assert.equal(h.nodes.get('spread').value,'7.5');assert.equal(h.nodes.get('total').value,'48.5');
 h.nodes.get('spread').value='3.5';await h.nodes.get('spread').dispatchEvent({type:'input'});
 let calls=0;h.context.fetch=async()=>{calls++;throw Error('Unexpected request');};
 clock+=1801000;const timer=h.timers.filter(t=>t.active&&t.delay>=1790000&&t.delay<=1801000).at(-1);assert.ok(timer);timer.fn();
 assert.equal(h.nodes.get('spread').value,'3.5');assert.equal(h.nodes.get('total').value,'');
 assert.equal(h.run('gameQuotes'),null);assert.equal(calls,0);
 h.run('sim()');assert.match(h.nodes.get('note').textContent,/Missing FanDuel total/);
});

test('football refresh failure cannot retain previously automatic quotes',async()=>{
 const h=harness();h.run('choose(parseGame('+JSON.stringify(h.game)+'))');await h.settle();await h.settle();
 assert.equal(h.nodes.get('total').value,'48.5');
 h.context.fetch=async()=>({ok:false,json:async()=>({error:'Unavailable'})});await h.run('loadFanDuel()');
 assert.equal(h.nodes.get('spread').value,'');assert.equal(h.nodes.get('total').value,'');assert.equal(h.run('automaticGameLines.size'),0);
});

test('football rejects undated and stale quotes and withdraws fresh quotes at kickoff',async()=>{
 const h=harness();let clock=Date.now();h.context.Date=class extends Date{static now(){return clock;}};
 const base=h.context.fetch;h.context.fetch=async url=>String(url).includes('/api/fanduel?')?{ok:true,json:async()=>({available:true,awaySpread:7.5,total:48.5,totalUpdated:clock-1800001})}:base(url);
 h.run('choose(parseGame('+JSON.stringify(h.game)+'))');await h.settle();await h.settle();
 assert.equal(h.nodes.get('spread').value,'');assert.equal(h.nodes.get('total').value,'');
 h.context.fetch=async()=>({ok:true,json:async()=>({available:true,awaySpread:7.5,total:48.5,spreadUpdated:clock,totalUpdated:clock})});
 h.run('selected.kickoff=Date.now()+1000');await h.run('loadFanDuel()');assert.equal(h.nodes.get('total').value,'48.5');
 clock+=1000;h.run('expireGameLines()');assert.equal(h.nodes.get('total').value,'');assert.equal(h.nodes.get('spread').value,'');
});

test('college defensive workload changes the actual forecast even when opponent coverage is missing',async()=>{
 const h=harness();await h.settle();h.run(`choose(parseGame(${JSON.stringify(h.game)}))`);await h.settle();
 h.data.teams=Array.from({length:138},(_,i)=>({...structuredClone(h.data.teams[i%32]),id:String(i+1)}));
 for(const t of h.data.teams)for(const m of Object.values(t.metrics))m.pool=138;
 h.data.coverage.pointsFor.expected=138;h.data.coverage.pointsAgainst.expected=138;
 h.run("const originalProject=Unit501TeamModel.project; Unit501TeamModel.project=(...args)=>{window.lastInjuryOptions=args[2]; window.lastInjuryProjection=originalProject(...args); return window.lastInjuryProjection;}");
 h.run("selected.league='2'; $('autoInjuries').checked=false; sim()");
 const baseline=h.run('lastInjuryProjection');
 const game=h.run('selected'),now=Date.now();
 const data={current:true,teams:[{id:'2',roster:{available:true,checkedAt:now,rows:[{id:'18',name:'College Defender',position:'LB'}]},
  official:{available:true,checkedAt:now,league:'2',season:game.season,gameId:game.id,kickoff:game.kickoff,rows:[{id:'18',teamId:'2',name:'College Defender',status:'Out'}]},
  injuryUsage:{available:true,checkedAt:now,league:'2',season:game.season,gameId:game.id,kickoff:game.kickoff,rows:[{id:'18',position:'LB',metric:'tackles',values:[4,5,3],role:'recent defensive contributor'}]}}]};
 h.context.Unit501Availability={snapshot:()=>data};
 h.nodes.get('autoInjuries').checked=true;await h.nodes.get('autoInjuries').dispatchEvent({type:'change'});
 h.run('sim()');
 assert.equal(h.run('lastInjuryOptions.injury.homeDefense'),.35);
 assert.match(h.nodes.get('auto-injury-status').textContent,/College Defender.*factored in.*Partial coverage/);
 assert.equal(h.run('latestForecast'),null);
 const adjusted=h.run('lastInjuryProjection');
 assert.ok(Math.abs(adjusted.away-baseline.away-.35)<1e-9);
 assert.equal(adjusted.home,baseline.home);
 data.teams[0].official.rows[0].status='Questionable';h.run('sim()');
 assert.equal(h.run('lastInjuryOptions.injury.homeDefense'),0);
 assert.equal(h.run('lastInjuryProjection.away'),baseline.away);
});


test('projection board lists usable no-line markets without invented comparisons and supports manual entry',async()=>{
 const h=harness();await h.settle();h.run(`choose(parseGame(${JSON.stringify(h.game)}))`);await h.settle();
 await h.nodes.get('predict').dispatchEvent({type:'click'});await h.settle();
 const markets=h.nodes.get('prop-filter-markets');markets.value='all';await markets.dispatchEvent({type:'change'});
 const board=h.nodes.get('saved-line-comparisons');
 const walk=(node,tag)=>[...(node.tag===tag?[node]:[]),...node.children.filter(c=>typeof c!=='string').flatMap(c=>walk(c,tag))];
 const rows=()=>walk(board,'tbody')[0].children;
 const missing=rows().filter(r=>r.textContent.includes('Line unavailable'));
 assert.equal(rows().length,8);assert.equal(missing.length,5);
 for(const row of missing){assert.equal(row.children[5].textContent,'—');assert.equal(row.children[7].textContent,'Line required');assert.notEqual(row.children[4].textContent,'');}
 const target=missing.find(row=>row.children[1].textContent==='Rushing yards');
 const open=walk(target,'button')[0];await open.dispatchEvent({type:'click'});
 const input=h.nodes.get('line-1:7-rushYds');assert.ok(input);input.value='45.5';await input.dispatchEvent({type:'input'});
 await selectPlayer(h,'');
 assert.equal(rows().filter(r=>r.textContent.includes('Line unavailable')).length,4);
 for(const sort of ['above-desc','above-asc','below-desc','below-asc','most-covers','least-covers','gap','reviewed-gap']){
  const select=h.nodes.get('prop-filter-sort');select.value=sort;await select.dispatchEvent({type:'change'});
  const list=rows();let seenMissing=false;for(const row of list){if(row.textContent.includes('Line unavailable'))seenMissing=true;else assert.equal(seenMissing,false,sort+' must put missing lines last');}
 }
 const filter=h.nodes.get('prop-filter-direction');filter.value='above';await filter.dispatchEvent({type:'change'});assert.ok(rows().every(r=>!r.textContent.includes('Line unavailable')));
});

test('reviewed Baylor and UCF quote spellings populate real client fields without overriding manual entries',async()=>{
 const h=harness();const original=h.context.fetch;
 h.context.fetch=async url=>{
  const r=await original(url);const data=await r.json();
  if(String(url).startsWith('/api/team-games?'))for(const game of data.response)game.league.id=2;
  if(String(url).startsWith('/api/player-stats?'))for(const team of data.response){team.team.name=team.team.id===1?'Baylor':'UCF';for(const group of team.groups)for(const p of group.players)p.player.name=team.team.id===1?'Louis Brown':'Joshua Derry';}
  if(String(url).startsWith('/api/football/player-lines?'))data.props=[['Louis Brown IV','recYds',22.5],['Louis Brown IV','rec',3.5],['Josh Derry','recYds',22.5],['Josh Derry','rec',3.5]].map(([name,stat,line])=>({name,stat,line,updatedAt:Date.now()}));
  return {ok:true,json:async()=>data};
 };
 await h.settle();h.run('$("league").value="2"');const game=JSON.parse(JSON.stringify(h.game));game.league.id=2;game.teams.away.name='Baylor';game.teams.home.name='UCF';h.run(`choose(parseGame(${JSON.stringify(game)}))`);await h.settle();
 await h.nodes.get('predict').dispatchEvent({type:'click'});await h.settle();
 await selectPlayer(h);
 assert.doesNotMatch(h.nodes.get('predict-status').textContent,/Could not load/);
 assert.match(h.nodes.get('prop-feed-status').textContent,/4 matched to unique loaded players; 0 unmatched or invalid; 4 player lines filled/);
 assert.equal(h.nodes.get('line-1:7-recYds').value,'22.5');
 const field=h.nodes.get('line-1:7-recYds');field.value='25.5';await field.dispatchEvent({type:'input'});
 const refresh=h.created.find(n=>n.tag==='button'&&n.textContent==='Refresh FanDuel props');await refresh.dispatchEvent({type:'click'});
 assert.equal(h.nodes.get('line-1:7-recYds').value,'25.5');
 assert.match(h.nodes.get('prop-feed-status').textContent,/1 manual entries preserved/);
});


test('player lines recover from one network failure and populate comparisons',async()=>{
 const h=harness();await h.settle();
 const original=h.context.fetch;let attempts=0;
 h.context.fetch=async url=>{
  if(String(url).startsWith('/api/football/player-lines?')&&++attempts===1)throw new TypeError('Failed to fetch');
  return original(url);
 };
 h.run(`choose(parseGame(${JSON.stringify(h.game)}))`);await h.settle();
 await h.nodes.get('predict').dispatchEvent({type:'click'});await h.settle();await h.settle();
 await selectPlayer(h);
 assert.equal(attempts,2);
 assert.equal(h.nodes.get('line-1:7-carries').value,'19.5');
 assert.match(h.nodes.get('prop-feed-status').textContent,/3 player lines filled/);
 const refresh=h.created.find(n=>n.tag==='button'&&n.textContent==='Refresh FanDuel props');
 attempts=0;h.context.fetch=async url=>{if(String(url).startsWith('/api/football/player-lines?')){attempts++;throw new TypeError('Failed to fetch');}return original(url);};
 await refresh.dispatchEvent({type:'click'});
 assert.equal(attempts,2);
 assert.equal(h.nodes.get('line-1:7-carries').value,'19.5');
 assert.match(h.nodes.get('prop-feed-status').textContent,/could not reach Unit 501 after retrying/);
 assert.equal(refresh.disabled,false);
});


test('TD history shows scoring games without inventing a betting line',async()=>{
 const h=harness();await h.settle();const original=h.context.fetch;
 h.context.fetch=async url=>{
  const r=await original(url);if(!String(url).startsWith('/api/player-stats?'))return r;
  const data=await r.json();const id=new URL(url,'http://localhost').searchParams.get('game');
  for(const team of data.response)for(const group of team.groups)for(const p of group.players)
   p.statistics.push({name:group.name==='Rushing'?'Rushing Touchdowns':'Receiving Touchdowns',value:id==='1'?0:2});
  return {ok:true,json:async()=>data};
 };
 h.run(`choose(parseGame(${JSON.stringify(h.game)}))`);await h.settle();
 await h.nodes.get('predict').dispatchEvent({type:'click'});await h.settle();
 const markets=h.nodes.get('prop-filter-markets');markets.value='all';await markets.dispatchEvent({type:'change'});
 const walk=n=>[n,...n.children.filter(c=>typeof c!=='string').flatMap(walk)];
 const rows=walk(h.nodes.get('saved-line-comparisons')).filter(n=>n.tag==='tr'&&n.children[1]?.textContent==='Rushing TDs');
 assert.equal(rows.length,2);
 for(const row of rows){assert.equal(row.children[3].textContent,'Line unavailable');assert.equal(row.children[5].textContent,'—');assert.match(row.children[7].textContent,/1\+ TDs: 1.*0 TDs: 1.*2 recorded games/);}
 h.nodes.get('predict-player').value='1:7';await h.nodes.get('predict-player').dispatchEvent({type:'change'});
 assert.match(h.nodes.get('predict-results').textContent,/Fixed history threshold; no betting line used/);
 const research=h.nodes.get('player-research-details');
 assert.equal(research.open,false);
 assert.equal(h.nodes.get('predict-results').parentNode,research);
 const dashboard=h.created.filter(n=>n.className==='athlete-markets').at(-1);
 const td=walk(dashboard).find(n=>n.tag==='tr'&&n.children[0]?.textContent==='Rushing TDs');
 assert.equal(td.children[1].textContent,'Unavailable');
 assert.match(td.children[6].textContent,/1\+ TD vs 0 TDAbove150\.0%Below150\.0%2 games/);
});

test('first matchup this season displays prior-season actuals without changing the projected sample',async()=>{
 const h=harness(), base=h.context.fetch;
 h.context.fetch=async url=>{
  const u=new URL(url,'http://localhost');
  const original=await base(url);
  if(u.pathname==='/api/player-stats'){
   const data=await original.json();data.response.push({team:{id:5,name:'Other'},groups:[]});
   return {ok:true,json:async()=>data};
  }
  if(u.pathname!=='/api/team-games')return original;
  const {response}=await original.json();
  const team=u.searchParams.get('team'),prior=u.searchParams.get('season')==='2025';
  const games=response.map(g=>({...g,league:{...g.league,season:prior?2025:2026},
   teams:prior?g.teams:{...g.teams,[team==='1'?'home':'away']:{id:5,name:'Other'}},
   game:{...g.game,date:{timestamp:prior?Date.parse('2025-12-25T21:30Z')/1000:g.game.date.timestamp}}}));
  return {ok:true,json:async()=>({response:prior?games.slice(0,1):games})};
 };
 await h.settle();h.run(`choose(parseGame(${JSON.stringify(h.game)}))`);await h.settle();
 await h.nodes.get('predict').dispatchEvent({type:'click'});await h.settle();
 const markets=h.nodes.get('prop-filter-markets');markets.value='all';await markets.dispatchEvent({type:'change'});await h.settle();
 const board=h.nodes.get('saved-line-comparisons');
 assert.match(board.textContent,/100 vs Team B · Dec 25, 2025/);
 assert.match(board.textContent,/Above2100\.0%Below00\.0%/);
});

 test('bettable board defaults to quoted markets and exposes a quoted player with missing stats',async()=>{
 const h=harness();await h.settle();const original=h.context.fetch;
 h.context.fetch=async url=>{
  const result=await original(url);const data=await result.json();
  if(String(url).startsWith('/api/player-stats?')&&new URL(url,'http://localhost').searchParams.get('game')==='1')
   data.response[0].groups.find(g=>g.name==='Receiving').players[0].statistics=data.response[0].groups.find(g=>g.name==='Receiving').players[0].statistics.filter(s=>s.name!=='Yards');
  return {ok:true,json:async()=>data};
 };
 h.run(`choose(parseGame(${JSON.stringify(h.game)}))`);await h.settle();
 await h.nodes.get('predict').dispatchEvent({type:'click'});await h.settle();
 const board=h.nodes.get('saved-line-comparisons');
 const walk=n=>[n,...n.children.filter(c=>typeof c!=='string').flatMap(walk)];
 const rows=()=>walk(board).filter(n=>n.tag==='tbody').flatMap(n=>n.children);
 assert.equal(rows().length,2);assert.ok(rows().every(r=>!r.textContent.includes('Line unavailable')));
 assert.match(h.nodes.get('prop-missing-markets').textContent,/RB 1 — Receiving yards.*Line 22.5.*Fewer than two verified/);
 const player=h.nodes.get('predict-player');player.value='2:8';await player.dispatchEvent({type:'change'});
 assert.equal(rows().length,0);assert.match(board.textContent,/No projections match/);
 const markets=h.nodes.get('prop-filter-markets');markets.value='all';await markets.dispatchEvent({type:'change'});
 assert.equal(rows().length,4);assert.ok(rows().every(r=>r.children[0].textContent.includes('RB 2')));
 });

test('slate cooldown preserves the same loaded games and selection, shows a countdown and resets on date changes',async()=>{
 const h=harness();await h.settle();await h.settle();
 h.run(`choose(parseGame(${JSON.stringify(h.game)}))`);await h.settle();
 const prior=h.nodes.get('games').children.slice(),base=h.context.fetch;
 h.context.fetch=async url=>String(url).startsWith('/api/games?')?{ok:false,status:429,json:async()=>({error:'cooldown active',code:'FOOTBALL_COOLDOWN',retryAt:Date.now()+60000})}:base(url);
 await h.run('load()');
 assert.deepEqual(h.nodes.get('games').children,prior);
 assert.equal(h.run('selected.id'),999);
 assert.match(h.nodes.get('slate-refresh-status').textContent,/last loaded games.*Try Load Slate in 60s/);
 assert.equal(h.nodes.get('load').disabled,true);
 h.nodes.get('date').value='2026-10-11';await h.nodes.get('date').dispatchEvent({type:'change'});
 assert.equal(h.nodes.get('load').disabled,false);assert.equal(h.nodes.get('slate-refresh-status').hidden,true);
 assert.doesNotMatch(h.nodes.get('games').textContent,/RB 1/);
});

test('football quote refresh captures each accepted market once with its actual board disposition',async()=>{
 const h=harness(),original=h.context.fetch;
 const store=require('../football-quote-trace').createTraceStore();
 const snapshots=[];
 h.context.fetch=async(url,options)=>{
  if(url==='/api/football/quote-trace'){
   const snapshot=JSON.parse(options.body);
   snapshots.push(snapshot);
   assert.deepEqual(store.capture(snapshot),{balanced:true});
   return {ok:true};
  }
  const result=await original(url);
  if(!String(url).startsWith('/api/football/player-lines?'))return result;
  const data=await result.json();
  data.props.push({name:'Absent Receiver',stat:'rec',line:2.5,updatedAt:Date.now()});
  return {ok:true,json:async()=>data};
 };
 await h.settle();h.run('choose(parseGame('+JSON.stringify(h.game)+'))');await h.settle();
 await h.nodes.get('predict').dispatchEvent({type:'click'});await h.settle();
 assert.equal(snapshots.length,1);
 const [trace]=store.latest();
 assert.equal(trace.accepted,4);assert.equal(trace.displayed,3);assert.equal(trace.game,'999');
 assert.equal(trace.entries.length,4);assert.equal(trace.balanced,true);
 assert.equal(trace.entries.find(r=>r.name==='Absent Receiver').reason,'Player absent from loaded history');
 const select=h.nodes.get('prop-filter-direction');select.value='below';await select.dispatchEvent({type:'change'});
 assert.equal(snapshots.length,1);
 const refresh=h.created.find(n=>n.tag==='button'&&n.textContent==='Refresh FanDuel props');
 await refresh.dispatchEvent({type:'click'});
 assert.equal(snapshots.length,2);assert.equal(store.latest().length,1);
 assert.equal(store.latest()[0].accepted,4);assert.equal(store.latest()[0].displayed,0);
 assert.equal(store.latest()[0].entries.filter(r=>r.reason==='Excluded by view filters').length,3);
});

test('player menu includes roster-only players while comparative rates require a verified line and history',async()=>{
 const h=harness(new Map(),true);await h.settle();h.run(`choose(parseGame(${JSON.stringify(h.game)}))`);await h.settle();
 await h.nodes.get('predict').dispatchEvent({type:'click'});await h.settle();
 const availability=h.context.Unit501Availability;
 const snapshot=availability.snapshot();
 h.context.Unit501Availability={...availability,snapshot:()=>({...snapshot,current:true,teams:snapshot.teams.map((team,i)=>i?team:{...team,roster:{...team.roster,available:true,rows:[...(team.roster?.rows||[]),{id:'222',name:'Roster Only'}]}})})};
 await selectPlayer(h,'');
 assert.match(h.nodes.get('predict-player').textContent,/Roster Only/);
 assert.match(h.nodes.get('saved-line-comparisons').textContent,/Above\d+[\d.]+%Below\d+[\d.]+%/);
 await selectPlayer(h,'1:222');
 assert.match(h.nodes.get('predict-results').textContent,/insufficient/);
 assert.equal(h.nodes.get('saved-line-comparisons').dataset.displayedAutoLines,'0');
});
