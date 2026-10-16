'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
test('manual comparison handles missing/zero/invalid data and clears without making picks',()=>{
 const nodes=Object.fromEntries(['bets','dollars','result','selection','clear'].map(k=>['war-money-'+k,{value:'',textContent:'',events:{},addEventListener(e,f){this.events[e]=f;}}]));
 vm.runInNewContext(fs.readFileSync(require.resolve('../public/public-money.js'),'utf8'),{document:{getElementById:id=>nodes[id]}});
 const b=nodes['war-money-bets'],m=nodes['war-money-dollars'],r=nodes['war-money-result'];
 b.value='35';b.events.input();assert.match(r.textContent,/unknown, not zero/);
 m.value='60';m.events.input();assert.match(r.textContent,/\+25 percentage points/);
 m.value='0';m.events.input();assert.match(r.textContent,/-35 percentage points/);
 m.value='101';m.events.input();assert.match(r.textContent,/0 to 100/);
 nodes['war-money-clear'].events.click();assert.equal(b.value,'');assert.equal(m.value,'');assert.match(r.textContent,/unknown/);
});
