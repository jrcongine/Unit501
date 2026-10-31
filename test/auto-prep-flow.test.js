'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function harness(league='1'){
 const nodes=new Map(),listeners={};
 const node=()=>({listeners:{},style:{},value:'',append(){},after(){},setAttribute(){},addEventListener(k,f){this.listeners[k]=f;},dispatchEvent(e){return this.listeners[e.type]?.(e);}});
 for(const id of ['lab','matchup','spread','total','autoInjuries','weatherEnabled','predict'])nodes.set(id,node());
 const document={getElementById:id=>nodes.get(id),createElement(){const n=node();Object.defineProperty(n,'id',{set(id){nodes.set(id,n);}});return n;},addEventListener(k,f){(listeners[k]??=[]).push(f);}};
 const game={id:'1',league},context={document,selected:game,scoringContext:{game,data:{}},gameQuotes:{game},forecastContext:{game,settled:false},Date,Event:class{constructor(type){this.type=type;}},setTimeout:f=>f(),ready:false,calls:0,valid:true};
 context.window=context;context.Unit501Availability={snapshot:()=>({})};context.Unit501AutoInjury={evaluate:()=>({ready:context.ready})};context.sim=()=>{context.calls++;return context.valid;};
 nodes.get('spread').value='3.5';nodes.get('total').value='45.5';nodes.get('autoInjuries').checked=true;nodes.get('weatherEnabled').checked=true;
 vm.runInNewContext(fs.readFileSync(require.resolve('../public/auto-prep.js'),'utf8'),context);
 const fire=k=>(listeners[k]||[]).forEach(f=>f());
 return {context,nodes,fire,start:()=>nodes.get('auto-prep-now').dispatchEvent({type:'click'})};
}
test('NFL and college automatic runs wait for both injury context and settled weather',()=>{
 for(const league of ['1','2']){const h=harness(league);h.start();assert.equal(h.context.calls,0);h.context.ready=true;h.fire('unit501:availability-updated');assert.equal(h.context.calls,0);h.context.forecastContext.settled=true;h.fire('unit501:weather-updated');assert.equal(h.context.calls,1);h.fire('unit501:team-context-updated');assert.equal(h.context.calls,1);}
});
test('failed model preparation can retry; user edits are preserved',()=>{
 const h=harness();h.context.ready=true;h.context.forecastContext.settled=true;h.context.valid=false;h.start();assert.equal(h.context.calls,1);assert.match(h.nodes.get('auto-prep-status').textContent,/waiting for usable/);
 h.context.valid=true;h.fire('unit501:team-context-updated');assert.equal(h.context.calls,2);
 const next=harness();next.start();next.nodes.get('lab').dispatchEvent({type:'input'});next.context.ready=true;next.context.forecastContext.settled=true;next.fire('unit501:weather-updated');assert.equal(next.context.calls,0);next.start();assert.equal(next.context.calls,1);
});

test('invalidated automatic results refresh on new data and manual completion restores the banner',()=>{
 const h=harness();h.context.ready=true;h.context.forecastContext.settled=true;h.start();
 assert.match(h.nodes.get('auto-prep-status').textContent,/simulation completed/);
 h.fire('unit501:simulation-invalidated');
 assert.match(h.nodes.get('auto-prep-status').textContent,/needs rerunning/);
 h.fire('unit501:availability-updated');
 assert.equal(h.context.calls,2);
 assert.match(h.nodes.get('auto-prep-status').textContent,/simulation completed/);
 h.fire('unit501:simulation-completed');
 assert.match(h.nodes.get('auto-prep-status').textContent,/simulation completed/);
});

test('fresh data never overwrites edited inputs and expired injury evidence still blocks reruns',()=>{
 for(const league of ['1','2']){
  const h=harness(league);h.context.ready=true;h.context.forecastContext.settled=true;h.start();
  h.fire('unit501:simulation-invalidated');h.context.ready=false;h.fire('unit501:availability-updated');assert.equal(h.context.calls,1);
  h.context.ready=true;h.fire('unit501:lineup-updated');assert.equal(h.context.calls,2);
  h.nodes.get('lab').dispatchEvent({type:'input'});h.fire('unit501:simulation-invalidated');
  for(const event of ['unit501:availability-updated','unit501:weather-updated','unit501:lineup-updated'])h.fire(event);
  assert.equal(h.context.calls,2);
 }
});
