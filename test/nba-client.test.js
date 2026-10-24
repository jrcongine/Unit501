'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {summarize}=require('../nba-context');
function harness(){
 const nodes=new Map(),requests=[];
 class Element{
  constructor(tag){this.tag=tag;this.children=[];this.events={};this.className='';this.attrs={};this.value='';this._text='';
   const change=(name,add)=>{const set=new Set(this.className.split(/\s+/).filter(Boolean));add?set.add(name):set.delete(name);this.className=[...set].join(' ');};
   this.classList={add:n=>change(n,true),remove:n=>change(n,false),contains:n=>this.className.split(/\s+/).includes(n)};
  }
  set textContent(v){this._text=String(v);this.children=[];}get textContent(){return this._text+this.children.map(c=>typeof c==='string'?c:c.textContent).join(' ');}
  append(...n){this.children.push(...n);}prepend(...n){this.children.unshift(...n);}replaceChildren(...n){this._text='';this.children=[...n];}
  setAttribute(k,v){this.attrs[k]=String(v);}addEventListener(k,f){this.events[k]=f;}scrollIntoView(){}
  querySelectorAll(sel){return this.children.filter(n=>n.className?.split(/\s+/).includes(sel.slice(1)));}
 }
 const document={createElement:tag=>new Element(tag),getElementById:id=>nodes.get(id),addEventListener(){},hidden:false};
 const html=fs.readFileSync(require.resolve('../public/nba.html'),'utf8');
 for(const m of html.matchAll(/<(\w+)[^>]*\bid="([^"]+)"[^>]*>/g)){const n=new Element(m[1]);n.className=/class="([^"]*)"/.exec(m[0])?.[1]||'';nodes.set(m[2],n);}
 const games=[{id:899,away:'Chicago Bulls',awayId:5,home:'Milwaukee Bucks',homeId:6,tipoff:'2026-10-24T23:00:00Z',stage:2,status:'Scheduled',awayScore:null,homeScore:null},
 {id:900,away:'Cleveland Cavaliers',awayId:7,home:'Boston Celtics',homeId:8,tipoff:'2026-10-24T23:30:00Z',stage:2,status:'Scheduled',awayScore:null,homeScore:null}];
 const history=(id,other,count)=>Array.from({length:count},(_,i)=>({id:id*100+i,stage:2,season:2026,league:'standard',date:{start:`2026-10-${String(10+i).padStart(2,'0')}T23:00:00Z`},status:{short:3},teams:{visitors:{id,name:'Team'},home:{id:other,name:'Opponent'}},scores:{visitors:{points:100+i},home:{points:90}}}));
 const data=g=>({gameId:g.id,away:{...summarize(history(g.awayId,19,7),g.awayId,g),name:g.away},home:{...summarize(history(g.homeId,20,2),g.homeId,g),name:g.home},message:'Historical comparison'});
 const context={document,Date,Intl,URLSearchParams,AbortSignal,console,setTimeout:()=>1,clearTimeout(){}};
 context.window=context;
 context.fetch=async url=>{requests.push(url);const u=new URL(url,'http://localhost');return {ok:true,json:async()=>u.pathname==='/api/nba/games'?{games,checkedAt:new Date().toISOString()}:data(games.find(g=>g.id===Number(u.searchParams.get('game'))))};};
 vm.createContext(context);
 for(const name of ['unit501-shared-ui.js','nba-alerts.js','nba.js'])vm.runInContext(fs.readFileSync(require.resolve('../public/'+name),'utf8'),context);
 const settle=()=>new Promise(resolve=>setImmediate(resolve));
 const load=async()=>{await nodes.get('nba-load').events.click();await settle();};
 const choose=async i=>{nodes.get('nba-games').children[i].events.click();await settle();await settle();};
 return {nodes,requests,context,games,data,load,choose,settle};
}
test('NBA form controls update actual rendered comparisons without extra provider requests',async()=>{
 const h=harness();await h.load();await h.choose(0);
 assert.equal(h.nodes.get('nba-lab').classList.contains('hidden'),false);
 assert.match(h.nodes.get('nba-team-comparison').textContent,/Chicago Bulls.*Recent form.*At home.*On the road/);
 assert.match(h.nodes.get('nba-head-to-head').textContent,/Last 5.*104.0/);
 const calls=h.requests.length,filter=h.nodes.get('nba-form-window');
 filter.value='season';filter.events.change();assert.match(h.nodes.get('nba-head-to-head').textContent,/Season.*103.0/);
 filter.value='venue';filter.events.change();assert.match(h.nodes.get('nba-head-to-head').textContent,/Road team away.*One or both teams have no qualifying games/);
 assert.equal(h.requests.length,calls);
 h.nodes.get('nba-clear').events.click();assert.equal(h.nodes.get('nba-lab').classList.contains('hidden'),true);
});
test('late NBA matchup responses cannot replace the newly selected team comparison',async()=>{
 const h=harness();await h.load();let release;const original=h.context.fetch;
 h.context.fetch=url=>String(url).includes('game=899')?new Promise(resolve=>{release=()=>resolve({ok:true,json:async()=>h.data(h.games[0])});}):original(url);
 await h.choose(0);await h.choose(1);release();await h.settle();await h.settle();
 assert.match(h.nodes.get('nba-head-to-head').textContent,/Cleveland Cavaliers/);
 assert.doesNotMatch(h.nodes.get('nba-head-to-head').textContent,/Chicago Bulls/);
 assert.match(h.nodes.get('nba-team-comparison').textContent,/Boston Celtics/);
});
test('NBA context failures clear old numbers and preserve an explicit unavailable state',async()=>{
 const h=harness();await h.load();await h.choose(0);
 h.context.fetch=async()=>({ok:false,json:async()=>({error:'unavailable'})});
 await h.choose(1);
 assert.equal(h.nodes.get('nba-head-to-head').textContent,'');
 assert.equal(h.nodes.get('nba-team-comparison').textContent,'');
 assert.match(h.nodes.get('nba-team-context-status').textContent,/unavailable/);
 h.nodes.get('nba-form-window').events.change();assert.equal(h.nodes.get('nba-head-to-head').textContent,'');
});
