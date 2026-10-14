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
  constructor(tag='div'){this.tag=tag;this.children=[];this.listeners={};this.dataset={};this.style={};this.validity={badInput:false};this._value='';this._text='';this.isConnected=true;this.classList={add(){},remove(){},toggle(){}};}
  set id(v){this._id=v;nodes.set(v,this);}get id(){return this._id;}
  set value(v){this._value=String(v);}get value(){return this._value;}
  set textContent(v){this._text=String(v);this.children=[];}get textContent(){return this._text+this.children.map(c=>typeof c==='string'?c:c.textContent).join('');}
  set innerHTML(v){this.replaceChildren();}get innerHTML(){return '';}
  append(...children){this.children.push(...children);if(this.tag==='select'&&!this.value&&children[0])this.value=children[0].value;}
  appendChild(child){this.append(child);return child;}
  replaceChildren(...children){this.children=[];this._text='';if(this.tag==='select')this.value='';this.append(...children);}
  before(){}after(){}setAttribute(){}scrollIntoView(){}focus(){}
  addEventListener(name,fn){(this.listeners[name]??=[]).push(fn);}
  async dispatchEvent(event){for(const fn of this.listeners[event.type]||[])await fn(event);}
 }
 const document=new Node('document');document.createElement=tag=>{const n=new Node(tag);created.push(n);return n;};document.getElementById=id=>nodes.get(id)||null;
 const html=fs.readFileSync(path.join(__dirname,'../public/index.html'),'utf8');
 for(const match of html.matchAll(/<(\w+)[^>]*\bid="([^"]+)"[^>]*>/g)){const node=new Node(match[1]);node.id=match[2];}
 nodes.get('date').value='2026-10-10';nodes.get('league').value='1';nodes.get('weatherEnabled').checked=true;
 const context={document,console,URLSearchParams,AbortSignal,Date,Event:class{constructor(type){this.type=type;}},setTimeout:(fn,delay)=>{timers.push({fn,delay,active:true});return timers.length;},clearTimeout:id=>{if(timers[id-1])timers[id-1].active=false;},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)}};
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
  else if(u.pathname==='/api/rankings')response={state:++polls===1?'loading':'ready',completed:2,total:32,data};
  else if(u.pathname==='/api/fanduel')response={available:true,awaySpread:7.5,total:48.5,spreadUpdated:Date.now(),totalUpdated:Date.now()};
  else if(u.pathname==='/api/team-games')response={response:[1,2].map(id=>({...game,game:{...game.game,id,date:{timestamp:stamp-id*86400-1000},status:{short:'FT',long:'Finished'}}}))};
  else if(u.pathname==='/api/player-stats')response={response:['1','2'].map((id,i)=>({team:{id:Number(id),name:'Team '+(i?'B':'A')},groups:[{name:'Rushing',players:[{player:{id:i+7,name:'RB '+id},statistics:[{name:'Total Rushes',value:20},{name:'Yards',value:100}]}]},{name:'Receiving',players:[{player:{id:i+7,name:'RB '+id},statistics:[{name:'Receptions',value:4},{name:'Yards',value:24},{name:'Targets',value:5}]}]}]}))};
  else if(u.pathname==='/api/fanduel-props')response={props:[{name:'RB 1',stat:'carries',line:19.5,updatedAt:Date.now()},{name:'RB 1',stat:'recYds',line:22.5,updatedAt:Date.now()},{name:'RB 1',stat:'rec',line:3.5,updatedAt:Date.now()}],coverage:require('../fanduel-props').marketCoverage([{stat:'carries'},{stat:'recYds'},{stat:'rec'}]),message:'Fixture props'};
  else if(u.pathname==='/api/availability')response={current:true,teams:['1','2'].map(id=>({id,roster:{available:true,checkedAt:Date.now(),rows:[{id:id==='1'?'7':'8',name:'RB '+id,position:'RB'},...(id==='1'?[{id:'9',name:'ZZBackup',position:'RB'}]:[])]},injuries:{available:true,checkedAt:Date.now(),rows:context.injuryOut?[{id:'7',teamId:'1',status:'Out',date:new Date().toISOString()}]:[]}})),message:'Fixture'};
  else if(u.pathname==='/api/player-ratings')response={state:'ready',data:{league:'1',season:'2026',before:stamp*1000,players:[{id:'7',teamId:'1',name:'RB 1',position:'RB',role:'RB',rating:80,trend:'Steady',games:4,coverage:[{count:4}],profiles:{receiving:{usage:2,efficiency:6,games:4,latestMissing:false,coverage:{recorded:4,total:4}},rushing:{usage:20,efficiency:5,games:4,latestMissing:false,coverage:{recorded:4,total:4}}}},{id:'9',teamId:'1',name:'ZZBackup',position:'RB',role:'RB',rating:45,trend:'Steady',games:4,coverage:[{count:4}],profiles:{receiving:{usage:2,efficiency:6,games:4,latestMissing:false,coverage:{recorded:4,total:4}},rushing:{usage:5,efficiency:3,games:4,latestMissing:false,coverage:{recorded:4,total:4}}}}]}};
  else throw Error('Unexpected client request '+url);
  if(extras&&u.pathname==='/api/player-stats')response.response[0].groups[0].players.push({player:{id:9,name:'ZZBackup'},statistics:[{name:'Total Rushes',value:5},{name:'Yards',value:15}]});
  return {ok:true,json:async()=>response};
 };
 const run=source=>vm.runInContext(source,context);
 for(const file of ['probability-calibration.js','pace-model.js','team-model.js','forecast-archive.js','forecast-results.js','injury-backtest.js','forecast-dashboard.js','forecast-review.js','venue-weather.js','app.js','injury-model.js','player-form.js','player-stats.js','player-backtest.js','predictions.js'])run(fs.readFileSync(path.join(__dirname,'../public',file),'utf8'));
 if(extras)for(const file of ['availability.js','lineup-model.js','player-ratings-ui.js'])run(fs.readFileSync(path.join(__dirname,'../public',file),'utf8'));
 const settle=()=>new Promise(resolve=>setImmediate(resolve));
 return {nodes,storage,run,game,data,timers,settle,context,created};
}
test('actual client home-context control changes margin and resets on game selection',async()=>{
 const h=harness();await h.settle();h.run('$("league").value="1"');h.run(`choose(parseGame(${JSON.stringify(h.game)}))`);await h.settle();
 h.run('$("venueMode").value="home"; sim()');const first=h.nodes.get('score').textContent;
 h.nodes.get('homeFieldMode').value='manual';await h.nodes.get('homeFieldMode').dispatchEvent({type:'change'});h.nodes.get('homeFieldReason').value='Playoff elimination stakes';h.nodes.get('homeContext').value='4';await h.nodes.get('homeContext').dispatchEvent({type:'input'});assert.equal(h.nodes.get('score').textContent,'—');
 h.run('sim()');assert.notEqual(h.nodes.get('score').textContent,first);assert.match(h.nodes.get('note').textContent,/Manual total home advantage/);
 h.nodes.get('variableHomeField').checked=true;h.run(`choose(parseGame(${JSON.stringify(h.game)}))`);await h.settle();
 assert.equal(h.nodes.get('homeContext').value,'2');assert.equal(h.nodes.get('homeFieldMode').value,'auto');assert.equal(h.nodes.get('variableHomeField').checked,false);
});
test('actual client flow allows scoring during ranking build and persists manual RB prop lines across reload/refresh',async()=>{
 const h=harness();await h.settle();h.run('$("league").value="1"');h.run(`choose(parseGame(${JSON.stringify(h.game)}))`);await h.settle();
 assert.match(h.nodes.get('team-context').textContent,/Scoring is ready/);
 h.run('sim()');assert.equal(h.nodes.get('score').textContent,'24–24');
 await h.nodes.get('predict').dispatchEvent({type:'click'});await h.settle();
 assert.match(h.nodes.get('prop-feed-status').textContent,/3\/8 modeled markets/);
 assert.match(h.nodes.get('prop-feed-status').textContent,/No usable lines returned for: Passing yards/);
 assert.equal(h.nodes.get('line-1:7-carries').value,'19.5');
 assert.equal(h.nodes.get('line-1:7-recYds').value,'22.5');assert.equal(h.nodes.get('line-1:7-rec').value,'3.5');
 const input=h.nodes.get('line-1:7-carries');input.value='21.5';await input.dispatchEvent({type:'input'});
 assert.ok([...h.storage].some(([k,v])=>k.endsWith(':1:7:carries')&&JSON.parse(v).value==='21.5'));
 const next=harness(h.storage);await next.settle();next.run('$("league").value="1"');next.run(`choose(parseGame(${JSON.stringify(next.game)}))`);await next.settle();
 await next.nodes.get('predict').dispatchEvent({type:'click'});await next.settle();
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
 assert.equal(h.run('Unit501Availability.snapshot()'),before);assert.equal(h.nodes.get('score').textContent,'24–24');
 release();await pending;assert.equal(h.nodes.get('score').textContent,'24–24');
 const clock=Date.now()+900001;h.context.Date=class extends Date{static now(){return clock;}};
 let tick=h.timers.findLast(t=>t.active&&t.delay===60000);assert.ok(tick);
 h.context.document.hidden=true;await tick.fn();assert.equal(calls,1);
 h.context.document.hidden=false;tick=h.timers.findLast(t=>t.active&&t.delay===60000);
 const refreshing=tick.fn();await h.settle();assert.equal(calls,2);release();await refreshing;
});
test('completing an accepted pace model invalidates an older scoring simulation only once',async()=>{
 const h=harness();await h.settle();h.run(`choose(parseGame(${JSON.stringify(h.game)}))`);await h.settle();h.run('sim()');assert.equal(h.nodes.get('score').textContent,'24–24');
 for(const t of h.data.teams)t.pace={games:4,drives:40,opponentDrives:40};
 h.data.paceValidation={accepted:true,league:'1',season:'2026',before:h.data.before,evaluatedGames:30,scoreError:8,baselineScoreError:9,totalError:10,baselineTotalError:11,explanation:'Fixture'};
 h.run(`showTeamContext(${JSON.stringify(h.data)},selected)`);assert.equal(h.nodes.get('score').textContent,'—');
 h.run('sim()');assert.equal(h.nodes.get('score').textContent,'24–24');
 h.run(`showTeamContext(${JSON.stringify(h.data)},selected)`);assert.equal(h.nodes.get('score').textContent,'24–24');
});

