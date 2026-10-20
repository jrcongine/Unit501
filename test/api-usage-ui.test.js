'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const vm=require('node:vm'),fs=require('node:fs');
test('usage refresh reads only local meter, shows deltas, and resets on restart/day rollover',async()=>{
 function node(){return {textContent:'',children:[],handlers:{},append(x){this.children.push(x)},replaceChildren(){this.children=[]},addEventListener(k,fn){this.handlers[k]=fn}};}
 const nodes=Object.fromEntries(['panel','refresh','message','details'].map(k=>['api-usage-'+k,node()]));
 let reading={outboundAttempts:10,budget:1500,remaining:1490,dateUTC:'2026-10-20',startedAt:'2026-10-20T14:00:00Z',byCategory:{schedules:10},failedResponses:0,blockedByGuard:0};
 const urls=[];
 vm.runInNewContext(fs.readFileSync(require.resolve('../public/api-usage.js'),'utf8'),{
  document:{getElementById:id=>nodes[id],createElement:node},Intl,Date,AbortSignal,
  fetch:async url=>{urls.push(url);return {ok:true,json:async()=>reading}}
 });
 const refresh=nodes['api-usage-refresh'].handlers.click;
 const delta=()=>nodes['api-usage-details'].children[0].textContent;
 await refresh();assert.match(delta(),/^0 outgoing/);
 reading={...reading,outboundAttempts:17};await refresh();assert.match(delta(),/^7 outgoing/);
 reading={...reading,outboundAttempts:2,startedAt:'2026-10-20T15:00:00Z'};await refresh();assert.match(delta(),/^0 outgoing/);
 reading={...reading,outboundAttempts:3,dateUTC:'2026-10-21'};await refresh();assert.match(delta(),/^0 outgoing/);
 assert.deepEqual(urls,Array(4).fill('/api/provider-usage'));
});
