'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
// Minimal DOM harness for actual client scripts; it does not test rendering.
function harness(storage=new Map(),extras=false) {
 const nodes=new Map(),timers=[];
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
 const document=new Node('document');document.createElement=tag=>new Node(tag);document.getElementById=id=>nodes.get(id)||null;
 const html=fs.readFileSync(path.join(__dirname,'../public/index.html'),'utf8');
 for(const match of html.matchAll(/<(\w+)[^>]*\bid="([^"]+)"[^>]*>/g)){const node=new Node(match[1]);node.id=match[2];}
 nodes.get('date').value='2026-10-10';nodes.get('league').value='1';nodes.get('weatherEnabled').checked=true;
 const context={document,console,URLSearchParams,AbortSignal,Date,Event:class{constructor(type){this.type=type;}},setTimeout:fn=>{timers.push(fn);return timers.length;},clearTimeout(){},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)}};
 context.window=context;vm.createContext(context);
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
  else if(u.pathname==='/api/fanduel-props')response={props:[{name:'RB 1',stat:'carries',line:19.5,updatedAt:Date.now()},{name:'RB 1',stat:'recYds',line:22.5,updatedAt:Date.now()},{name:'RB 1',stat:'rec',line:3.5,updatedAt:Date.now()}],message:'Fixture props'};
  else if(u.pathname==='/api/availability')response={current:true,teams:['1','2'].map(id=>({id,roster:{available:true,checkedAt:Date.now(),rows:[{id:id==='1'?'7':'8',name:'RB '+id,position:'RB'},...(id==='1'?[{id:'9',name:'ZZBackup',position:'RB'}]:[])]},injuries:{available:true,checkedAt:Date.now(),rows:context.injuryOut?[{id:'7',teamId:'1',status:'Out',date:new Date().toISOString()}]:[]}})),message:'Fixture'};
  else if(u.pathname==='/api/player-ratings')response={state:'ready',data:{league:'1',season:'2026',before:stamp*1000,players:[{id:'7',teamId:'1',name:'RB 1',position:'RB',role:'RB',rating:80,trend:'Steady',games:4,coverage:[{count:4}],profiles:{rushing:{usage:20,efficiency:5,games:4,latestMissing:false,coverage:{recorded:4,total:4}}}},{id:'9',teamId:'1',name:'ZZBackup',position:'RB',role:'RB',rating:45,trend:'Steady',games:4,coverage:[{count:4}],profiles:{rushing:{usage:5,efficiency:3,games:4,latestMissing:false,coverage:{recorded:4,total:4}}}}]}};
  else throw Error('Unexpected client request '+url);
  if(extras&&u.pathname==='/api/player-stats')response.response[0].groups[0].players.push({player:{id:9,name:'ZZBackup'},statistics:[{name:'Total Rushes',value:5},{name:'Yards',value:15}]});
  return {ok:true,json:async()=>response};
 };
 const run=source=>vm.runInContext(source,context);
 for(const file of ['probability-calibration.js','team-model.js','app.js','injury-model.js','player-form.js','player-stats.js','predictions.js'])run(fs.readFileSync(path.join(__dirname,'../public',file),'utf8'));
 if(extras)for(const file of ['availability.js','lineup-model.js','player-ratings-ui.js'])run(fs.readFileSync(path.join(__dirname,'../public',file),'utf8'));
 const settle=()=>new Promise(resolve=>setImmediate(resolve));
 return {nodes,storage,run,game,data,timers,settle,context};
}
test('actual client flow allows scoring during ranking build and persists manual RB prop lines across reload/refresh',async()=>{
 const h=harness();await h.settle();h.run('$("league").value="1"');h.run(`choose(parseGame(${JSON.stringify(h.game)}))`);await h.settle();
 assert.match(h.nodes.get('team-context').textContent,/Scoring is ready/);
 h.run('sim()');assert.equal(h.nodes.get('score').textContent,'24–24');
 await h.nodes.get('predict').dispatchEvent({type:'click'});await h.settle();
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

test('actual ratings, roster, replacement, score and prop flows share one scenario and refresh gates it',async()=>{
 const h=harness(new Map(),true);await h.settle();h.run(`choose(parseGame(${JSON.stringify(h.game)}))`);await h.settle();await h.settle();
 await h.nodes.get('build-player-ratings').onclick();await h.settle();
 const confirm=h.nodes.get('baseline-1:7'),replacement=h.nodes.get('replacement-1:7'),workload=h.nodes.get('workload-1:7');
 assert.ok(confirm);confirm.checked=true;replacement.value='9';workload.value='0';workload.onchange();
 const scenario=JSON.parse(h.run('JSON.stringify(window.Unit501Lineups.evaluate())'));assert.equal(scenario.applied,true);assert.equal(scenario.props['1:9'].rushing.extraUsage,20);
 h.run('sim()');assert.equal(h.nodes.get('score').textContent,'23–24');
 await h.nodes.get('predict').dispatchEvent({type:'click'});await h.settle();
 assert.match(h.nodes.get('predict-results').textContent,/0.0 projected/);
 h.nodes.get('predict-player').value='1:9';await h.nodes.get('predict-player').dispatchEvent({type:'change'});
 assert.match(h.nodes.get('predict-results').textContent,/75.0 projected/);
 // An unavailable replacement invalidates transferred output after a report refresh.
 h.context.injuryOut=true;
 h.run("Unit501Availability.snapshot().teams[0].injuries.rows=[{id:'9',teamId:'1',status:'Out',date:new Date().toISOString()}];document.dispatchEvent(new Event('unit501:availability-updated'))");await h.settle();
 assert.equal(h.run('window.Unit501Lineups.evaluate().applied'),false);h.run('sim()');assert.equal(h.nodes.get('score').textContent,'24–24');
 // A confirmed baseline starter newly reported out loses all normal workload,
 // even if the scenario dropdown previously remained at 100 percent.
 h.run("Unit501Availability.snapshot().teams[0].injuries.rows=[{id:'7',teamId:'1',status:'Out',date:new Date().toISOString()}]");workload.value='100';workload.onchange();
 assert.equal(h.run('window.Unit501Lineups.evaluate().props["1:7"].rushing.scale'),0);
});
