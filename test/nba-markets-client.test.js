'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function harness(){
 const nodes=new Map(),calls=[],timers=[];let clock=Date.parse('2026-10-24T20:00:00Z');
 class Node{
  constructor(){this.children=[];this.events={};this.value='';this._text='';this.disabled=false;}
  set textContent(v){this._text=String(v);this.children=[];}get textContent(){return this._text+this.children.map(n=>n.textContent).join(' ');}
  append(...n){this.children.push(...n);}replaceChildren(...n){this.children=n;this._text='';}setAttribute(){}addEventListener(e,f){this.events[e]=f;}
 }
 const html=fs.readFileSync(require.resolve('../public/nba.html'),'utf8');for(const m of html.matchAll(/id="([^"]+)"/g))nodes.set(m[1],new Node());
 const document={getElementById:id=>nodes.get(id),createElement:()=>new Node(),addEventListener(){},hidden:false};
 const game={id:899,away:'Clippers',home:'Bulls',tipoff:'2026-10-24T23:00:00Z',status:'Scheduled'};
 const base=g=>({gameId:g.id,tipoff:g.tipoff,bookmaker:'FanDuel',message:'Loaded',props:[],coverage:[]});
 const data=(g,props)=>props?{...base(g),props:[{name:'Player A',market:'player_points',label:'Points',line:20.5,over:-110,under:100,updatedAt:clock},{name:'Player B',market:'player_rebounds',label:'Rebounds',line:9.5,over:110,under:-120,updatedAt:clock}]}:{...base(g),spread:{away:3.5,home:-3.5,awayPrice:-110,homePrice:-110,updatedAt:clock},total:{line:225.5,over:-110,under:100,updatedAt:clock}};
 const context={document,Date:class extends Date{static now(){return clock;}},URLSearchParams,AbortSignal,setTimeout:fn=>{timers.push(fn);return timers.length;},clearTimeout(){},Unit501SharedUI:{timeCentral:iso=>iso}};context.window=context;
 context.fetch=async url=>{calls.push(url);
  if(String(url).startsWith('/api/nba/player-history?'))return {ok:true,json:async()=>({gameId:game.id,tipoff:game.tipoff,checkedAt:clock,teams:[
   {available:true,players:[{name:'Player A',results:[{gameId:1,tipoff:'2026-10-23T00:00:00Z',player_points:25},{gameId:2,tipoff:'2026-10-21T00:00:00Z',player_points:22}]}]},
   {available:true,players:[{name:'Player B',results:[{gameId:3,tipoff:'2026-10-23T00:00:00Z',player_rebounds:10},{gameId:4,tipoff:'2026-10-21T00:00:00Z',player_rebounds:8}]}]}]})};
  return {ok:true,json:async()=>data(game,String(url).includes('/props?'))};};
 vm.createContext(context);vm.runInContext(fs.readFileSync(require.resolve('../public/player-controls.js'),'utf8'),context);vm.runInContext(fs.readFileSync(require.resolve('../public/unit501-shared-ui.js'),'utf8'),context);vm.runInContext(fs.readFileSync(require.resolve('../public/last-opponent.js'),'utf8'),context);vm.runInContext(fs.readFileSync(require.resolve('../public/star-power.js'),'utf8'),context);vm.runInContext(fs.readFileSync(require.resolve('../public/nba-player-model.js'),'utf8'),context);vm.runInContext(fs.readFileSync(require.resolve('../public/nba-rotation-context.js'),'utf8'),context);vm.runInContext(fs.readFileSync(require.resolve('../public/basketball-history-comparison.js'),'utf8'),context);vm.runInContext(fs.readFileSync(require.resolve('../public/nba-markets.js'),'utf8'),context);
 const settle=()=>new Promise(resolve=>setImmediate(resolve));
 return {nodes,context,calls,timers,game,data,settle,select:async(g=game)=>{context.Unit501NBAMarkets.select(g,'2026-10-24');await settle();},advance:ms=>{clock+=ms;}};
}
test('NBA game lines load on selection, props load on demand, and stat/name filters make no feed calls',async()=>{
 const h=harness();await h.select();
 assert.equal(h.calls.length,1);assert.match(h.nodes.get('nba-game-odds').textContent,/Clippers \+3.5.*Bulls -3.5.*225.5/);
 assert.equal(h.nodes.get('nba-prop-lines').textContent,'');
 await h.nodes.get('nba-load-props').events.click();assert.equal(h.calls.length,3);
 assert.match(h.nodes.get('nba-prop-lines').textContent,/Player A.*Player B/);
 const stat=h.nodes.get('nba-prop-market');stat.value='player_points';stat.events.change();
 assert.match(h.nodes.get('nba-prop-lines').textContent,/Player A/);assert.doesNotMatch(h.nodes.get('nba-prop-lines').textContent,/Player B/);
 const name=h.nodes.get('nba-prop-search');name.value='unmatched';name.events.input();
 assert.match(h.nodes.get('nba-prop-lines').textContent,/No current/);assert.equal(h.calls.length,3);
});
test('NBA quote display expires stale prices locally without polling the odds API',async()=>{
 const h=harness();await h.select();await h.nodes.get('nba-load-props').events.click();
 h.advance(1800001);h.timers.at(-1)();
 assert.match(h.nodes.get('nba-game-odds').textContent,/No current paired/);
 assert.doesNotMatch(h.nodes.get('nba-game-odds').textContent,/225.5/);
 assert.match(h.nodes.get('nba-prop-lines').textContent,/No current/);assert.equal(h.calls.length,3);
});
test('NBA quote failure keeps fresh prior quotes and wrong-game responses cannot overwrite them',async()=>{
 const h=harness();await h.select();
 h.context.fetch=async()=>({ok:false,json:async()=>({error:'Quota unavailable'})});
 await h.nodes.get('nba-refresh-odds').events.click();assert.match(h.nodes.get('nba-odds-status').textContent,/Quota unavailable/);
 assert.match(h.nodes.get('nba-game-odds').textContent,/225.5/);
 h.context.fetch=async()=>({ok:true,json:async()=>({...h.data(h.game,false),gameId:900})});
 await h.nodes.get('nba-refresh-odds').events.click();assert.match(h.nodes.get('nba-odds-status').textContent,/matchup could not be verified/);
 h.context.Unit501NBAMarkets.clear();assert.equal(h.nodes.get('nba-game-odds').textContent,'');assert.equal(h.nodes.get('nba-prop-lines').textContent,'');
});

