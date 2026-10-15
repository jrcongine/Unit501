'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
test('War Room reloads public sources when the visible open panel has aged five minutes',async()=>{
 class Node{
  constructor(){this.listeners={};this.children=[];this.textContent='';this.open=false;this.value='1';}
  addEventListener(event,fn){(this.listeners[event]??=[]).push(fn);}
  fire(event){for(const fn of this.listeners[event]||[])fn();}
  append(...items){this.children.push(...items);}
  replaceChildren(...items){this.children=[...items];}
 }
 const names=['war-room','war-feed','war-feed-league','war-feed-status','war-feed-refresh'];
 const nodes=new Map(names.map(n=>[n,new Node()]));
 nodes.get('war-room').open=true;
 let now=1000000000,calls=0;const timers=[];
 const document={hidden:false,getElementById:id=>nodes.get(id),createElement:()=>new Node(),
  addEventListener(event,fn){(this.listeners??={})[event]=fn;},listeners:{}};
 class FakeDate extends Date{static now(){return now;}}
 const context={document,Date:FakeDate,console,
  AbortSignal:{timeout:()=>({})},encodeURIComponent,
  setTimeout:(fn,delay)=>{const id=timers.length+1;timers.push({fn,delay,active:true});return id;},
  clearTimeout:id=>{if(timers[id-1])timers[id-1].active=false;},
  fetch:async()=>{calls++;return {ok:true,json:async()=>({sources:[{name:'Covers',status:'available',message:'public feed',
    checkedAt:new Date(now).toISOString(),picks:[]}],manual:[]})};}
 };
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../public/outside-picks.js'),'utf8'),context);
 const settle=()=>new Promise(resolve=>setImmediate(resolve));
 await settle();
 assert.equal(calls,1);assert.match(nodes.get('war-feed-status').textContent,/0 public selections/);
 now+=240000;
 let timer=timers.findLast(t=>t.active);timer.fn();await settle();
 assert.equal(calls,1);
 now+=60001;
 timer=timers.findLast(t=>t.active);timer.fn();await settle();
 assert.equal(calls,2);
 document.hidden=true;now+=360000;
 timer=timers.findLast(t=>t.active);timer.fn();await settle();assert.equal(calls,2);
 document.hidden=false;document.listeners.visibilitychange();await settle();assert.equal(calls,3);
 nodes.get('war-room').open=false;nodes.get('war-room').fire('toggle');
 assert.equal(timers.findLast(t=>t.active)?.active??false,false);
 now+=360000;
 document.listeners.visibilitychange();await settle();assert.equal(calls,3);
});
