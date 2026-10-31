'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function setup(quotes={}){
 const nodes=new Map(),requests=[],timers=[];let clock=Date.now();
 class E{setAttribute(k,v){this[k]=v;}constructor(){this.children=[];this.events={};this.value='';this._text='';this.classList={add(){},remove(){}};}set textContent(v){this._text=String(v);this.children=[];}get textContent(){return this._text+this.children.map(x=>x.textContent).join(' ');}append(...x){this.children.push(...x);}replaceChildren(...x){this._text='';this.children=x;}addEventListener(k,f){this.events[k]=f;}}
 const html=fs.readFileSync(require.resolve('../public/ncaab.html'),'utf8');for(const x of html.matchAll(/id="([^"]+)"/g))nodes.set(x[1],new E());
 const future=new Date(Date.now()+86400000).toISOString(),game={id:'10',awayId:'1',homeId:'2',away:'Away',home:'Home',tipoff:future,timeKnown:true,status:'Scheduled',stage:2,neutral:false};
 const rec={games:5,scored:80,allowed:70,wins:3,losses:2};const side=(id,name)=>({id,name,season:rec,recent5:rec,recent10:rec,recentGames:Array.from({length:5},(_,i)=>({id:String(i+1),tipoff:new Date(Date.now()-86400000*(i+1)).toISOString(),opponent:'Opponent',scored:80,allowed:70,venue:'home'}))});
 const data={checkedAt:clock,gameId:'10',tipoff:future,away:side('1','Away'),home:side('2','Home'),source:'ESPN'};
 const document={getElementById:id=>nodes.get(id),createElement:()=>new E()},context={document,Date:class extends Date{static now(){return clock;}},Intl,URLSearchParams,AbortSignal,setTimeout:(fn,delay)=>{timers.push({fn,delay});return timers.length;},clearTimeout(){}};context.window=context;
 context.fetch=async url=>{requests.push(url);return {ok:true,json:async()=>String(url).includes('/games?')?{source:'ESPN',games:[game]}:String(url).includes('/odds?')?{...data,bookmaker:'FanDuel',...quotes}:data};};
 vm.createContext(context);for(const p of ['unit501-shared-ui.js','star-power.js','nba-player-model.js','market-pulse.js','ncaab-model.js','ncaab.js'])vm.runInContext(fs.readFileSync(require.resolve('../public/'+p),'utf8'),context);
 const settle=()=>new Promise(r=>setImmediate(r));return {nodes,game,data,requests,settle,context,timers,advance:ms=>{clock+=ms;},now:()=>clock};
}
test('college slate loads, selects a game, displays form and simulates manual lines',async()=>{
 const h=setup();h.nodes.get('ncaab-scope').value='season';await h.nodes.get('ncaab-load').events.click();assert.equal(h.nodes.get('ncaab-games').children.length,1);
 await h.nodes.get('ncaab-games').children[0].events.click();await h.settle();assert.match(h.nodes.get('ncaab-prediction').textContent,/Away 75.0.*Home 75.0/);
 assert.match(h.nodes.get('ncaab-teams').textContent,/5 recorded games.*3–2/);
 h.nodes.get('ncaab-spread').value='0';h.nodes.get('ncaab-spread').events.input();h.nodes.get('ncaab-total').value='150';h.nodes.get('ncaab-total').events.input();h.nodes.get('ncaab-sim').events.click();assert.match(h.nodes.get('ncaab-simulation').textContent,/tie 100.0%.*spread push 100.0%.*total push 100.0%/);
});
test('TBD tipoffs do not request history or create predictions',async()=>{
 const h=setup();h.game.timeKnown=false;await h.nodes.get('ncaab-load').events.click();await h.nodes.get('ncaab-games').children[0].events.click();assert.match(h.nodes.get('ncaab-context-status').textContent,/not confirmed/);assert.equal(h.requests.length,1);
});

