'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {observe}=require('../public/line-watch');
function fixture(){const m=new Map();return {getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v),raw:m};}
test('line watch remembers first observed verified quote and only moves on newer feed timestamps',()=>{
 const s=fixture(),now=1_000_000_000;
 let first=observe(s,'1:2026:99:game:total',41.5,now-1000,now);
 assert.equal(first.changed,false);assert.equal(first.firstLine,41.5);
 let second=observe(s,'1:2026:99:game:total',42.5,now,now);
 assert.equal(second.changed,true);assert.equal(second.delta,1);
 assert.equal(second.firstLine,41.5);assert.equal(second.line,42.5);
 const stale=observe(s,'1:2026:99:game:total',35.5,now-30000,now);
 assert.equal(stale.line,42.5);
 const other=observe(s,'1:2026:99:game:spread',-2.5,now,now);
 assert.equal(other.firstLine,-2.5);assert.equal(other.changed,false);
 assert.equal(observe(s,'1:2026:99:game:total',42.5,now,now).delta,1);
});
test('line watch excludes stale, future, invalid and polluted data rather than showing false market movement',()=>{
 const s=fixture(),now=1_000_000_000;
 for(const [line,at] of [[NaN,now],[42.25,now],[42.5,now-1800001],[42.5,now+60001]])
  assert.equal(observe(s,'x',line,at,now),null);
 assert.equal(s.raw.size,0);
 s.raw.set('unit501:observed-fanduel:v1:x','malformed');
 assert.equal(observe(s,'x',42.5,now,now),null);
 assert.equal(observe(s,'',42.5,now,now),null);
});
