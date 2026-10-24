'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function harness(){
 const nodes=new Map(),calls=[],timers=[];let clock=Date.parse('2026-10-24T20:00:00Z');
 class Node{
  constructor(){this.children=[];this.events={};this.value='';this._text='';this.disabled=false;}
  set textContent(v){this._text=String(v);this.children=[];}get textContent(){return this._text+this.children.map(n=>n.textContent).join(' ');}
  append(...n){this.children.push(...n);}replaceChildren(){this.children=[];this._text='';}setAttribute(){}addEventListener(e,f){this.events[e]=f;}
 }
 const html=fs.readFileSync(require.resolve('../public/nba.html'),'utf8');for(const m of html.matchAll(/id="([^"]+)"/g))nodes.set(m[1],new Node());
 const document={getElementById:id=>nodes.get(id),createElement:()=>new Node(),addEventListener(){},hidden:false};
 const game={id:899,away:'Clippers',home:'Bulls',tipoff:'2026-10-24T23:00:00Z',status:'Scheduled'};
 const base=g=>({gameId:g.id,tipoff:g.tipoff,bookmaker:'FanDuel',message:'Loaded',props:[],coverage:[]});
 const data=(g,props)=>props?{...base(g),props:[{name:'Player A',market:'player_points',label:'Points',line:20.5,over:-110,under:100,updatedAt:clock},{name:'Player B',market:'player_rebounds',label:'Rebounds',line:9.5,over:110,under:-120,updatedAt:clock}]}:{...base(g),spread:{away:3.5,home:-3.5,awayPrice:-110,homePrice:-110,updatedAt:clock},total:{line:225.5,over:-110,under:100,updatedAt:clock}};
 const context={document,Date:class extends Date{static now(){return clock;}},URLSearchParams,AbortSignal,setTimeout:fn=>{timers.push(fn);return timers.length;},clearTimeout(){},Unit501SharedUI:{timeCentral:iso=>iso}};context.window=context;
 context.fetch=async url=>{calls.push(url);return {ok:true,json:async()=>data(game,String(url).includes('/props?'))};};
 vm.createContext(context);vm.runInContext(fs.readFileSync(require.resolve('../public/nba-markets.js'),'utf8'),context);
 const settle=()=>new Promise(resolve=>setImmediate(resolve));
 return {nodes,context,calls,timers,game,data,settle,select:async(g=game)=>{context.Unit501NBAMarkets.select(g,'2026-10-24');await settle();},advance:ms=>{clock+=ms;}};
}
test('NBA game lines load on selection, props load on demand, and stat/name filters make no feed calls',async()=>{
 const h=harness();await h.select();
 assert.equal(h.calls.length,1);assert.match(h.nodes.get('nba-game-odds').textContent,/Clippers \+3.5.*Bulls -3.5.*225.5/);
 assert.equal(h.nodes.get('nba-prop-lines').textContent,'');
 await h.nodes.get('nba-load-props').events.click();assert.equal(h.calls.length,2);
 assert.match(h.nodes.get('nba-prop-lines').textContent,/Player A.*Player B/);
 const stat=h.nodes.get('nba-prop-market');stat.value='player_points';stat.events.change();
 assert.match(h.nodes.get('nba-prop-lines').textContent,/Player A/);assert.doesNotMatch(h.nodes.get('nba-prop-lines').textContent,/Player B/);
 const name=h.nodes.get('nba-prop-search');name.value='unmatched';name.events.input();
 assert.match(h.nodes.get('nba-prop-lines').textContent,/No current/);assert.equal(h.calls.length,2);
});
test('NBA quote display expires stale prices locally without polling the odds API',async()=>{
 const h=harness();await h.select();await h.nodes.get('nba-load-props').events.click();
 h.advance(1800001);h.timers.at(-1)();
 assert.match(h.nodes.get('nba-game-odds').textContent,/No current paired/);
 assert.doesNotMatch(h.nodes.get('nba-game-odds').textContent,/225.5/);
 assert.match(h.nodes.get('nba-prop-lines').textContent,/No current/);assert.equal(h.calls.length,2);
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