test('college missing markets and unrecorded movement are disclosed',async()=>{
 const h=setup();await h.nodes.get('ncaab-load').events.click();await h.nodes.get('ncaab-games').children[0].events.click();await h.settle();
 assert.match(h.nodes.get('ncaab-odds-status').textContent,/Spread unavailable.*Total unavailable/);
 assert.match(h.nodes.get('ncaab-line-history').textContent,/No verified FanDuel observations yet/);
});

test('college quotes show moneylines and recorded movement without labeling them opening lines',async()=>{
 const h=setup({message:'Loaded',spread:{away:4,home:-4,updatedAt:Date.now()},total:{line:145,updatedAt:Date.now()},moneyline:{away:125,home:-145,updatedAt:Date.now()},history:{spread:{firstLine:3,line:4,firstAt:1,lastAt:2},total:{firstLine:145,line:145,firstAt:1,lastAt:1}}});
 await h.nodes.get('ncaab-load').events.click();await h.nodes.get('ncaab-games').children[0].events.click();await h.settle();
 assert.match(h.nodes.get('ncaab-odds-status').textContent,/Away \+125 \/ Home -145/);
 assert.match(h.nodes.get('ncaab-line-history').textContent,/toward Home/);
 assert.match(h.nodes.get('ncaab-line-history').textContent,/waiting for another observation/);
 assert.match(h.nodes.get('ncaab-line-history').textContent,/not the sportsbook opening line/);
});

test('college odds displays server error and old props cannot unlock a newer request',async()=>{
 const h=setup(),base=h.context.fetch,pending=[];
 h.context.fetch=async url=>{
  if(String(url).includes('/odds?'))return {ok:false,json:async()=>({error:'Monthly odds credits exhausted.'})};
  if(String(url).includes('/props?'))return new Promise(resolve=>pending.push(resolve));
  return base(url);
 };
 await h.nodes.get('ncaab-load').events.click();
 const select=h.nodes.get('ncaab-games').children[0].events.click;
 await select();await h.settle();
 assert.equal(h.nodes.get('ncaab-odds-status').textContent,'Monthly odds credits exhausted.');
 const button=h.nodes.get('ncaab-load-props'),old=button.events.click();
 assert.equal(button.disabled,true);
 await select();assert.equal(button.disabled,false);
 const current=button.events.click();assert.equal(button.disabled,true);
 pending[0]({ok:false,json:async()=>({error:'Old failure'})});await old;
 assert.equal(button.disabled,true);
 assert.doesNotMatch(h.nodes.get('ncaab-props-status').textContent,/Old failure/);
 pending[1]({ok:false,json:async()=>({error:'Current quota failure'})});await current;
 assert.equal(button.disabled,false);
 assert.equal(h.nodes.get('ncaab-props-status').textContent,'Current quota failure');
});