test('actual ratings, roster, replacement, score and prop flows share one scenario and refresh gates it',async()=>{
 const h=harness(new Map(),true);await h.settle();h.run(`choose(parseGame(${JSON.stringify(h.game)}))`);await h.settle();await h.settle();
 await h.nodes.get('build-player-ratings').onclick();await h.settle();
 const confirm=h.nodes.get('baseline-1:7'),replacement=h.nodes.get('replacement-1:7'),workload=h.nodes.get('workload-1:7');
 h.run('sim()');assert.equal(h.nodes.get('score').textContent,'24–24');
 h.run("document.dispatchEvent(new Event('unit501:team-context-updated'))");assert.equal(h.nodes.get('score').textContent,'24–24');
 assert.ok(confirm);replacement.value='9';replacement.onchange();workload.value='0';workload.onchange();confirm.checked=true;confirm.onchange();
 const scenario=JSON.parse(h.run('JSON.stringify(window.Unit501Lineups.evaluate())'));assert.equal(scenario.applied,true);assert.equal(scenario.props['1:9'].rushing.extraUsage,20);
 h.run('sim()');assert.equal(h.nodes.get('score').textContent,'23–24');
 h.run("document.dispatchEvent(new Event('unit501:team-context-updated'))");assert.equal(h.nodes.get('score').textContent,'23–24');
 await h.nodes.get('predict').dispatchEvent({type:'click'});await h.settle();
 assert.match(h.nodes.get('predict-results').textContent,/0.0 projected/);
 h.nodes.get('predict-player').value='1:9';await h.nodes.get('predict-player').dispatchEvent({type:'change'});
 assert.match(h.nodes.get('predict-results').textContent,/75.0 projected/);
 const propArchive=h.run('Unit501ForecastArchive.read(localStorage).snapshots.find(s=>s.kind==="prop"&&s.records[0].playerId==="9"&&s.records[0].market==="rushYds")');
 assert.equal(propArchive.records[0].baseline,15);assert.equal(propArchive.records[0].adjusted,75);assert.ok(propArchive.inputs.lineupInputs);
 // An unavailable replacement invalidates transferred output after a report refresh.
 h.context.injuryOut=true;
 h.run("Unit501Availability.snapshot().teams[0].injuries.rows=[{id:'9',teamId:'1',status:'Out',date:new Date().toISOString()}];document.dispatchEvent(new Event('unit501:availability-updated'))");await h.settle();
 assert.equal(h.run('window.Unit501Lineups.evaluate().applied'),false);h.run('sim()');assert.equal(h.nodes.get('score').textContent,'24–24');
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
 assert.match(h.nodes.get('availability-score-status').textContent,/Run the simulation again/);
 h.run("invalidateSimulation('Inputs changed')");assert.equal(h.nodes.get('availability-score-status').textContent,'');
});

