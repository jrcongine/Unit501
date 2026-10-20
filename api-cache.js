'use strict';
// Share requests across visitors, including slow requests past the normal TTL.
function createCachedAPI(api,now=Date.now) {
  const cache=new Map(),pending=new Map();
  return endpoint=>{
    const url=new URL(endpoint,'https://provider.local');
    url.searchParams.sort();
    const key=url.pathname+url.search;
    const ttl=key.startsWith('/games/statistics/')?300000:key.startsWith('/games?')?60000:0;
    if(!ttl)return api(endpoint);
    if(pending.has(key))return pending.get(key);
    const old=cache.get(key);
    if(old&&now()-old.at<ttl)return Promise.resolve(old.data);
    const task=Promise.resolve().then(()=>api(endpoint)).then(data=>{
      if(Array.isArray(data?.response)&&data.response.length&&
        !(data.errors&&Object.keys(data.errors).length)&&!(data.paging?.total>1)){
        cache.set(key,{at:now(),data});
        if(cache.size>2000)cache.delete(cache.keys().next().value);
      }else cache.delete(key);
      return data;
    }).finally(()=>pending.delete(key));
    pending.set(key,task);
    return task;
  };
}
module.exports={createCachedAPI};