test('college props sort by percentage, filter exact player, and suppress stale quotes',async()=>{
 const h=setup();await h.nodes.get('ncaab-load').events.click();await h.nodes.get('ncaab-games').children[0].events.click();await h.settle();
 const at=h.now(),q=(name,market)=>({name,market,label:market,line:10.5,updatedAt:at});
 const quotes=[q('A','player_assists'),q('B','player_points'),q('A','player_points'),{...q('Expired','player_points'),updatedAt:at-1800001}];
 h.context.Unit501NBAPlayerModel={availabilityNote:h.context.Unit501NBAPlayerModel.availabilityNote,injuryStatus:h.context.Unit501NBAPlayerModel.injuryStatus,withScenario:h.context.Unit501NBAPlayerModel.withScenario,project:(history,q)=>({available:true,projection:12,median:11,average:11,above:q.name==='A'?1:3,below:q.name==='A'?0:3,equal:0,games:q.name==='A'?1:6,recentValues:[12],projectedMinutes:20})};
 h.context.fetch=async url=>({ok:true,json:async()=>({gameId:h.game.id,tipoff:h.game.tipoff,message:'Loaded',teams:[],props:String(url).includes('/props?')?quotes:[]})});
 await h.nodes.get('ncaab-load-props').events.click();
 const board=h.nodes.get('ncaab-props'),sort=h.nodes.get('ncaab-prop-sort');sort.value='most';sort.events.change();
 assert.ok(board.textContent.indexOf('A ·')<board.textContent.indexOf('B ·'));assert.doesNotMatch(board.textContent,/Expired/);
 sort.value='least';sort.events.change();assert.ok(board.textContent.indexOf('B ·')<board.textContent.indexOf('A ·'));
 const player=h.nodes.get('ncaab-prop-player');player.value='A';player.events.change();assert.doesNotMatch(board.textContent,/B ·/);
 assert.ok(board.textContent.indexOf('player_points')<board.textContent.indexOf('player_assists'));
 assert.match(board.textContent,/Movement unknown/);
 const flatten=n=>[n,...n.children.flatMap(flatten)];
 const controls=()=>flatten(board).filter(n=>n.children.length===4&&n.children[0].value==='off');
 controls()[0].value='boost';controls()[0].events.change();
 assert.deepEqual(controls().map(n=>n.value),['boost','boost']);
 assert.match(board.textContent,/13.2/);assert.match(board.textContent,/Manual, uncalibrated/);
 controls()[0].value='fatigue';controls()[0].events.change();assert.match(board.textContent,/11.4/);
 controls()[0].value='off';controls()[0].events.change();assert.doesNotMatch(board.textContent,/Manual, uncalibrated/);
 assert.match(board.textContent,/100.0%/);
});

test('college history gap displays warning and withholds projection, simulation and inferred rest',async()=>{
 const h=setup(),original=h.context.fetch;
 h.context.fetch=async url=>{const r=await original(url);if(!String(url).includes('/context?'))return r;const d=await r.json();d.away.unverifiedGames=1;d.home.unverifiedGames=1;return {ok:true,json:async()=>d};};
 h.nodes.get('ncaab-scope').value='season';await h.nodes.get('ncaab-load').events.click();await h.nodes.get('ncaab-games').children[0].events.click();await h.settle();
 assert.match(h.nodes.get('ncaab-teams').textContent,/History incomplete/);
 assert.doesNotMatch(h.nodes.get('ncaab-teams').textContent,/full day\(s\) off/);
 assert.match(h.nodes.get('ncaab-prediction').textContent,/withheld/);
 h.nodes.get('ncaab-sim').events.click();assert.doesNotMatch(h.nodes.get('ncaab-simulation').textContent,/%/);
});

test('college player estimates expire with history even while quote remains fresh',async()=>{
 const h=setup();await h.nodes.get('ncaab-load').events.click();await h.nodes.get('ncaab-games').children[0].events.click();await h.settle();
 const checked=h.now()-1790000,quote={name:'Player A',market:'player_points',label:'Points',line:10.5,updatedAt:h.now()};
 const history={gameId:h.game.id,tipoff:h.game.tipoff,checkedAt:checked,teams:[{available:true,players:[{name:'Player A',results:[1,2].map(i=>({gameId:String(i),tipoff:new Date(h.now()-86400000*i).toISOString(),player_points:12}))}]},{available:true,players:[]}]};
 h.context.fetch=async url=>({ok:true,json:async()=>String(url).includes('/props?')?{gameId:h.game.id,tipoff:h.game.tipoff,message:'Loaded',props:[quote]}:history});
 await h.nodes.get('ncaab-load-props').events.click();const board=h.nodes.get('ncaab-props');assert.match(board.textContent,/12.0/);assert.ok(h.timers.at(-1).delay<=10001);
 h.advance(10002);h.timers.at(-1).fn();assert.match(board.textContent,/Verified history unavailable/);assert.doesNotMatch(board.textContent,/100.0%/);
 assert.ok(h.timers.at(-1).delay>1000);assert.match(board.textContent,/10.5/);
});

