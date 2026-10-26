'use strict';
// Reuse the already displayed slate when refreshing NBA availability. Requests
// from many visible tabs share one verified schedule load per date per TTL.
function createSlateCache(load,{now=Date.now,ttl=15*60000,maxEntries=20}={}){
 const cache=new Map();
 function trim(){
  while(cache.size>maxEntries){
   const completed=[...cache].find(([,value])=>value.done);
   if(!completed)break;
   cache.delete(completed[0]);
  }
 }
 function remember(date,slate){
  cache.delete(date);cache.set(date,{at:now(),pending:Promise.resolve(slate),done:true});
  trim();
 }
 async function get(date){
  const existing=cache.get(date);
  if(existing&&(!existing.done||now()-existing.at<ttl))return existing.pending;
  const item={done:false,at:now()};
  item.pending=Promise.resolve().then(()=>load(date)).then(slate=>{
   item.done=true;item.at=now();trim();return slate;
  }).catch(error=>{if(cache.get(date)===item)cache.delete(date);throw error;});
  cache.set(date,item);
  // Do not evict pending work and start duplicate paid requests.
  trim();
  return item.pending;
 }
 get.remember=remember;return get;
}
module.exports={createSlateCache};
