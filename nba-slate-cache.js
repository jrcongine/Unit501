'use strict';
// Reuse the already displayed slate when refreshing NBA availability. Requests
// from many visible tabs share one verified schedule load per date per TTL.
function createSlateCache(load,{now=Date.now,ttl=15*60000,maxEntries=20}={}){
 const cache=new Map();
 function remember(date,slate){
  cache.delete(date);cache.set(date,{at:now(),pending:Promise.resolve(slate),done:true});
  while(cache.size>maxEntries)cache.delete(cache.keys().next().value);
 }
 async function get(date){
  const existing=cache.get(date);
  if(existing&&(!existing.done||now()-existing.at<ttl))return existing.pending;
  const item={done:false,at:now()};
  item.pending=Promise.resolve().then(()=>load(date)).then(slate=>{
   item.done=true;item.at=now();return slate;
  }).catch(error=>{if(cache.get(date)===item)cache.delete(date);throw error;});
  cache.set(date,item);
  // Do not evict pending work and start duplicate paid requests.
  if(cache.size>maxEntries)for(const [key,value] of cache)if(value.done){cache.delete(key);break;}
  return item.pending;
 }
 get.remember=remember;return get;
}
module.exports={createSlateCache};