test('college stale availability withdraws player estimates without extra requests',async()=>{
 const h=setup(),original=h.context.fetch;let calls=0;
 h.context.fetch=async url=>{calls++;if(String(url).includes('/injuries?'))return {ok:true,json:async()=>({gameId:h.game.id,tipoff:h.game.tipoff,checkedAt:h.now()-890000,teams:[{team:'Away',players:[]},{team:'Home',players:[]}]})};return original(url);};
 await h.nodes.get('ncaab-load').events.click();await h.nodes.get('ncaab-games').children[0].events.click();await h.settle();
 h.context.Unit501NBAPlayerModel.project=()=>({available:true,projection:12,median:12,recentValues:[12],above:2,below:0,equal:0,games:2});
 h.context.fetch=async url=>{calls++;return {ok:true,json:async()=>({gameId:h.game.id,tipoff:h.game.tipoff,checkedAt:h.now(),teams:[],message:'Loaded',props:[{name:'Player A',market:'player_points',line:10.5,updatedAt:h.now()}]})};};
 await h.nodes.get('ncaab-load-props').events.click();const before=calls;assert.match(h.nodes.get('ncaab-props').textContent,/12.0/);
 h.advance(10002);h.timers.at(-1).fn();assert.match(h.nodes.get('ncaab-props').textContent,/Refresh availability/);assert.equal(calls,before);assert.ok(h.timers.at(-1).delay>1000);
 const propsFetch=h.context.fetch;let refreshes=0;
 h.context.fetch=async url=>{if(String(url).includes('/injuries?')){refreshes++;return {ok:true,json:async()=>({gameId:h.game.id,tipoff:h.game.tipoff,checkedAt:h.now(),teams:[{team:'Away',players:[]},{team:'Home',players:[]}]})};}return propsFetch(url);};
 await h.nodes.get('ncaab-load-props').events.click();assert.equal(refreshes,1);assert.match(h.nodes.get('ncaab-props').textContent,/12.0/);assert.doesNotMatch(h.nodes.get('ncaab-props').textContent,/Refresh availability/);
});

test('college cards show supplied overall records and expire them without fetching',async()=>{
 const h=setup(),original=h.context.fetch;
 h.game.awayRecord='4-1';h.game.homeRecord='3-2';
 h.context.fetch=async url=>{const r=await original(url);if(!String(url).includes('/games?'))return r;return {ok:true,json:async()=>({...await r.json(),checkedAt:h.now()-3590000})};};
 await h.nodes.get('ncaab-load').events.click();const card=h.nodes.get('ncaab-games').children[0];assert.match(card.textContent,/Season · Away 4-1 · Home 3-2/);const calls=h.requests.length;
 h.advance(10002);h.timers.at(-1).fn();assert.doesNotMatch(card.textContent,/4-1/);assert.equal(h.requests.length,calls);
 h.game.status='Final';await h.nodes.get('ncaab-load').events.click();assert.doesNotMatch(h.nodes.get('ncaab-games').textContent,/4-1/);
});

test('college comparison responds to entered lines without inventing a line for empty inputs',async()=>{
 const h=setup();h.nodes.get('ncaab-scope').value='season';await h.nodes.get('ncaab-load').events.click();await h.nodes.get('ncaab-games').children[0].events.click();await h.settle();
 const gap=h.nodes.get('ncaab-market-gap'),spread=h.nodes.get('ncaab-spread'),total=h.nodes.get('ncaab-total');assert.equal(gap.hidden,true);
 const calls=h.requests.length;spread.value='7';spread.events.input();assert.match(gap.textContent,/Large model\/line difference.*Entered lines.*\+7.0/);assert.doesNotMatch(gap.textContent,/Total gap/);
 total.value='160';total.events.input();assert.match(gap.textContent,/Total gap -10.0/);
 spread.value='';spread.events.input();total.value='';total.events.input();assert.equal(gap.hidden,true);assert.equal(h.requests.length,calls);
});