test('late NBA game and prop requests are discarded after switching matchups',async()=>{
 const h=harness();let releaseGame,releaseProps;
 h.context.fetch=url=>new Promise(resolve=>{
  const finish=()=>resolve({ok:true,json:async()=>h.data(h.game,String(url).includes('/props?'))});
  if(String(url).includes('/props?'))releaseProps=finish;else releaseGame=finish;
 });
 await h.select();const pendingProps=h.nodes.get('nba-load-props').events.click();
 const next={...h.game,id:900,away:'Cavaliers',home:'Celtics'};
 h.context.fetch=async url=>({ok:true,json:async()=>h.data(next,String(url).includes('/props?'))});
 await h.select(next);await h.nodes.get('nba-load-props').events.click();
 releaseGame();releaseProps();await pendingProps;await h.settle();
 assert.match(h.nodes.get('nba-game-odds').textContent,/Cavaliers.*Celtics/);
 assert.doesNotMatch(h.nodes.get('nba-game-odds').textContent,/Clippers|Bulls/);
 assert.match(h.nodes.get('nba-prop-lines').textContent,/Player A/);
});

function comparisonData(h,g=h.game){
 const lines=h.data(g,false);
 return {...lines,bookmaker:'Multiple',books:[
  {key:'fanduel',name:'FanDuel',moneyline:{away:150,home:-175,updatedAt:lines.spread.updatedAt},spread:lines.spread,total:lines.total},
  {key:'draftkings',name:'DraftKings',moneyline:{away:160,home:-180,updatedAt:lines.spread.updatedAt},spread:null,total:null},
  {key:'betmgm',name:'BetMGM',moneyline:null,spread:null,total:lines.total}
 ]};
}
test('NBA comparison loads only on request, displays both moneylines and book-specific markets, and expires without polling',async()=>{
 const h=harness();await h.select();
 assert.equal(h.calls.length,1);assert.equal(h.nodes.get('nba-book-comparison').textContent,'');
 h.context.fetch=async url=>{h.calls.push(url);return {ok:true,json:async()=>comparisonData(h)};};
 await h.nodes.get('nba-compare-odds').events.click();
 assert.equal(h.calls.length,2);assert.match(h.calls[1],/\/api\/nba\/comparison\?/);
 const text=h.nodes.get('nba-book-comparison').textContent;
 assert.match(text,/Clippers moneyline.*Bulls moneyline/);
 assert.match(text,/FanDuel.*\+150.*-175.*DraftKings.*\+160.*-180.*BetMGM/);
 assert.match(text,/Unavailable/);assert.match(text,/Updated/);
 h.advance(1800001);h.timers.at(-1)();
 assert.doesNotMatch(h.nodes.get('nba-book-comparison').textContent,/\+150|\+160|225.5/);
 assert.equal(h.calls.length,2);
});
test('NBA comparison failures preserve only fresh quotes and reject mismatched or duplicate books',async()=>{
 const h=harness();await h.select();const data=comparisonData(h);
 h.context.fetch=async()=>({ok:true,json:async()=>data});
 await h.nodes.get('nba-compare-odds').events.click();
 h.context.fetch=async()=>({ok:false,json:async()=>({error:'Quota unavailable'})});
 await h.nodes.get('nba-compare-odds').events.click();
 assert.match(h.nodes.get('nba-comparison-status').textContent,/Quota unavailable/);
 assert.match(h.nodes.get('nba-book-comparison').textContent,/\+150/);
 for(const bad of [{...data,gameId:900},{...data,tipoff:'2026-10-25T23:00:00Z'},
   {...data,books:[...data.books,data.books[0]]},{...data,books:[{key:'unknown'}]}]){
  h.context.fetch=async()=>({ok:true,json:async()=>bad});
  await h.nodes.get('nba-compare-odds').events.click();
  assert.match(h.nodes.get('nba-comparison-status').textContent,/could not be verified/);
 }
 h.advance(1800001);h.context.fetch=async()=>({ok:false,json:async()=>({error:'unavailable'})});
 await h.nodes.get('nba-compare-odds').events.click();
 assert.doesNotMatch(h.nodes.get('nba-book-comparison').textContent,/\+150/);
 h.context.Unit501NBAMarkets.clear();assert.equal(h.nodes.get('nba-book-comparison').textContent,'');
 assert.equal(h.nodes.get('nba-compare-odds').disabled,true);
});
test('late NBA comparison response cannot populate a different matchup',async()=>{
 const h=harness();await h.select();const old=comparisonData(h);let release;
 h.context.fetch=()=>new Promise(resolve=>{release=()=>resolve({ok:true,json:async()=>old});});
 const pending=h.nodes.get('nba-compare-odds').events.click();
 const next={...h.game,id:900,away:'Cavaliers',home:'Celtics'};
 h.context.fetch=async()=>({ok:true,json:async()=>h.data(next,false)});
 await h.select(next);release();await pending;await h.settle();
 assert.equal(h.nodes.get('nba-book-comparison').textContent,'');
 assert.match(h.nodes.get('nba-comparison-status').textContent,/no comparison request has been made/);
 assert.equal(h.nodes.get('nba-compare-odds').disabled,false);
});

