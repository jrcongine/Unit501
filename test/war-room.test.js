'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const core = require('../public/war-room-core');

test('three independent votes: two decide, otherwise undecided', () => {
  assert.equal(core.decision({jr:'for',aria:'for',unit501:'against'}).status, 'approved');
  assert.equal(core.decision({jr:'for',aria:'against',unit501:'against'}).status, 'rejected');
  assert.equal(core.decision({jr:'for',aria:'against',unit501:'pending'}).status, 'undecided');
  assert.equal(core.decision({jr:'for',aria:'for',unit501:'for'}).yes, 3);
  assert.equal(core.decision({jr:'for',aria:'for',unit501:'invalid'}).missing, 1);
});
const example = {
  id:'id1', date:'2026-10-14', matchup:'Kennesaw @ Missouri State',
  pick:'Kennesaw -3 (-110)', votes:{jr:'for',aria:'for',unit501:'against'},
  sources:{covers:'Kennesaw -3', wagertalk:'no posted pick', ev:'unknown'},
  notes:'Check line', createdAt:'2026-10-14T14:00:00Z', result:'pending'
};
test('normalizes handwritten source opinions and rejects incomplete candidates', () => {
  const row = core.normalize(example);
  assert.equal(row.sources.covers,'Kennesaw -3');
  assert.equal(row.sources.juicereel,'');
  assert.equal(core.normalize({...example,matchup:'  '}),null);
  assert.equal(core.normalize({...example,pick:''}),null);
  assert.equal(core.normalize({...example,date:'tomorrow'}),null);
  assert.equal(core.normalize({...example,votes:{jr:'for',aria:'fake',unit501:'pending'}}).votes.aria,'pending');
  assert.equal(core.normalize({...example,result:'fake'}).result,'pending');
});
test('local archive survives malformed data and calculates only board-approved W-L', () => {
  const map=new Map();
  const storage={getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)};
  const approved=core.normalize({...example,result:'won'});
  const rejected=core.normalize({...example,id:'id2',votes:{jr:'against',aria:'against',unit501:'for'},result:'lost'});
  const pushed=core.normalize({...example,id:'id3',result:'push'});
  const pending=core.normalize({...example,id:'id4',result:'pending'});
  assert.equal(core.save(storage,[approved,rejected,pushed,pending]),true);
  assert.equal(core.load(storage).length,4);
  assert.deepEqual(core.summary([approved,rejected,pushed,pending]),{
    logged:4,approved:3,wins:1,losses:0,pushes:1,pending:1
  });
  map.set(core.KEY,'{broken');
  assert.deepEqual(core.load(storage),[]);
  assert.equal(core.save({setItem(){throw Error('Storage disabled');}},[approved]),false);
});
test('index exposes the War Room and source links without claiming auto verified picks', () => {
  const html=fs.readFileSync(path.join(__dirname,'../public/index.html'),'utf8');
  for(const id of ['war-room','war-form','war-list','war-matchup','war-pick','war-source-covers','war-source-ev','war-vote-jr','war-vote-aria','war-vote-unit501','war-export','war-import'])assert.match(html,new RegExp('id="'+id+'"'));
  assert.match(html,/war-room-core\.js/);
  assert.match(html,/war-room\.js/);
  assert.match(html,/public selections appear here automatically/);
});
test('real UI saves and grades a board-approved candidate on browser-local storage', async () => {
  const html=fs.readFileSync(path.join(__dirname,'../public/index.html'),'utf8');
  const nodes=new Map(),storageMap=new Map(),all=[];
  class Node {
    constructor(tag){this.tag=tag;this.children=[];this.listeners={};this.classList={contains(){return false;}};this._value='';this._text='';}
    set id(v){this._id=v;nodes.set(v,this);} get id(){return this._id;}
    set value(v){this._value=v;} get value(){return this._value;}
    set textContent(v){this._text=String(v);this.children=[];} get textContent(){return this._text+this.children.map(c=>c.textContent||'').join('');}
    append(...children){this.children.push(...children);}
    replaceChildren(...children){this.children=[];this._text='';this.append(...children);}
    setAttribute(){}
    addEventListener(event,fn){(this.listeners[event]??=[]).push(fn);}
    fire(event,arg={}){for(const fn of this.listeners[event]||[])fn({preventDefault(){},target:this,...arg});}
  }
  const document={createElement(tag){const node=new Node(tag);all.push(node);return node;},
    getElementById:id=>nodes.get(id)||null,body:new Node('body')};
  for(const match of html.matchAll(/<(\w+)[^>]*\bid="([^"]+)"[^>]*>/g)){const node=new Node(match[1]);node.id=match[2];}
  const localStorage={getItem:k=>storageMap.get(k)||null,setItem:(k,v)=>storageMap.set(k,v)};
  const window={Unit501WarRoomCore:core,confirm:()=>true};
  const ctx={window,document,localStorage,Date,Math,JSON,URL,Blob};
  nodes.get('date').value='2026-10-14';
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../public/war-room.js'),'utf8'),ctx);
  nodes.get('war-matchup').value='Kennesaw @ Missouri State';
  nodes.get('war-pick').value='Kennesaw -3 (-110)';
  nodes.get('war-vote-jr').value='for';
  nodes.get('war-vote-aria').value='for';
  nodes.get('war-vote-unit501').value='against';
  nodes.get('war-source-covers').value='Source pick and price';
  nodes.get('war-form').fire('submit');
  assert.equal(core.load(localStorage).length,1);
  assert.equal(core.decision(core.load(localStorage)[0].votes).status,'approved');
  assert.match(nodes.get('war-stats').textContent,/1 board-approved/);
  const grade=all.find(node=>node.tag==='select'&&node.children.some(child=>child.textContent==='Won'));
  assert.ok(grade);
  grade.value='won';
  grade.fire('change');
  assert.equal(core.load(localStorage)[0].result,'won');
  assert.match(nodes.get('war-stats').textContent,/1W–0L/);
});


test('YouTube scouting desk links six real channels and preserves independent board voting', () => {
  const html = fs.readFileSync(path.join(__dirname,'../public/index.html'),'utf8');
  const section = html.match(/<details id="war-youtube-desk"[\s\S]*?<\/details>/);
  assert.ok(section,'Scouting desk exists');
  const videoLinks = [...section[0].matchAll(/href="(https:\/\/www\.youtube\.com\/[^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(videoLinks, [
    'https://www.youtube.com/@kylekirms/videos',
    'https://www.youtube.com/@theactionnetwork/videos',
    'https://www.youtube.com/@SportsLine/videos',
    'https://www.youtube.com/@BettingPros/videos',
    'https://www.youtube.com/@WagerTalk/videos',
    'https://www.youtube.com/c/GuyBostonSports/videos'
  ]);
  assert.match(section[0],/EV and Guy Boston Sports are the same source/);
  assert.match(section[0],/rel="noopener noreferrer"/);
  assert.match(html,/id="war-vote-jr"/);
  assert.match(html,/id="war-vote-aria"/);
  assert.match(html,/id="war-vote-unit501"/);
  assert.equal(core.MEMBERS.length,3);
  assert.equal(core.ADVISERS.length,4);
});
