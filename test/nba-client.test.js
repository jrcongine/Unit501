'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {summarize}=require('../nba-context');
function harness(){
 const nodes=new Map(),requests=[],intervals=[],timeouts=new Map();let timerId=0;
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
 const events=new Map();
 const document={createElement:tag=>new Element(tag),getElementById:id=>nodes.get(id),
  addEventListener:(type,fn)=>{if(!events.has(type))events.set(type,[]);events.get(type).push(fn);},
  dispatchEvent:event=>{for(const fn of events.get(event.type)||[])fn(event);},
  hidden:false};
 const html=fs.readFileSync(require.resolve('../public/nba.html'),'utf8');
 for(const m of html.matchAll(/<(\w+)[^>]*\bid="([^"]+)"[^>]*>/g)){const n=new Element(m[1]);n.className=/class="([^"]*)"/.exec(m[0])?.[1]||'';nodes.set(m[2],n);}
 const games=[{id:899,away:'Chicago Bulls',awayId:5,home:'Milwaukee Bucks',homeId:6,tipoff:'2026-10-24T23:00:00Z',stage:2,status:'Scheduled',awayScore:null,homeScore:null},
 {id:900,away:'Cleveland Cavaliers',awayId:7,home:'Boston Celtics',homeId:8,tipoff:'2026-10-24T23:30:00Z',stage:2,status:'Scheduled',awayScore:null,homeScore:null}];
 const history=(id,other,count)=>Array.from({length:count},(_,i)=>({id:id*100+i,stage:2,season:2026,league:'standard',date:{start:`2026-10-${String(10+i).padStart(2,'0')}T23:00:00Z`},status:{short:3},teams:{visitors:{id,name:'Team'},home:{id:other,name:'Opponent'}},scores:{visitors:{points:100+i},home:{points:90}}}));
 const data=g=>({checkedAt:context.Date.now(),gameId:g.id,away:{...summarize(history(g.awayId,19,7),g.awayId,g),name:g.away},home:{...summarize(history(g.homeId,20,2),g.homeId,g),name:g.home},message:'Historical comparison'});
 const context={document,Date,Intl,URLSearchParams,AbortSignal,console,setTimeout:(fn,ms)=>{const id=++timerId;timeouts.set(id,{fn,ms});return id;},setInterval:(fn,ms)=>{intervals.push({fn,ms});return intervals.length;},clearTimeout(id){timeouts.delete(id);}};
 context.CustomEvent=class{constructor(type,options={}){this.type=type;this.detail=options.detail;}};
 context.Event=class{constructor(type){this.type=type;}};
 context.window=context;
 context.fetch=async url=>{
  requests.push(url);const u=new URL(url,'http://localhost');
  if(u.pathname==='/api/league-pulse'){
   const teams=Array.from({length:30},(_,i)=>({
    id:String(i+1),name:i===0?'Chicago Bulls':i===1?'Milwaukee Bucks':'NBA Team '+(i+1),
    providerName:i===0?'Chicago Bulls':i===1?'Milwaukee Bucks':'NBA Team '+(i+1),
    record:'2-1',rank:i+1,score:98-i,trend:'flat',trendLabel:'Steady'
   }));
   return {ok:true,json:async()=>({league:'nba',checkedAt:new Date().toISOString(),
    power:{available:true,season:2027,count:30,teams,top:teams.slice(0,10),middle:teams.slice(10,-10),
     bottom:teams.slice(-10),basis:'Current season standings'},
    headlines:{available:true,items:[{title:'NBA league headline',url:'https://www.espn.com/nba/story',
     source:'ESPN',publishedAt:new Date().toISOString(),category:'League update'}]}})};
  }
  return {ok:true,json:async()=>u.pathname==='/api/nba/games'?{games,checkedAt:new Date().toISOString()}:data(games.find(g=>g.id===Number(u.searchParams.get('game'))))};
 };
 vm.createContext(context);
 for(const name of ['unit501-shared-ui.js','nba-alerts.js','nba-model.js','nba.js','league-pulse.js'])vm.runInContext(fs.readFileSync(require.resolve('../public/'+name),'utf8'),context);
 const settle=()=>new Promise(resolve=>setImmediate(resolve));
 const load=async()=>{await nodes.get('nba-load').events.click();await settle();};
 const choose=async i=>{nodes.get('nba-games').children[i].events.click();await settle();await settle();};
 return {nodes,requests,intervals,timeouts,context,games,data,load,choose,settle};
}
test('NBA slate shows same in-page Top 10, middle, bottom and headlines plus Game Lab ranks',async()=>{
 const h=harness();await h.load();await h.settle();
 assert.match(h.nodes.get('league-pulse-power').textContent,/Top 10/);
 assert.match(h.nodes.get('league-pulse-power').textContent,/Bottom 10/);
 assert.match(h.nodes.get('league-pulse-headlines').textContent,/NBA league headline/);
 await h.choose(0);
 const match=h.nodes.get('nba-league-pulse-matchup').textContent;
 assert.match(match,/Chicago Bulls/);
 assert.match(match,/Milwaukee Bucks/);
 assert.match(match,/#1 of 30/);
 assert.match(match,/#2 of 30/);
 h.nodes.get('nba-clear').events.click();
 assert.equal(h.nodes.get('nba-league-pulse-matchup').textContent,'');
});

test('NBA form controls update actual rendered comparisons without extra provider requests',async()=>{
 const h=harness();await h.load();await h.choose(0);
 assert.equal(h.nodes.get('nba-lab').classList.contains('hidden'),false);
 assert.match(h.nodes.get('nba-team-comparison').textContent,/Chicago Bulls.*Recent form.*At home.*On the road/);
 assert.match(h.nodes.get('nba-head-to-head').textContent,/Season.*103.0/);
 const calls=h.requests.length,filter=h.nodes.get('nba-form-window');
 filter.value='recent5';filter.events.change();assert.match(h.nodes.get('nba-head-to-head').textContent,/Last 5.*104.0/);
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
test('NBA travel renders matching city estimates and discards late responses from a prior game',async()=>{
 const h=harness();for(const g of h.games){g.tipoff=new Date(Date.now()+86400000).toISOString();g.statusCode=1;}
 await h.load();const base=h.context.fetch;let release;
 h.context.fetch=url=>{
  if(String(url).includes('/api/nba/travel?')&&String(url).includes('game=899'))return new Promise(resolve=>{release=()=>resolve({ok:true,json:async()=>({gameId:899,tipoff:h.games[0].tipoff,away:{available:true,miles:190,previousCity:'Brooklyn',currentCity:'Boston'},home:{available:false}})});});
  if(String(url).includes('/api/nba/travel?'))return Promise.resolve({ok:true,json:async()=>({gameId:900,tipoff:h.games[1].tipoff,away:{available:true,miles:300,previousCity:'Cleveland',currentCity:'Boston'},home:{available:false}})});
  return base(url);
 };
 await h.choose(0);await h.choose(1);await h.settle();release();await h.settle();await h.settle();
 const text=h.nodes.get('nba-team-comparison').textContent;
 assert.match(text,/Venue distance.*300 miles.*Cleveland.*Boston.*Straight-line/);assert.doesNotMatch(text,/190 miles/);
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

test('NBA estimates render selected-window scores, clear on switch, and reject late history',async()=>{
 const h=harness();
 for(const g of h.games){g.tipoff=new Date(Date.now()+86400000).toISOString();g.statusCode=1;}
 const old=h.context.fetch;
 h.context.fetch=async url=>{
  if(!String(url).startsWith('/api/nba/context'))return old(url);
  const g=h.games.find(g=>String(url).includes('game='+g.id));
  const data=h.data(g);Object.assign(data,{tipoff:g.tipoff,stage:g.stage});
  for(const [side,id] of [[data.away,g.awayId],[data.home,g.homeId]]){
   side.id=id;side.season={games:10,pointsFor:120,pointsAgainst:100};
   side.recent5={games:5,pointsFor:110,pointsAgainst:100};
  }
  return {ok:true,json:async()=>data};
 };
 await h.load();await h.choose(0);
 assert.match(h.nodes.get('nba-prediction').textContent,/Chicago Bulls 110.0.*Total 220.0/);
 const calls=h.requests.length;h.nodes.get('nba-form-window').value='recent5';h.nodes.get('nba-form-window').events.change();
 assert.match(h.nodes.get('nba-prediction').textContent,/Total 210.0/);assert.equal(h.requests.length,calls);
 h.context.fetch=async()=>({ok:false,json:async()=>({})});await h.choose(1);
 assert.doesNotMatch(h.nodes.get('nba-prediction').textContent,/220.0|Chicago/);
 assert.equal(h.nodes.get('nba-prediction-detail').textContent,'');
});

test('NBA upset highlight follows the projected winner and current underdog line automatically',async()=>{
 const h=harness();await h.load();
 h.context.Unit501NBAModel.project=()=>({available:true,away:110,home:108,total:218,homeSpread:2,awayGames:6,homeGames:6,explanation:''});
 let spread=3.5;
 h.context.Unit501NBAMarkets={select(){},clear(){},spreadFor:()=>spread};
 await h.choose(0);
 const alert=h.nodes.get('nba-upset-pick');
 assert.equal(alert.hidden,false);assert.match(alert.textContent,/Model lean only.*Chicago Bulls/);
 const calls=h.requests.length;
 spread=-3.5;
 h.context.document.dispatchEvent(new h.context.Event('unit501:nba-lines-updated'));
 assert.equal(alert.hidden,true);assert.equal(alert.textContent,'');
 spread=null;
 h.context.document.dispatchEvent(new h.context.Event('unit501:nba-lines-updated'));
 assert.equal(alert.hidden,true);assert.equal(h.requests.length,calls);
 h.context.Unit501NBAModel.project=()=>({available:false,reason:'Game started'});
 spread=3.5;
 h.context.document.dispatchEvent(new h.context.Event('unit501:nba-lines-updated'));
 assert.equal(alert.hidden,true);
});

test('actual NBA market refresh and reset drive automatic upset headline without extra requests',async()=>{
 const h=harness();h.games[0].tipoff=new Date(Date.now()+86400000).toISOString();
 h.context.Unit501NBAModel.project=()=>({available:true,away:110,home:108,total:218,homeSpread:2,awayGames:6,homeGames:6,explanation:''});
 const original=h.context.fetch;let spread=3.5;
 h.context.fetch=async url=>{
  if(!String(url).startsWith('/api/nba/odds?'))return original(url);
  h.requests.push(url);
  return {ok:true,json:async()=>({gameId:h.games[0].id,tipoff:h.games[0].tipoff,bookmaker:'FanDuel',spread:{away:spread,home:-spread,awayPrice:-110,homePrice:-110,updatedAt:Date.now()}})};
 };
 vm.runInContext(fs.readFileSync(require.resolve('../public/nba-markets.js'),'utf8'),h.context);
 await h.load();await h.choose(0);
 const alert=h.nodes.get('nba-upset-pick');
 assert.equal(alert.hidden,false);assert.match(alert.textContent,/Model lean only.*Chicago Bulls/);
 assert.equal(h.requests.filter(u=>String(u).startsWith('/api/nba/odds?')).length,1);
 spread=-3.5;await h.nodes.get('nba-refresh-odds').events.click();await h.settle();
 assert.equal(alert.hidden,true);
 spread=3.5;await h.nodes.get('nba-refresh-odds').events.click();await h.settle();
 assert.equal(alert.hidden,false);
 h.context.Unit501NBAMarkets.clear();assert.equal(alert.hidden,true);
});

test('NBA simulation follows projections and fresh line updates without new requests',async()=>{
 const h=harness();h.games[0].tipoff=new Date(Date.now()+86400000).toISOString();h.games[0].statusCode=1;
 const original=h.context.fetch;
 h.context.fetch=async url=>{
  if(String(url).startsWith('/api/nba/context?')){
   const d=h.data(h.games[0]);d.tipoff=h.games[0].tipoff;d.stage=h.games[0].stage;d.away.id=h.games[0].awayId;d.home.id=h.games[0].homeId;d.home.recentGames=Array.from({length:5},(_,i)=>({for:100+i*3,against:106+i}));
   d.home.recent5={games:5,pointsFor:106,pointsAgainst:108};d.home.season={games:5,pointsFor:106,pointsAgainst:108};
   return {ok:true,json:async()=>d};
  }
  return original(url);
 };
 let lines={awaySpread:2.5,total:220.5};
 h.context.Unit501NBAMarkets={select(){},clear(){},spreadFor:()=>lines.awaySpread,linesFor:()=>lines};
 await h.load();await h.choose(0);
 assert.match(h.nodes.get('nba-simulation').textContent,/10,000 simulations.*Chicago Bulls win.*cover.*Over 220.5/);
 assert.match(h.nodes.get('nba-simulation-detail').textContent,/not calibrated.*injuries/);
 assert.match(h.nodes.get('nba-market-gap').textContent,/FanDuel.*Away margin gap.*Total gap/);assert.equal(h.nodes.get('nba-market-gap').hidden,false);
 const count=h.requests.length;lines={};h.context.document.dispatchEvent(new h.context.Event('unit501:nba-lines-updated'));
 assert.doesNotMatch(h.nodes.get('nba-simulation').textContent,/cover|Over/);
 assert.equal(h.nodes.get('nba-market-gap').hidden,true);assert.equal(h.nodes.get('nba-market-gap').textContent,'');
 assert.equal(h.requests.length,count);
});

test('NBA matchup links to the official report for the selected season without extra calls',async()=>{
 const h=harness();await h.load();await h.choose(0);
 assert.equal(h.nodes.get('nba-official-injuries').href,'https://official.nba.com/nba-injury-report-2026-27-season/');
 const before=h.requests.length;
 h.games[1].tipoff='2027-01-24T23:30:00Z';await h.choose(1);
 assert.equal(h.nodes.get('nba-official-injuries').href,'https://official.nba.com/nba-injury-report-2026-27-season/');
 assert.equal(h.requests.length,before+1);
});

test('selected NBA game loads official statuses, withdraws stale matchups, and marks unsubmitted teams',async()=>{
 const h=harness();h.games[0].tipoff=new Date(Date.now()+86400000).toISOString();h.games[0].statusCode=1;
 const base=h.context.fetch;let reportAt=Date.now();
 h.context.fetch=async url=>{
  if(!String(url).startsWith('/api/nba/injuries?'))return base(url);
  h.requests.push(url);
  return {ok:true,json:async()=>({gameId:h.games[0].id,tipoff:h.games[0].tipoff,reportAt,teams:[
   {name:'Chicago Bulls',available:true,players:[{name:'Nic Claxton',status:'Out'},{name:'Noa Essengue',status:'Questionable'}]},
   {name:'Milwaukee Bucks',available:false,players:[]}]})};
 };
 await h.load();await h.choose(0);
 assert.match(h.nodes.get('nba-injuries-list').textContent,/Chicago Bulls.*Nic Claxton.*Out.*Noa Essengue.*Questionable/);
 assert.match(h.nodes.get('nba-injuries-list').textContent,/Milwaukee Bucks.*not submitted or unavailable/);
 assert.match(h.nodes.get('nba-injuries-status').textContent,/Official NBA report/);
 reportAt=Date.now()-7200001;
 await h.nodes.get('nba-injuries-refresh').events.click();await h.settle();
 assert.equal(h.nodes.get('nba-injuries-list').textContent,'');
 assert.match(h.nodes.get('nba-injuries-status').textContent,/unavailable/);
 h.nodes.get('nba-clear').events.click();assert.equal(h.nodes.get('nba-injuries-list').textContent,'');
});

test('late NBA injury results cannot overwrite the newly selected game',async()=>{
 const h=harness();for(const g of h.games){g.tipoff=new Date(Date.now()+86400000).toISOString();g.statusCode=1;}
 const original=h.context.fetch;let release;
 h.context.fetch=url=>{
  if(!String(url).startsWith('/api/nba/injuries?'))return original(url);
  if(String(url).includes('game=899'))return new Promise(resolve=>{release=()=>resolve({ok:true,json:async()=>({gameId:899,tipoff:h.games[0].tipoff,reportAt:Date.now(),teams:[{name:'Old Team',available:true,players:[]},{name:'Old Opponent',available:true,players:[]}]})});});
  return Promise.resolve({ok:true,json:async()=>({gameId:900,tipoff:h.games[1].tipoff,reportAt:Date.now(),teams:[{name:'Cleveland Cavaliers',available:true,players:[]},{name:'Boston Celtics',available:true,players:[]}]})});
 };
 await h.load();await h.choose(0);await h.choose(1);release();await h.settle();await h.settle();
 assert.match(h.nodes.get('nba-injuries-list').textContent,/Cleveland Cavaliers/);
 assert.doesNotMatch(h.nodes.get('nba-injuries-list').textContent,/Old Team/);
});

test('NBA injury reports refresh only while the game page is visible and pregame',async()=>{
 const h=harness();h.games[0].tipoff=new Date(Date.now()+86400000).toISOString();h.games[0].statusCode=1;
 const base=h.context.fetch;
 h.context.fetch=async url=>{
  if(!String(url).startsWith('/api/nba/injuries?'))return base(url);
  h.requests.push(url);
  return {ok:true,json:async()=>({gameId:h.games[0].id,tipoff:h.games[0].tipoff,reportAt:Date.now(),teams:[{name:'Chicago Bulls',available:true,players:[]},{name:'Milwaukee Bucks',available:true,players:[]}]})};
 };
 await h.load();await h.choose(0);
 const timer=h.intervals.find(i=>i.ms===15*60000);assert.ok(timer);
 const calls=()=>h.requests.filter(x=>String(x).startsWith('/api/nba/injuries?')).length;
 assert.equal(calls(),1);
 h.context.document.hidden=true;timer.fn();await h.settle();assert.equal(calls(),1);
 h.context.document.hidden=false;timer.fn();await h.settle();await h.settle();assert.equal(calls(),2);
 h.games[0].tipoff=new Date(Date.now()-1000).toISOString();timer.fn();await h.settle();assert.equal(calls(),2);
});

test('first-half watch checks an open background tab and rejects stale scores',async()=>{
 const h=harness();let stamp=new Date().toISOString();
 const live={id:9,statusCode:2,period:2,halftime:false,home:'Home',away:'Away',homeScore:60,awayScore:40};
 h.context.fetch=async()=>({ok:true,json:async()=>({games:[live],checkedAt:stamp})});
 h.context.document.hidden=true;const toggle=h.nodes.get('nba-alert-enable');toggle.checked=true;toggle.events.change();await h.settle();
 assert.match(h.nodes.get('nba-alert-list').textContent,/Away down 20/);
 toggle.checked=false;toggle.events.change();stamp=new Date(Date.now()-600000).toISOString();toggle.checked=true;toggle.events.change();await h.settle();
 assert.match(h.nodes.get('nba-alert-status').textContent,/stale or unavailable/);
});


test('disabled NBA watch ignores an in-flight failure and schedules no more checks',async()=>{
 const h=harness();let reject;
 h.context.fetch=()=>new Promise((resolve,no)=>{reject=no;});
 const toggle=h.nodes.get('nba-alert-enable');toggle.checked=true;toggle.events.change();
 toggle.checked=false;toggle.events.change();reject(new Error('Delayed network error'));await h.settle();
 assert.equal(h.nodes.get('nba-alert-status').textContent,'Watch off.');
 assert.equal(h.timeouts.size,0);
});

test('restarting NBA watch discards old scores and starts exactly one fresh check',async()=>{
 const h=harness();let release;
 const live={id:9,statusCode:2,period:2,halftime:false,home:'Home',away:'Away',homeScore:60,awayScore:40};
 h.context.fetch=()=>new Promise(resolve=>{release=()=>resolve({ok:true,json:async()=>({games:[live],checkedAt:new Date().toISOString()})});});
 const toggle=h.nodes.get('nba-alert-enable');toggle.checked=true;toggle.events.change();
 toggle.checked=false;toggle.events.change();toggle.checked=true;toggle.events.change();
 release();await h.settle();assert.equal(h.nodes.get('nba-alert-list').children.length,0);
 assert.equal(h.timeouts.size,1);
 const [id,timer]=[...h.timeouts.entries()][0];assert.equal(timer.ms,0);h.timeouts.delete(id);
 h.context.fetch=async()=>({ok:true,json:async()=>({games:[live],checkedAt:new Date().toISOString()})});
 await timer.fn();assert.match(h.nodes.get('nba-alert-list').textContent,/Away down 20/);
 assert.equal(h.timeouts.size,1);assert.equal([...h.timeouts.values()][0].ms,60000);
});


test('NBA watch retries a temporary scoreboard failure instead of silently stopping',async()=>{
 const h=harness();h.context.fetch=async()=>({ok:false,status:503,json:async()=>({error:'Scoreboard unavailable.'})});
 const toggle=h.nodes.get('nba-alert-enable');toggle.checked=true;toggle.events.change();await h.settle();
 assert.equal(toggle.checked,true);assert.match(h.nodes.get('nba-alert-status').textContent,/Watch will retry/);
 assert.equal(h.timeouts.size,1);
});

test('NBA history expires locally, clears simulations and refresh restores the selected form',async()=>{
 const h=harness();let clock=Date.now();h.context.Date=class extends Date{static now(){return clock;}};
 h.games[0].tipoff=new Date(clock+86400000).toISOString();h.games[0].statusCode=1;
 h.context.Unit501NBAModel.project=()=>({available:true,away:110,home:108,total:218,homeSpread:2,awayGames:7,homeGames:7,explanation:''});
 await h.load();await h.choose(0);assert.match(h.nodes.get('nba-prediction').textContent,/110.0/);
 const expiry=[...h.timeouts.values()].find(t=>t.ms===3600001);assert.ok(expiry);
 clock+=3600001;expiry.fn();assert.match(h.nodes.get('nba-prediction').textContent,/stale/);
 assert.equal(h.nodes.get('nba-simulation').textContent,'');assert.equal(h.nodes.get('nba-team-comparison').children.length,0);
 h.nodes.get('nba-form-window').value='recent5';await h.nodes.get('nba-refresh-context').events.click();
 assert.match(h.nodes.get('nba-prediction').textContent,/110.0/);assert.equal(h.nodes.get('nba-form-window').value,'recent5');
});
test('NBA cannot project from missing or future source timestamps',async()=>{
 for(const checkedAt of [undefined,Date.now()+120000]){
  const h=harness(),base=h.context.fetch;h.context.Unit501NBAModel.project=()=>{throw Error('Unverified history reached model');};
  h.context.fetch=async url=>{const r=await base(url);if(!String(url).includes('/context?'))return r;const d=await r.json();return {ok:true,json:async()=>({...d,checkedAt})};};
  await h.load();await h.choose(0);assert.match(h.nodes.get('nba-prediction').textContent,/update time is unverified/);
 }
});