test('upset classification only receives fresh paired spread for the selected matchup',async()=>{
 const h=harness();await h.select();
 const market=h.context.Unit501NBAMarkets;
 assert.equal(market.spreadFor(h.game),3.5);
 assert.equal(market.spreadFor({...h.game,id:'other'}),null);
 assert.equal(market.spreadFor({...h.game,tipoff:'2026-10-25T01:00:00Z'}),null);
 h.advance(1800001);assert.equal(market.spreadFor(h.game),null);
 market.clear();assert.equal(market.spreadFor(h.game),null);
});

test('NBA simulation reuses only fresh, matching market lines',async()=>{
 const h=harness();await h.select();
 const market=h.context.Unit501NBAMarkets,values=market.linesFor(h.game);
 assert.equal(values.awaySpread,3.5);assert.equal(values.total,225.5);
 assert.equal(market.linesFor({...h.game,id:900}).awaySpread,undefined);
 h.advance(1800001);
 assert.equal(market.linesFor(h.game).awaySpread,null);assert.equal(market.linesFor(h.game).total,null);
});

test('official injury statuses highlight matching props and withdraw on expiry or mismatch',async()=>{
 const h=harness();await h.select();await h.nodes.get('nba-load-props').events.click();
 const market=h.context.Unit501NBAMarkets;
 const report={gameId:h.game.id,tipoff:h.game.tipoff,reportAt:Date.parse('2026-10-24T20:00:00Z'),teams:[
  {available:true,players:[{name:'Player A',status:'Out'}]},{available:true,players:[]}]};
 market.setInjuries(h.game,report);assert.match(h.nodes.get('nba-prop-lines').textContent,/Player A · OUT/);
 market.setInjuries({...h.game,id:900},null);assert.match(h.nodes.get('nba-prop-lines').textContent,/Player A · OUT/);
 report.teams[1].players.push({name:'Player A',status:'Out'});market.setInjuries(h.game,report);
 assert.doesNotMatch(h.nodes.get('nba-prop-lines').textContent,/Player A · OUT/);
 report.teams[1].players=[];market.setInjuries(h.game,report);h.advance(7200001);h.timers.at(-1)();
 assert.doesNotMatch(h.nodes.get('nba-prop-lines').textContent,/Player A · OUT/);
});