test('simulation archives ordinary forecasts and keeps the first forecast across edits and reload',async()=>{
 const h=harness();await h.settle();h.run(`choose(parseGame(${JSON.stringify(h.game)}))`);await h.settle();
 h.run('sim()');assert.equal(h.run('Unit501ForecastArchive.read(localStorage).snapshots.length'),1);
 h.run('$("awayOffenseLoss").value="4"; sim()');
 const saved=h.run('Unit501ForecastArchive.read(localStorage).snapshots[0]');
 assert.equal(saved.baseline.away,24);assert.equal(saved.adjusted.away,24);assert.equal(saved.records[0].actual,null);
 assert.ok(saved.forecastAt<saved.game.kickoff);assert.match(h.nodes.get('forecast-archive-status').textContent,/saved on this browser/);
 h.run('$("awayOffenseLoss").value="7"; sim()');
 assert.equal(h.run('Unit501ForecastArchive.read(localStorage).snapshots[0].adjusted.away'),24);
 const next=harness(h.storage);await next.settle();assert.equal(next.run('Unit501ForecastArchive.read(localStorage).snapshots.length'),1);
});

test('saved forecast accuracy shows pending outcomes and real paired errors without inventing samples',async()=>{
 const h=harness();await h.settle();h.run(`choose(parseGame(${JSON.stringify(h.game)}))`);await h.settle();
 h.run('$("awayOffenseLoss").value="4"; sim()');
 assert.match(h.nodes.get('forecast-review-results').textContent,/2 pending final outcomes/);
 assert.match(h.nodes.get('forecast-review-results').textContent,/No eligible final outcomes/);
 const pendingText=h.nodes.get('forecast-review-results').textContent;
 assert.match(pendingText,/Pending targets/);assert.match(pendingText,/NFL · Team points/);
 assert.match(pendingText,/Awaiting matched final outcomes/);
 assert.doesNotMatch(pendingText,/0.00 higher|Unchanged|NaN/);
 h.run(`const archiveForReview=Unit501ForecastArchive.read(localStorage);for(const r of archiveForReview.snapshots[0].records){r.actual=19;r.resultKnownAt=r.kickoff+100000;}localStorage.setItem(Unit501ForecastArchive.key,JSON.stringify(archiveForReview));document.dispatchEvent(new Event('unit501:archive-updated'));`);
 const text=h.nodes.get('forecast-review-results').textContent;
 assert.match(text,/2 matched targets/);assert.match(text,/NFL · Team points/);assert.match(text,/1\/30 games — insufficient/);
 assert.match(text,/5.00/);assert.match(text,/3.00/);assert.match(text,/2.00 lower/);
 assert.match(text,/Baseline bias/);assert.match(text,/Adjusted bias/);
 assert.match(text,/\+5.00/);assert.match(text,/\+3.00/);
 assert.match(text,/positive means projections ran too high/);
});

