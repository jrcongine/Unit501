'use strict';
// Share completed boxes across projections, ratings and repeated visitors.
function createCachedAPI(api,now=Date.now) {
  const cache=new Map();
  return endpoint=>{
    const ttl=endpoint.startsWith('/games/statistics/')?300000:endpoint.startsWith('/games?')?60000:0;
    if(!ttl)return api(endpoint);
    const old=cache.get(endpoint);
    if(old&&now()-old.at<ttl)return old.pending;
    const item={at:now()};
    item.pending=Promise.resolve().then(()=>api(endpoint)).then(data=>{
      if(!Array.isArray(data.response)||(data.errors&&Object.keys(data.errors).length)||data.paging?.total>1||!data.response.length)cache.delete(endpoint);
      return data;
    }).catch(error=>{if(cache.get(endpoint)===item)cache.delete(endpoint);throw error;});
    cache.set(endpoint,item);
    if(cache.size>2000)cache.delete(cache.keys().next().value);
    return item.pending;
  };
}
module.exports={createCachedAPI};