test('NBA props show recent baselines, cover counts, sorting and OUT suppression',async()=>{
 const h=harness();await h.select();await h.nodes.get('nba-load-props').events.click();await h.settle();await h.settle();
 let text=h.nodes.get('nba-prop-lines').textContent;
 assert.match(text,/Player A.*Points.*20\.5.*23\.5.*Above 2\/2 100.0% Below 0\/2/);
 assert.match(text,/Player B.*Rebounds.*9\.5.*9\.0.*Above 1\/2 50.0% Below 1\/2/);
 assert.doesNotMatch(text,/Last 2:/);
 const count=h.calls.length,sort=h.nodes.get('nba-prop-sort');sort.value='least';sort.events.change();
 text=h.nodes.get('nba-prop-lines').textContent;assert.ok(text.indexOf('Player B')<text.indexOf('Player A'));
 sort.value='most';sort.events.change();text=h.nodes.get('nba-prop-lines').textContent;assert.ok(text.indexOf('Player A')<text.indexOf('Player B'));
 sort.value='below-asc';sort.events.change();text=h.nodes.get('nba-prop-lines').textContent;assert.ok(text.indexOf('Player A')<text.indexOf('Player B'));assert.match(text,/3 above/);assert.match(text,/0.5 below/);
 assert.equal(h.calls.length,count);
 h.context.Unit501NBAMarkets.setInjuries(h.game,{gameId:h.game.id,tipoff:h.game.tipoff,reportAt:Date.parse('2026-10-24T20:00:00Z'),teams:[{available:true,players:[{name:'Player A',status:'Out'}]},{available:true,players:[]}]});
 assert.match(h.nodes.get('nba-prop-lines').textContent,/Player A · OUT.*Points.*20\.5.*OUT/);
 assert.doesNotMatch(h.nodes.get('nba-prop-lines').textContent,/Player A · OUT.*23\.5/);
});