test('ordinary prop forecasts and chosen picks stay separate with exact line and price',async()=>{
 const h=harness();await h.settle();h.run(`choose(parseGame(${JSON.stringify(h.game)}))`);await h.settle();
 await h.nodes.get('predict').dispatchEvent({type:'click'});await h.settle();
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
 assert.match(h.nodes.get('forecast-review-results').textContent,/under 21.5 · price -136/);
});

test('game picks freeze simulation lines and cannot use invalidated forecasts',async()=>{
 const h=harness();await h.settle();h.run(`choose(parseGame(${JSON.stringify(h.game)}))`);await h.settle();
 h.nodes.get('game-pick-direction').value='spread:home';h.run('sim()');
 h.nodes.get('game-pick-price').value='-110';h.nodes.get('save-game-pick').onclick();
 const saved=h.run('Unit501ForecastArchive.read(localStorage).snapshots');
 assert.equal(saved.length,2);assert.equal(saved[1].selection.line,7.5);assert.equal(saved[1].selection.direction,'home');
 assert.equal(saved[0].inputs.marketContext.total,48.5);
 assert.match(h.nodes.get('forecast-review-results').textContent,/home -7.5/);
 h.nodes.get('spread').value='9.5';await h.nodes.get('spread').dispatchEvent({type:'input'});
 h.nodes.get('save-game-pick').onclick();assert.match(h.nodes.get('forecast-archive-status').textContent,/Run an eligible pregame forecast first/);
});