test('college game lines expire locally, remove stale comparisons and preserve manually edited lines',async()=>{
 const q={spread:{away:4,home:-4,updatedAt:0},total:{line:145,updatedAt:0},moneyline:{away:125,home:-145,updatedAt:0}},h=setup(q);
 for(const market of Object.values(q))market.updatedAt=h.now();
 await h.nodes.get('ncaab-load').events.click();await h.nodes.get('ncaab-games').children[0].events.click();await h.settle();
 assert.match(h.nodes.get('ncaab-market-gap').textContent,/FanDuel/);
 assert.equal(Number(h.nodes.get('ncaab-spread').value),4);
 h.nodes.get('ncaab-spread').value='7';h.nodes.get('ncaab-spread').events.input();
 assert.match(h.nodes.get('ncaab-market-gap').textContent,/FanDuel \+ entered lines/);
 const calls=h.requests.length,timer=h.timers.filter(t=>t.delay===1800001).at(-1);assert.ok(timer);
 h.advance(1800001);timer.fn();
 assert.equal(h.nodes.get('ncaab-spread').value,'7');assert.equal(h.nodes.get('ncaab-total').value,'');
 assert.match(h.nodes.get('ncaab-market-gap').textContent,/Entered lines/);assert.doesNotMatch(h.nodes.get('ncaab-market-gap').textContent,/Total gap/);
 assert.doesNotMatch(h.nodes.get('ncaab-odds-status').textContent,/\+125/);assert.match(h.nodes.get('ncaab-odds-status').textContent,/No fresh/);
 assert.equal(h.requests.length,calls);
});

test('college quote refresh restores fresh automatic fields without overwriting an intentional blank',async()=>{
 const q={spread:{away:4,home:-4,updatedAt:0},total:{line:145,updatedAt:0}},h=setup(q);for(const m of Object.values(q))m.updatedAt=h.now();
 await h.nodes.get('ncaab-load').events.click();await h.nodes.get('ncaab-games').children[0].events.click();await h.settle();
 h.nodes.get('ncaab-spread').value='';h.nodes.get('ncaab-spread').events.input();
 h.advance(1800001);h.nodes.get('ncaab-scope').events.change();assert.equal(h.nodes.get('ncaab-market-gap').hidden,true);
 q.total.updatedAt=h.now();q.total.line=155;q.spread.updatedAt=h.now();
 await h.nodes.get('ncaab-refresh-lines').events.click();
 assert.equal(h.nodes.get('ncaab-spread').value,'');assert.equal(Number(h.nodes.get('ncaab-total').value),155);
 assert.match(h.nodes.get('ncaab-market-gap').textContent,/FanDuel.*Total gap -5.0/);
 assert.equal(h.nodes.get('ncaab-refresh-lines').disabled,false);
});

test('college rejects missing timestamps, malformed markets and mismatched tipoffs',async()=>{
 const q={spread:{away:4,home:4,updatedAt:0},total:{line:145},moneyline:{away:0,home:-145,updatedAt:0}},h=setup(q);
 q.spread.updatedAt=q.moneyline.updatedAt=h.now();
 await h.nodes.get('ncaab-load').events.click();await h.nodes.get('ncaab-games').children[0].events.click();await h.settle();
 assert.equal(h.nodes.get('ncaab-spread').value,'');assert.equal(h.nodes.get('ncaab-total').value,'');assert.equal(h.nodes.get('ncaab-market-gap').hidden,true);
 q.spread.home=-4;q.total.updatedAt=h.now();h.game.tipoff=new Date(h.now()+100).toISOString();
 await h.nodes.get('ncaab-games').children[0].events.click();await h.settle();
 // The fixture response retains its original tipoff, so mismatched data is also rejected.
 assert.equal(h.nodes.get('ncaab-market-gap').hidden,true);
});