test('an OUT teammate shows verified past splits without changing the player projection',async()=>{
 const h=harness();await h.select();const clock=Date.parse('2026-10-24T20:00:00Z');
 const rows=[1,2,3,4].map((id)=>({gameId:id,tipoff:`2026-10-${18+id}T00:00:00Z`,player_points:id<3?10:20,minutes:id<3?20:40}));
 h.context.fetch=async url=>({ok:true,json:async()=>String(url).startsWith('/api/nba/player-history?')?{
  gameId:h.game.id,tipoff:h.game.tipoff,checkedAt:clock,teams:[
   {name:'LA Clippers',available:true,players:[{id:'1',name:'Player A',results:rows},{id:'2',name:'Player C',results:rows.slice(0,2),inactive:rows.slice(2).map(r=>({gameId:r.gameId,tipoff:r.tipoff}))}]},
   {name:'Chicago Bulls',available:true,players:[]}]}:h.data(h.game,true)});
 await h.nodes.get('nba-load-props').events.click();await h.settle();await h.settle();
 const before=h.nodes.get('nba-prop-lines').textContent;assert.match(before,/Player A.*15\.8/);
 h.context.Unit501NBAMarkets.setInjuries(h.game,{gameId:h.game.id,tipoff:h.game.tipoff,reportAt:clock,teams:[{name:'LA Clippers',available:true,players:[{name:'Player C',status:'Out'}]},{name:'Chicago Bulls',available:true,players:[]}]});
 const selectA=h.nodes.get('nba-prop-player');selectA.value='Player A';selectA.events.change();
 const after=h.nodes.get('nba-prop-lines').textContent;assert.doesNotMatch(after,/minutes scenario/);assert.match(after,/Player C didn't play: 20\.0 in 2 games.*played: 10\.0 in 2/);
 assert.match(after,/Player A.*15\.8/);
 const board=h.nodes.get('nba-prop-lines'),flatten=n=>[n,...n.children.flatMap(flatten)];
 const button=()=>flatten(board).find(n=>n.textContent==='Try 40.0 minutes without Player C');
 assert.ok(button());const calls=h.calls.length;button().events.click();
 assert.match(board.textContent,/Player A.*20\.0/);
 assert.match(board.textContent,/Teammate absence minutes scenario · baseline 15\.8 · change \+4\.2/);
 assert.match(board.textContent,/0 \(0.0%\) 4 \(100.0%\) 0 \(0.0%\) 4/);assert.equal(h.calls.length,calls);
 flatten(board).find(n=>n.textContent==='Reset minutes').events.click();
 assert.match(board.textContent,/Player A.*15\.8/);assert.doesNotMatch(board.textContent,/minutes scenario/);
 button().events.click();
 h.context.Unit501NBAMarkets.setInjuries(h.game,null);
 assert.match(board.textContent,/Player A.*15\.8/);assert.doesNotMatch(board.textContent,/minutes scenario/);

});

async function scenarioHarness(reportAge=0){
 const h=harness();await h.select();const clock=Date.parse('2026-10-24T20:00:00Z');
 const rows=[1,2,3,4].map(id=>({gameId:id,tipoff:`2026-10-${18+id}T00:00:00Z`,player_points:id<3?10:20,player_rebounds:id<3?5:10,minutes:id<3?20:40}));
 h.history={gameId:h.game.id,tipoff:h.game.tipoff,checkedAt:clock,teams:[
  {name:'LA Clippers',available:true,players:[{name:'Player A',results:rows},{name:'Player C',results:rows.slice(0,2),inactive:rows.slice(2).map(r=>({gameId:r.gameId,tipoff:r.tipoff}))}]},
  {name:'Chicago Bulls',available:true,players:[]}]};
 h.report={gameId:h.game.id,tipoff:h.game.tipoff,reportAt:clock-reportAge,teams:[
  {name:'LA Clippers',available:true,players:[{name:'Player C',status:'Out'}]},
  {name:'Chicago Bulls',available:true,players:[]}]};
 h.context.fetch=async url=>{h.calls.push(url);const data=h.data(h.game,true);data.props[1].name='Player A';
  return {ok:true,json:async()=>String(url).startsWith('/api/nba/player-history?')?h.history:data};};
 await h.nodes.get('nba-load-props').events.click();await h.settle();await h.settle();
 h.context.Unit501NBAMarkets.setInjuries(h.game,h.report);
 h.board=h.nodes.get('nba-prop-lines');const flatten=n=>[n,...n.children.flatMap(flatten)];
 h.inputs=()=>flatten(h.board).filter(n=>n.type==='number');
 h.button=text=>flatten(h.board).find(n=>n.textContent===text);
 return h;
}
test('NBA absence scenario expires locally and cannot be reapplied from an old control',async()=>{
 const h=await scenarioHarness(7190000),calls=h.calls.length;
 const selectA=h.nodes.get('nba-prop-player');selectA.value='Player A';selectA.events.change();
 const oldButton=h.button('Try 40.0 minutes without Player C');oldButton.events.click();
 assert.deepEqual(h.inputs().map(n=>n.value),[40,40]);
 h.advance(10001);h.timers.at(-1)();
 assert.doesNotMatch(h.board.textContent,/minutes scenario|Try 40/);
 assert.deepEqual(h.inputs().map(n=>n.value),[]);
 assert.match(h.board.textContent,/Player injury match unverified/);
 oldButton.events.click();assert.doesNotMatch(h.board.textContent,/minutes scenario/);
 // A refreshed report must not silently restore an expired selection.
 h.report.reportAt+=10001;h.context.Unit501NBAMarkets.setInjuries(h.game,h.report);
 assert.ok(h.button('Try 40.0 minutes without Player C'));
 assert.deepEqual(h.inputs().map(n=>n.value),['','']);assert.equal(h.calls.length,calls);
});
test('NBA shared player minutes survive filters, reset together and detach from injury evidence when edited',async()=>{
 const h=await scenarioHarness(),calls=h.calls.length;
 const selectA=h.nodes.get('nba-prop-player');selectA.value='Player A';selectA.events.change();
 h.button('Try 40.0 minutes without Player C').events.click();
 assert.deepEqual(h.inputs().map(n=>n.value),[40,40]);
 assert.match(h.board.textContent,/Points.*?20\.5.*?20\.0Projection/);
 assert.match(h.board.textContent,/Rebounds.*?9\.5.*?10\.0Projection/);
 const filter=h.nodes.get('nba-prop-market');filter.value='player_rebounds';filter.events.change();
 assert.deepEqual(h.inputs().map(n=>n.value),[40]);
 h.button('Reset minutes').events.click();filter.value='';filter.events.change();
 assert.deepEqual(h.inputs().map(n=>n.value),['','']);
 h.button('Try 40.0 minutes without Player C').events.click();
 const input=h.inputs()[1];input.value='36';input.events.change();
 assert.deepEqual(h.inputs().map(n=>n.value),[36,36]);
 h.context.Unit501NBAMarkets.setInjuries(h.game,null);
 assert.deepEqual(h.inputs().map(n=>n.value),[36,36]); // Player detail stays scoped to the selection.
 assert.match(h.board.textContent,/Manual minutes scenario/);
 assert.doesNotMatch(h.board.textContent,/Teammate absence minutes scenario/);
 assert.equal(h.calls.length,calls);
 await h.select();await h.nodes.get('nba-load-props').events.click();await h.settle();
 assert.deepEqual(h.inputs().map(n=>n.value),[]); // New game returns to the compact board.
});

test('late player history cannot replace the new matchup projection',async()=>{
 const h=harness();await h.select();let release;
 const historyFor=(game,value)=>({gameId:game.id,tipoff:game.tipoff,checkedAt:Date.parse('2026-10-24T20:00:00Z'),teams:[
  {available:true,players:[{name:'Player A',results:[{gameId:1,tipoff:'2026-10-23T00:00:00Z',player_points:value},{gameId:2,tipoff:'2026-10-21T00:00:00Z',player_points:value}]}]},
  {available:true,players:[]}]});
 h.context.fetch=url=>String(url).startsWith('/api/nba/player-history?')?new Promise(resolve=>{release=()=>resolve({ok:true,json:async()=>historyFor(h.game,99)});}):Promise.resolve({ok:true,json:async()=>h.data(h.game,true)});
 await h.nodes.get('nba-load-props').events.click();await h.settle();
 const next={...h.game,id:900,away:'Cavaliers',home:'Celtics'};
 h.context.fetch=async url=>({ok:true,json:async()=>String(url).startsWith('/api/nba/player-history?')?historyFor(next,12):h.data(next,String(url).includes('/props?'))});
 await h.select(next);await h.nodes.get('nba-load-props').events.click();await h.settle();
 release();await h.settle();await h.settle();
 assert.match(h.nodes.get('nba-prop-lines').textContent,/Player A.*12\.0/);
 assert.doesNotMatch(h.nodes.get('nba-prop-lines').textContent,/99\.0/);
});


test('NBA minutes controls update estimates locally and clear when changing matchups',async()=>{
 const h=harness(),original=h.context.fetch;
 h.context.fetch=async url=>{
  const response=await original(url);
  if(!String(url).startsWith('/api/nba/player-history?'))return response;
  const d=await response.json();for(const t of d.teams)for(const p of t.players)for(const r of p.results)r.minutes=30;
  return {ok:true,json:async()=>d};
 };
 await h.select();await h.nodes.get('nba-load-props').events.click();await h.settle();
 const board=h.nodes.get('nba-prop-lines'),flatten=n=>[n,...n.children.flatMap(flatten)];
 const selectA=h.nodes.get('nba-prop-player');selectA.value='Player A';selectA.events.change();
 let input=flatten(board).find(n=>n.type==='number');assert.ok(input);assert.equal(input.placeholder,'30.0');
 const calls=h.calls.length;input.value='40';input.events.change();
 assert.match(board.textContent,/manual minutes/);assert.equal(h.calls.length,calls);
 input=flatten(board).find(n=>n.type==='number');assert.equal(input.value,40);
 input.value='';input.events.change();assert.doesNotMatch(board.textContent,/manual minutes/);
 await h.select();await h.nodes.get('nba-load-props').events.click();await h.settle();
 assert.doesNotMatch(board.textContent,/manual minutes/);
});

test('missing NBA moneyline and history are labeled explicitly',async()=>{
 const h=harness();await h.select();
 assert.match(h.nodes.get('nba-game-odds').textContent,/Moneyline.*No current paired moneyline available/);
 assert.match(h.nodes.get('nba-game-odds').textContent,/Line history unavailable; movement is unknown/);
 assert.doesNotMatch(h.nodes.get('nba-game-odds').textContent,/unchanged/);
});

test('NBA Above sorting compares percentages rather than raw hit counts',async()=>{
 const h=harness(),base=h.context.fetch;
 h.context.fetch=async url=>{const r=await base(url);if(!String(url).includes('/player-history?'))return r;
 const data=await r.json();data.teams[1].players[0].results=Array.from({length:6},(_,i)=>({gameId:10+i,tipoff:`2026-10-${22-i}T00:00:00Z`,player_rebounds:i<3?10:0}));
 return {ok:true,json:async()=>data};};
 await h.select();await h.nodes.get('nba-load-props').events.click();await h.settle();await h.settle();
 const sort=h.nodes.get('nba-prop-sort');sort.value='most';sort.events.change();let text=h.nodes.get('nba-prop-lines').textContent;
 assert.ok(text.indexOf('Player A')<text.indexOf('Player B'),'2/2 ranks above 3/6');assert.match(text,/100.0%/);
 sort.value='least';sort.events.change();text=h.nodes.get('nba-prop-lines').textContent;assert.ok(text.indexOf('Player B')<text.indexOf('Player A'));
});

test('exact NBA player selection shows only that player and preserves catalog order without requests',async()=>{
 const h=harness();await h.select();
 const original=h.context.fetch;h.context.fetch=async url=>{
  if(!String(url).includes('/props?'))return original(url);
  h.calls.push(url);const d=h.data(h.game,true),p=d.props[0];
  d.props=[{...p,market:'player_assists',label:'Assists'},d.props[1],{...p,market:'player_points',label:'Points'},{...p,market:'player_rebounds',label:'Rebounds'}];
  return {ok:true,json:async()=>d};
 };
 await h.nodes.get('nba-load-props').events.click();
 const player=h.nodes.get('nba-prop-player'),before=h.calls.length;player.value='Player A';player.events.change();
 const text=h.nodes.get('nba-prop-lines').textContent;assert.doesNotMatch(text,/Player B/);assert.match(text,/Last vs opponent/);
 assert.ok(text.indexOf('Points')<text.indexOf('Rebounds'));assert.ok(text.indexOf('Rebounds')<text.indexOf('Assists'));
 assert.equal(h.calls.length,before);h.context.Unit501NBAMarkets.clear();assert.equal(player.value,'');
});

test('NBA manual scenarios update a player across markets and reset on game selection',async()=>{
 const h=await scenarioHarness(),calls=h.calls.length;
 const flatten=n=>[n,...n.children.flatMap(flatten)];
 const player=h.nodes.get('nba-prop-player');
 const switchFor=key=>flatten(h.nodes.get('scenario-picker')).find(n=>n.id==='scenario-'+key);
 const toggle=(key,on)=>{const el=switchFor(key);el.checked=on;el.events.change();};
 toggle('boost',true);
 assert.doesNotMatch(h.board.textContent,/Manual, uncalibrated/);
 player.value='Player A';player.events.change();assert.equal(switchFor('boost').checked,true);
 player.value='Player C';player.events.change();assert.equal(switchFor('boost').checked,false);
 player.value='Player A';player.events.change();
 assert.match(h.board.textContent,/Manual, uncalibrated/);
 const projection=h.board.textContent;
 toggle('boost',true);assert.equal(h.board.textContent,projection);
 toggle('off',true);assert.doesNotMatch(h.board.textContent,/Manual, uncalibrated/);
 assert.equal(h.calls.length,calls);
 toggle('defense',true);
 await h.select();await h.nodes.get('nba-load-props').events.click();
 player.value='Player A';player.events.change();assert.equal(switchFor('off').checked,true);
});

test('NBA prop display carries suffix-formatted Out and conflicting identities into projection gating',async()=>{
 const h=harness();await h.select();await h.nodes.get('nba-load-props').events.click();
 const report={gameId:h.game.id,tipoff:h.game.tipoff,reportAt:Date.parse('2026-10-24T20:00:00Z'),teams:[{available:true,players:[{name:'Player A Jr.',status:'OUT'}]},{available:true,players:[]}]};
 h.context.Unit501NBAMarkets.setInjuries(h.game,report);
 assert.match(h.nodes.get('nba-prop-lines').textContent,/Player A · OUT/);
 report.teams[1].players.push({name:'Player A',status:'Active'});
 h.context.Unit501NBAMarkets.setInjuries(h.game,report);
 assert.match(h.nodes.get('nba-prop-lines').textContent,/Player injury match unverified/);
});

test('NBA history comparison survives odds failure and never invents a quote',async()=>{
 const h=harness();await h.select();const base=h.context.fetch;
 h.context.fetch=async url=>String(url).includes('/props?')?{ok:false,json:async()=>({error:'Odds unavailable'})}:base(url);
 await h.nodes.get('nba-load-props').events.click();await h.settle();
 const panel=h.nodes.get('nba-history-comparison');assert.match(panel.textContent,/no betting line needed/);
 const walk=n=>[n,...n.children.flatMap(walk)];const nodes=walk(panel),controls=nodes.filter(n=>n.events.change);
 controls[0].value='Player A';controls[0].events.change();
 const input=nodes.find(n=>n.events.input);input.value='22';input.events.input();
 assert.match(panel.textContent,/1 above · 0 below · 1 equal · 2 verified appearances/);
 assert.match(h.nodes.get('nba-props-status').textContent,/Odds unavailable/);
 assert.match(h.nodes.get('nba-prop-lines').textContent,/Line unavailable.*23.5/);
 assert.match(h.nodes.get('nba-prop-lines').textContent,/0 betting lines/);
 assert.doesNotMatch(h.nodes.get('nba-prop-lines').textContent,/100.0%/);
 h.context.Unit501NBAMarkets.clear();assert.equal(panel.textContent,'');
});
