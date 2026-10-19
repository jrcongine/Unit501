'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const core = require('../public/war-room-core');

const example = {
  id:'id1',date:'2026-10-14',matchup:'Kennesaw @ Missouri State',
  pick:'Kennesaw -3 (-110)',votes:{jr:'for',aria:'for',unit501:'against'},
  sources:{covers:'Kennesaw -3',wagertalk:'no posted pick',juicereel:'Old tracked record',ev:'Past EV note'},
  notes:'Check line',createdAt:'2026-10-14T14:00:00Z',result:'won'
};
test('legacy Big 12 decisions remain readable even though manual entry is gone', () => {
  const approved=core.normalize(example);
  assert.equal(core.decision(approved.votes).status,'approved');
  assert.equal(approved.sources.juicereel,'Old tracked record');
  assert.equal(approved.sources.ev,'Past EV note');
  assert.equal(core.ADVISERS.includes('ev'),false);
  const map = new Map();
  const storage={getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)};
  assert.equal(core.save(storage,[approved]),true);
  assert.deepEqual(core.load(storage),[approved]);
  assert.equal(core.summary([approved]).wins,1);
});
test('War Room is focused on public picks; no manual board vote form or decision log', () => {
  const html=fs.readFileSync(path.join(__dirname,'../public/index.html'),'utf8');
  assert.match(html,/id="war-feed"/);
  assert.match(html,/id="war-feed-refresh"/);
  assert.match(html,/id="war-feed-league"/);
  assert.match(html,/<option value="mlb">MLB<\/option>/);
  assert.match(html,/id="war-youtube-desk"/);
  assert.match(html,/id="war-archive"/);
  assert.match(html,/Big 12 Board stays in our chat/);
  assert.doesNotMatch(html,/GuyBostonSports|Ev Singleton|EV \/ Guy Boston/);
  for (const gone of ['war-form','war-list','war-matchup','war-pick','war-source-juicereel','war-vote-jr','war-vote-aria','war-vote-unit501','war-import']) {
    assert.doesNotMatch(html,new RegExp('id="'+gone+'"'),gone+' removed');
  }
  assert.match(html,/war-room-core\.js/);
  assert.match(html,/war-room\.js/);
});
test('past records section stays hidden when empty and enables a backup when old records exist', () => {
  const createEnv=(items)=>{
    const nodes=new Map();
    const ids=['war-archive','war-archive-count','war-export','war-message'];
    for(const id of ids){const node={hidden:id==='war-archive',listeners:{},textContent:'',addEventListener(event,fn){this.listeners[event]=fn;}};nodes.set(id,node);}
    const storageMap = new Map();
    const storage={getItem:k=>storageMap.get(k)||null,setItem:(k,v)=>storageMap.set(k,v)};
    core.save(storage,items);
    const body={append(){}};
    const ctx={window:{Unit501WarRoomCore:core},document:{getElementById:id=>nodes.get(id),body},localStorage:storage,Date,JSON,Blob,URL};
    vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../public/war-room.js'),'utf8'),ctx);
    return nodes;
  };
  const empty=createEnv([]);
  assert.equal(empty.get('war-archive').hidden,true);
  const filled=createEnv([core.normalize(example)]);
  assert.equal(filled.get('war-archive').hidden,false);
  assert.match(filled.get('war-archive-count').textContent,/1 saved/);
  assert.equal(typeof filled.get('war-export').listeners.click,'function');
});
test('YouTube scouting links remain supplemental, collapsed, and do not cast votes', () => {
  const html=fs.readFileSync(path.join(__dirname,'../public/index.html'),'utf8');
  const section=html.match(/<details id="war-youtube-desk"[\s\S]*?<\/details>/);
  assert.ok(section);
  assert.doesNotMatch(section[0],/<details[^>]*\bopen>/);
  const links=[...section[0].matchAll(/href="(https:\/\/www\.youtube\.com\/[^"]+)"/g)].map(x=>x[1]);
  assert.equal(links.length,5);
  assert.doesNotMatch(section[0],/GuyBostonSports|Ev Singleton/);
});