test('college quotes disappear at tipoff even when the quote timestamp is still fresh',async()=>{
 const q={spread:{away:4,home:-4,updatedAt:0},total:{line:145,updatedAt:0}},h=setup(q);
 h.game.tipoff=new Date(h.now()+1000).toISOString();for(const m of Object.values(q))m.updatedAt=h.now();
 const base=h.context.fetch;h.context.fetch=async url=>{const r=await base(url);const data=await r.json();return {ok:true,json:async()=>String(url).includes('/games?')?data:{...data,tipoff:h.game.tipoff}};};
 await h.nodes.get('ncaab-load').events.click();await h.nodes.get('ncaab-games').children[0].events.click();await h.settle();
 assert.equal(Number(h.nodes.get('ncaab-total').value),145);const timer=h.timers.filter(t=>t.delay===1000).at(-1);assert.ok(timer);
 h.advance(1000);timer.fn();assert.equal(h.nodes.get('ncaab-total').value,'');assert.equal(h.nodes.get('ncaab-spread').value,'');assert.equal(h.nodes.get('ncaab-market-gap').hidden,true);
});

test('late college quote responses cannot overwrite a newer selection or user edits',async()=>{
 const h=setup(),base=h.context.fetch,pending=[];
 h.context.fetch=url=>String(url).includes('/odds?')?new Promise(resolve=>pending.push(resolve)):base(url);
 await h.nodes.get('ncaab-load').events.click();await h.nodes.get('ncaab-games').children[0].events.click();await h.settle();
 await h.nodes.get('ncaab-games').children[0].events.click();await h.settle();assert.equal(pending.length,2);
 h.nodes.get('ncaab-spread').value='8';h.nodes.get('ncaab-spread').events.input();
 const response=total=>({ok:true,json:async()=>({gameId:h.game.id,tipoff:h.game.tipoff,bookmaker:'FanDuel',spread:{away:4,home:-4,updatedAt:h.now()},total:{line:total,updatedAt:h.now()}})});
 pending[1](response(155));await h.settle();assert.equal(Number(h.nodes.get('ncaab-total').value),155);assert.equal(h.nodes.get('ncaab-spread').value,'8');
 pending[0](response(140));await h.settle();assert.equal(Number(h.nodes.get('ncaab-total').value),155);assert.equal(h.nodes.get('ncaab-spread').value,'8');
});

test('college prop UI passes its regulation cap and displays historical minutes samples',async()=>{
 const h=setup();await h.nodes.get('ncaab-load').events.click();await h.nodes.get('ncaab-games').children[0].events.click();await h.settle();
 const original=h.context.Unit501NBAPlayerModel.project;let seen;
 h.context.Unit501NBAPlayerModel.project=(...args)=>{seen=args[5];return original(...args);};
 const results=Array.from({length:5},(_,i)=>({gameId:String(i+1),tipoff:new Date(h.now()-(i+1)*86400000).toISOString(),minutes:i<2?45:32,player_points:20}));
 h.context.fetch=async url=>({ok:true,json:async()=>({gameId:h.game.id,tipoff:h.game.tipoff,checkedAt:h.now(),message:'Loaded',props:[{name:'Player A',market:'player_points',label:'Points',line:18.5,updatedAt:h.now()}],teams:[{available:true,players:[{name:'Player A',results}]},{available:true,players:[]}]})});
 await h.nodes.get('ncaab-load-props').events.click();
 assert.equal(seen.regulationMinutes,40);
 assert.match(h.nodes.get('ncaab-props').textContent,/Recent minutes up · 32.0 → 45.0 · last 2 vs earlier 3 games/);
 assert.doesNotMatch(h.nodes.get('ncaab-props').textContent,/confirmed starter/);
});