test('pending-only prop markets display separately from score results',async()=>{
 const h=harness();await h.settle();
 h.run(`const pendingProp={league:'1',season:'2026',gameId:'999',teamId:'1',playerId:'9',kind:'prop',market:'rec',modelVersion:'test-v1',evidenceUrl:'https://example.org/forecast',kickoff:200000,forecastAt:100000,inputAsOf:90000,baseline:5,adjusted:4,actual:null,resultKnownAt:null};localStorage.setItem(Unit501ForecastArchive.key,JSON.stringify({schema:1,snapshots:[{records:[pendingProp]}]}));Unit501ForecastReview.render();`);
 const panel=h.nodes.get('forecast-review-results');
 assert.match(panel.textContent,/NFL · Receptions/);
 assert.doesNotMatch(panel.textContent,/NFL · Team points/);
 const table=panel.children.find(n=>n.children?.some(c=>c.tag==='table')).children[0];
 const cells=table.children.find(n=>n.tag==='tbody').children[0].children.map(n=>n.textContent);
 assert.deepEqual(cells,['NFL · Receptions','0','0','1','—','—','—','—','—','Awaiting matched final outcomes']);
});
test('opening accuracy panel auto-checks past results once and throttles repeated opens',async()=>{
 const h=harness();await h.settle();let calls=0;
 const kickoff=Date.now()-100000;
 const archive={schema:1,snapshots:[{schema:1,game:{id:'9',league:'1',season:'2026',awayId:'1',homeId:'2',kickoff},forecastAt:kickoff-1000,records:[]}]};
 h.storage.set('unit501-score-archive-v1',JSON.stringify(archive));
 h.context.fetch=async()=>{calls++;return {ok:true,json:async()=>({response:[]})};};
 h.nodes.get('forecast-review').open=true;
 await h.nodes.get('forecast-review').dispatchEvent({type:'toggle'});await h.settle();await h.settle();
 assert.equal(calls,1);assert.equal(h.nodes.get('refresh-forecast-results').disabled,false);
 await h.nodes.get('forecast-review').dispatchEvent({type:'toggle'});await h.settle();assert.equal(calls,1);
});

