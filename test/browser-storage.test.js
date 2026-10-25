'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {create,markerKey}=require('../public/browser-storage');
const A='customer:00000000-0000-4000-8000-00000000000a';
const B='customer:00000000-0000-4000-8000-00000000000b';
function setup(){
 const values=new Map();
 const raw={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)};
 let locked=0;
 const manager=scope=>create({raw,scope,onMismatch:()=>locked++});
 return {values,raw,manager,get locked(){return locked;}};
}
test('customers cannot read the owner archive or another customer namespace; owner legacy keys survive',()=>{
 const h=setup(),key='unit501-score-archive-v1';
 h.raw.setItem(key,'owner archive');
 const a=h.manager(A);a.activate(A,a.snapshot());
 assert.equal(a.storage.getItem(key),null);a.storage.setItem(key,'A archive');
 const b=h.manager(B);b.activate(B,b.snapshot());
 assert.equal(b.storage.getItem(key),null);b.storage.setItem(key,'B archive');
 assert.throws(()=>a.storage.getItem(key),/account changed/);
 assert.throws(()=>a.storage.setItem(key,'stale overwrite'),/account changed/);
 assert.equal(b.storage.getItem(key),'B archive');
 const owner=h.manager('owner');owner.activate('owner',owner.snapshot());
 assert.equal(owner.storage.getItem(key),'owner archive');
 const again=h.manager(A);again.activate(A,again.snapshot());assert.equal(again.storage.getItem(key),'A archive');
 assert.equal(h.raw.getItem(key),'owner archive');
});
test('sign-out denies reads and writes from stale dashboard tabs before storage events are delivered',()=>{
 const h=setup(),a=h.manager(A);a.activate(A,a.snapshot());a.storage.setItem('pick','private');
 const tab=h.manager(A);assert.equal(tab.storage.getItem('pick'),'private');
 a.activate('guest',a.snapshot());
 assert.throws(()=>tab.storage.getItem('pick'),/account changed/);
 assert.throws(()=>tab.storage.setItem('pick','after logout'),/account changed/);
 assert.throws(()=>a.storage.getItem('pick'),/account changed/);
 const login=h.manager(A);login.activate(A,login.snapshot());assert.equal(login.storage.getItem('pick'),'private');
});
test('returning to the same identity with a new epoch still locks an old tab',()=>{
 const h=setup(),a=h.manager(A);a.activate(A,a.snapshot());
 const tab=h.manager(A);
 a.activate('guest',a.snapshot());a.activate(A,a.snapshot());
 assert.equal(tab.check(),false);assert.throws(()=>tab.storage.setItem('pick','stale'),/account changed/);
});
test('a profile refresh for the same account does not rotate the lease or reload other tabs',()=>{
 const h=setup(),a=h.manager(A);a.activate(A,a.snapshot());
 const tab=h.manager(A),before=a.snapshot();
 a.activate(A,before);assert.equal(a.snapshot(),before);assert.equal(tab.check(),true);
 a.activate(A,before,true);assert.equal(tab.check(),false);
});
test('a delayed authentication response cannot activate over a newer account switch',()=>{
 const h=setup(),a=h.manager(A);a.activate(A,a.snapshot());const before=a.snapshot();
 const b=h.manager(B);b.activate(B,b.snapshot());
 assert.throws(()=>a.activate(A,before),/another tab/);
 assert.equal(JSON.parse(h.raw.getItem(markerKey)).scope,B);assert.equal(b.check(),true);
});
test('invalid or missing scope and malformed identity markers fail closed without exposing owner data',()=>{
 const h=setup();h.raw.setItem('pick','owner private');
 const guest=h.manager('guest');assert.throws(()=>guest.storage.getItem('pick'),/account changed/);
 assert.throws(()=>h.manager('../../owner'),/Invalid/);
 const a=h.manager(A);a.activate(A,a.snapshot());h.raw.setItem(markerKey,'corrupt');
 assert.equal(a.check(),false);assert.throws(()=>a.storage.getItem('pick'),/account changed/);
 assert.equal(h.raw.getItem('pick'),'owner private');
});
test('the browser removes a stale visible dashboard and navigates to accounts on a cross-tab change',()=>{
 const h=setup(),a=h.manager(A);a.activate(A,a.snapshot());
 const handlers={},navigations=[];
 const window={localStorage:h.raw,document:{body:{dataset:{unit501Scope:A}},documentElement:{style:{}}},location:{pathname:'/',replace:url=>navigations.push(url)},addEventListener:(name,fn)=>handlers[name]=fn};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../public/browser-storage.js'),'utf8'),{window});
 assert.equal(navigations.length,0);
 const b=h.manager(B);b.activate(B,b.snapshot());handlers.storage({key:markerKey});
 assert.equal(window.document.documentElement.style.visibility,'hidden');assert.deepEqual(navigations,['/account.html']);
 assert.throws(()=>window.Unit501Storage.getItem('pick'),/account changed/);
});