test('college history expiry withholds scores and simulations and refresh preserves manual lines',async()=>{
 const h=setup();await h.nodes.get('ncaab-load').events.click();await h.nodes.get('ncaab-games').children[0].events.click();await h.settle();
 assert.match(h.nodes.get('ncaab-prediction').textContent,/75.0/);
 h.nodes.get('ncaab-spread').value='7';h.nodes.get('ncaab-spread').events.input();
 const expiry=h.timers.find(t=>t.delay===3600001);assert.ok(expiry);h.advance(3600001);expiry.fn();
 assert.match(h.nodes.get('ncaab-prediction').textContent,/stale/);assert.equal(h.nodes.get('ncaab-teams').children.length,0);
 h.nodes.get('ncaab-sim').events.click();assert.equal(h.nodes.get('ncaab-simulation').textContent,'');
 h.data.checkedAt=h.now();await h.nodes.get('ncaab-refresh-context').events.click();
 assert.match(h.nodes.get('ncaab-prediction').textContent,/75.0/);assert.equal(h.nodes.get('ncaab-spread').value,'7');
});
test('college missing and future history times cannot produce estimates',async()=>{
 for(const checkedAt of [undefined,Date.now()+120000]){
  const h=setup();h.data.checkedAt=checkedAt;await h.nodes.get('ncaab-load').events.click();await h.nodes.get('ncaab-games').children[0].events.click();
  assert.match(h.nodes.get('ncaab-prediction').textContent,/update time is unverified/);
  h.nodes.get('ncaab-sim').events.click();assert.equal(h.nodes.get('ncaab-simulation').textContent,'');
 }
});
test('college history refresh rejects older in-flight responses',async()=>{
 const h=setup();await h.nodes.get('ncaab-load').events.click();await h.nodes.get('ncaab-games').children[0].events.click();
 const pending=[],base=h.context.fetch;h.context.fetch=url=>String(url).includes('/context?')?new Promise(r=>pending.push(r)):base(url);
 const refresh=h.nodes.get('ncaab-refresh-context').events.click,first=refresh(),second=refresh();
 pending[1]({ok:true,json:async()=>({...h.data,source:'Newest'})});await second;
 pending[0]({ok:true,json:async()=>({...h.data,source:'Old'})});await first;
 assert.match(h.nodes.get('ncaab-context-status').textContent,/Newest/);
});

test('college prop display suppresses a formatted Out name and rejects a foreign-game injury report',async()=>{
 const h=setup(),base=h.context.fetch;
 let report={gameId:h.game.id,tipoff:h.game.tipoff,checkedAt:h.now(),teams:[{team:'Away',players:[{name:'José O’Neal Jr.',status:'Out'}]},{team:'Home',players:[]}]};
 h.context.fetch=async url=>{
  if(String(url).includes('/injuries?'))return {ok:true,json:async()=>report};
  if(String(url).includes('/props?'))return {ok:true,json:async()=>({gameId:h.game.id,tipoff:h.game.tipoff,message:'Loaded',props:[{name:'Jose ONeal',market:'player_points',label:'Points',line:10.5,updatedAt:h.now()}]})};
  if(String(url).includes('/player-history?'))return {ok:true,json:async()=>({gameId:h.game.id,tipoff:h.game.tipoff,checkedAt:h.now(),teams:[]})};
  return base(url);
 };
 await h.nodes.get('ncaab-load').events.click();await h.nodes.get('ncaab-games').children[0].events.click();await h.settle();
 await h.nodes.get('ncaab-load-props').events.click();
 assert.match(h.nodes.get('ncaab-props').textContent,/OUT/);
 report={...report,gameId:'999'};
 await h.nodes.get('ncaab-games').children[0].events.click();await h.settle();await h.nodes.get('ncaab-load-props').events.click();
 assert.match(h.nodes.get('ncaab-injury-status').textContent,/Injury report unavailable/);
 assert.doesNotMatch(h.nodes.get('ncaab-props').textContent,/OUT/);
});
