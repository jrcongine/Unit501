'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function setup(quotes={}){
 const nodes=new Map(),requests=[];
 class E{constructor(){this.children=[];this.events={};this.value='';this._text='';this.classList={add(){},remove(){}};}set textContent(v){this._text=String(v);this.children=[];}get textContent(){return this._text+this.children.map(x=>x.textContent).join(' ');}append(...x){this.children.push(...x);}replaceChildren(...x){this._text='';this.children=x;}addEventListener(k,f){this.events[k]=f;}}
 const html=fs.readFileSync(require.resolve('../public/ncaab.html'),'utf8');for(const x of html.matchAll(/id="([^"]+)"/g))nodes.set(x[1],new E());
 const future=new Date(Date.now()+86400000).toISOString(),game={id:'10',awayId:'1',homeId:'2',away:'Away',home:'Home',tipoff:future,timeKnown:true,status:'Scheduled',stage:2,neutral:false};
 const rec={games:5,scored:80,allowed:70,wins:3,losses:2};const side=(id,name)=>({id,name,season:rec,recent5:rec,recent10:rec,recentGames:Array.from({length:5},(_,i)=>({id:String(i+1),tipoff:new Date(Date.now()-86400000*(i+1)).toISOString(),opponent:'Opponent',scored:80,allowed:70,venue:'home'}))});
 const data={gameId:'10',tipoff:future,away:side('1','Away'),home:side('2','Home'),source:'ESPN'};
 const document={getElementById:id=>nodes.get(id),createElement:()=>new E()},context={document,Date,Intl,URLSearchParams,AbortSignal,setTimeout:()=>0,clearTimeout(){}};context.window=context;
 context.fetch=async url=>{requests.push(url);return {ok:true,json:async()=>String(url).includes('/games?')?{source:'ESPN',games:[game]}:String(url).includes('/odds?')?{...data,...quotes}:data};};
 vm.createContext(context);for(const p of ['star-power.js','nba-player-model.js','market-pulse.js','ncaab-model.js','ncaab.js'])vm.runInContext(fs.readFileSync(require.resolve('../public/'+p),'utf8'),context);
 const settle=()=>new Promise(r=>setImmediate(r));return {nodes,game,requests,settle,context};
}
test('college slate loads, selects a game, displays form and simulates manual lines',async()=>{
 const h=setup();h.nodes.get('ncaab-scope').value='season';await h.nodes.get('ncaab-load').events.click();assert.equal(h.nodes.get('ncaab-games').children.length,1);
 await h.nodes.get('ncaab-games').children[0].events.click();await h.settle();assert.match(h.nodes.get('ncaab-prediction').textContent,/Away 75.0.*Home 75.0/);
 assert.match(h.nodes.get('ncaab-teams').textContent,/5 recorded games.*3–2/);
 h.nodes.get('ncaab-spread').value='0';h.nodes.get('ncaab-total').value='150';h.nodes.get('ncaab-sim').events.click();assert.match(h.nodes.get('ncaab-simulation').textContent,/tie 100.0%.*spread push 100.0%.*total push 100.0%/);
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
 const h=setup({message:'Loaded',moneyline:{away:125,home:-145},history:{spread:{firstLine:3,line:4,firstAt:1,lastAt:2},total:{firstLine:145,line:145,firstAt:1,lastAt:1}}});
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
 const at=Date.now(),q=(name,market)=>({name,market,label:market,line:10.5,updatedAt:at});
 const quotes=[q('A','player_assists'),q('B','player_points'),q('A','player_points'),{...q('Expired','player_points'),updatedAt:at-1800001}];
 h.context.Unit501NBAPlayerModel={withScenario:h.context.Unit501NBAPlayerModel.withScenario,project:(history,q)=>({available:true,projection:12,median:11,average:11,above:q.name==='A'?1:3,below:q.name==='A'?0:3,equal:0,games:q.name==='A'?1:6,recentValues:[12],projectedMinutes:20})};
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
