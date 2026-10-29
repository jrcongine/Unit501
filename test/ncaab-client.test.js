'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function setup(quotes={}){
 const nodes=new Map(),requests=[];
 class E{constructor(){this.children=[];this.events={};this.value='';this._text='';this.classList={add(){},remove(){}};}set textContent(v){this._text=String(v);this.children=[];}get textContent(){return this._text+this.children.map(x=>x.textContent).join(' ');}append(...x){this.children.push(...x);}replaceChildren(...x){this._text='';this.children=x;}addEventListener(k,f){this.events[k]=f;}}
 const html=fs.readFileSync(require.resolve('../public/ncaab.html'),'utf8');for(const x of html.matchAll(/id="([^"]+)"/g))nodes.set(x[1],new E());
 const future=new Date(Date.now()+86400000).toISOString(),game={id:'10',awayId:'1',homeId:'2',away:'Away',home:'Home',tipoff:future,timeKnown:true,status:'Scheduled',stage:2,neutral:false};
 const rec={games:5,scored:80,allowed:70,wins:3,losses:2};const side=(id,name)=>({id,name,season:rec,recent5:rec,recent10:rec,recentGames:Array.from({length:5},(_,i)=>({id:String(i+1),tipoff:new Date(Date.now()-86400000*(i+1)).toISOString(),opponent:'Opponent',scored:80,allowed:70,venue:'home'}))});
 const data={gameId:'10',tipoff:future,away:side('1','Away'),home:side('2','Home'),source:'ESPN'};
 const document={getElementById:id=>nodes.get(id),createElement:()=>new E()},context={document,Date,Intl,URLSearchParams,AbortSignal};context.window=context;
 context.fetch=async url=>{requests.push(url);return {ok:true,json:async()=>String(url).includes('/games?')?{source:'ESPN',games:[game]}:String(url).includes('/odds?')?{...data,...quotes}:data};};
 vm.createContext(context);for(const p of ['market-pulse.js','ncaab-model.js','ncaab.js'])vm.runInContext(fs.readFileSync(require.resolve('../public/'+p),'utf8'),context);
 const settle=()=>new Promise(r=>setImmediate(r));return {nodes,game,requests,settle};
}
test('college slate loads, selects a game, displays form and simulates manual lines',async()=>{
 const h=setup();h.nodes.get('ncaab-scope').value='season';await h.nodes.get('ncaab-load').events.click();assert.equal(h.nodes.get('ncaab-games').children.length,1);
 await h.nodes.get('ncaab-games').children[0].events.click();await h.settle();assert.match(h.nodes.get('ncaab-prediction').textContent,/Away 75.0.*Home 75.0/);
 assert.match(h.nodes.get('ncaab-teams').textContent,/5 games.*3–2/);
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
