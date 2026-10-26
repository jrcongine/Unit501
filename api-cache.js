'use strict';
// Share completed boxes across projections, ratings and repeated visitors.
function createCachedAPI(api,now=Date.now) {
  const cache=new Map();
  return endpoint=>{
    // Equivalent query order must share both the in-flight request and result.
    const [route,query]=endpoint.split('?');
    if(query){const params=new URLSearchParams(query);params.sort();endpoint=route+'?'+params.toString();}
    const ttl=endpoint.startsWith('/games/statistics/')?300000:endpoint.startsWith('/games?')?60000:0;
    if(!ttl)return api(endpoint);
    const old=cache.get(endpoint);
    if(old&&(old.at===null||now()-old.at<ttl))return old.pending;
    const item={at:null};
    item.pending=Promise.resolve().then(()=>api(endpoint)).then(data=>{
      if(!Array.isArray(data.response)||(data.errors&&Object.keys(data.errors).length)||data.paging?.total>1||!data.response.length){
        if(cache.get(endpoint)===item)cache.delete(endpoint);
      }else item.at=now();
      return data;
    }).catch(error=>{if(cache.get(endpoint)===item)cache.delete(endpoint);throw error;});
    cache.set(endpoint,item);
    if(cache.size>2000){
      // Never evict an active request and permit a duplicate paid call.
      for(const [key,value] of cache)if(value.at!==null){cache.delete(key);break;}
    }
    return item.pending;
  };
}
module.exports={createCachedAPI};