test('switching matchups clears scenarios and ignores late injury, rating, ranking, odds and prop responses',async()=>{
 const h=harness(new Map(),true);await h.settle();h.run(`choose(parseGame(${JSON.stringify(h.game)}))`);await h.settle();await h.settle();
 await h.nodes.get('build-player-ratings').onclick();await h.nodes.get('predict').dispatchEvent({type:'click'});await h.settle();
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
 assert.equal(h.nodes.get('awayOffenseLoss').value,'0');assert.equal(h.nodes.get('awayRating').value,'0');
 const current=h.run('Unit501Availability.snapshot()');assert.equal(current.teams[0].injuries.rows.length,0);
 for(const release of releases)release();await Promise.all([injury,rating,odds,propRequest]);await h.settle();await h.settle();
 assert.equal(h.run('Unit501Availability.snapshot()'),current);assert.equal(h.run('scoringContext.game.id'),1000);
 assert.equal(h.nodes.get('ratings-results').textContent,'');assert.equal(h.nodes.get('build-player-ratings').disabled,undefined);
 assert.equal(h.nodes.get('predict-results').textContent,'');assert.equal(h.nodes.get('prop-feed-status').textContent,'');assert.equal(propButton.disabled,true);
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
 const workload=h.nodes.get('predict-results').children.find(n=>n.tag==='label').children.find(n=>n.tag==='select');workload.value='50';workload.onchange();
 const line=h.nodes.get('line-1:7-carries');line.value='21.5';await line.dispatchEvent({type:'input'});
 h.run(`choose(parseGame(${JSON.stringify(next)}))`);await h.settle();await h.nodes.get('predict').dispatchEvent({type:'click'});await h.settle();
 assert.equal(h.nodes.get('line-1:7-carries').value,'19.5');
 assert.equal(h.nodes.get('predict-results').children.find(n=>n.tag==='label').children.find(n=>n.tag==='select').value,'100');
 assert.ok(![...h.storage].some(([k,v])=>k.includes(':1000:')&&JSON.parse(v).value==='21.5'));
 h.run(`choose(parseGame(${JSON.stringify(h.game)}))`);await h.settle();await h.nodes.get('predict').dispatchEvent({type:'click'});await h.settle();
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


test('prop board filters direction and groups gap ordering by stat, with reset on game selection',async()=>{
 const h=harness();await h.settle();h.run(`choose(parseGame(${JSON.stringify(h.game)}))`);await h.settle();
 await h.nodes.get('predict').dispatchEvent({type:'click'});await h.settle();
 const input=h.nodes.get('line-1:7-carries');input.value='21.5';await input.dispatchEvent({type:'input'});
 const board=h.nodes.get('saved-line-comparisons');
 const walk=(node,tag)=>[...(node.tag===tag?[node]:[]),...node.children.filter(c=>typeof c!=='string').flatMap(c=>walk(c,tag))];
 const rows=()=>walk(board,'tbody')[0]?.children||[];
 const change=async(key,value)=>{const select=h.nodes.get('prop-filter-'+key);select.value=value;await select.dispatchEvent({type:'change'});};
 await change('direction','below');assert.equal(rows().length,1);assert.match(rows()[0].textContent,/1.5 below/);
 await change('direction','above');assert.equal(rows().length,2);assert.ok(rows().every(r=>r.textContent.includes('above')));
 await change('direction','');await change('sort','gap');assert.equal(rows().length,3);
 // Same market: the larger gap must lead even when that player loaded later.
 h.nodes.get('predict-player').value='2:8';await h.nodes.get('predict-player').dispatchEvent({type:'change'});
 const second=h.nodes.get('line-2:8-carries');second.value='25.5';await second.dispatchEvent({type:'input'});
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
 const filter=h.nodes.get('prop-filter-stat');filter.value='carries';await filter.dispatchEvent({type:'change'});
 let copied='';h.context.navigator={clipboard:{writeText:async text=>{copied=text;}}};
 await h.nodes.get('copy-prop-board').dispatchEvent({type:'click'});
 assert.match(copied,/RB 1 — Team A/);assert.match(copied,/Line 19.5/);assert.match(copied,/FanDuel automatic/);assert.match(copied,/Verify participation/);assert.match(copied,/Carries: 20, 20/);assert.match(h.nodes.get('saved-line-comparisons').textContent,/Carries: 20, 20/);assert.doesNotMatch(copied,/Line 22.5/);
 assert.match(h.nodes.get('copy-prop-board-status').textContent,/copied/);
 h.context.navigator.clipboard.writeText=async()=>{throw Error('Denied');};
 await h.nodes.get('copy-prop-board').dispatchEvent({type:'click'});
 assert.match(h.nodes.get('prop-board-copy-text').value,/Line 19.5/);
 assert.match(h.nodes.get('copy-prop-board-status').textContent,/Select and copy/);
 const future=Date.now()+1800001;h.context.Date=class extends Date{static now(){return future;}};
 copied='';h.context.navigator.clipboard.writeText=async text=>{copied=text;};
 await h.nodes.get('copy-prop-board').dispatchEvent({type:'click'});
 assert.equal(copied,'');assert.match(h.nodes.get('copy-prop-board-status').textContent,/No current lines/);
});
