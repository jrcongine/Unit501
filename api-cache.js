'use strict';
// Share completed boxes across projections, ratings and repeated visitors.
function createCachedAPI(api,now=Date.now) {
  const cache=new Map(),uncachedFlights=new Map();
  return endpoint=>{
    // Equivalent query order must share both the in-flight request and result.
    const [route,query]=endpoint.split('?');
    const scope=new URLSearchParams(query||'');
    const displaySlate=route==='/games'&&scope.has('date')&&scope.has('league');
    if(query){const params=new URLSearchParams(query);params.sort();endpoint=route+'?'+params.toString();}
    const ttl=endpoint.startsWith('/games/statistics/')?300000:endpoint.startsWith('/games?')?60000:0;
    if(!ttl){
      // Rosters and injuries remain uncached, but simultaneous consumers share
      // the same GET instead of spending several identical provider requests.
      if(uncachedFlights.has(endpoint))return uncachedFlights.get(endpoint);
      const pending=Promise.resolve().then(()=>api(endpoint)).finally(()=>{if(uncachedFlights.get(endpoint)===pending)uncachedFlights.delete(endpoint);});
      uncachedFlights.set(endpoint,pending);return pending;
    }
    const old=cache.get(endpoint);
    if(old&&(old.at===null||now()-old.at<ttl))return old.pending;
    const item={at:null};
    item.pending=Promise.resolve().then(()=>api(endpoint)).then(data=>{
      if(!Array.isArray(data.response)||(data.errors&&Object.keys(data.errors).length)||data.paging?.total>1||!data.response.length){
        if(cache.get(endpoint)===item)cache.delete(endpoint);
      }else {item.at=now();item.data=data;}
      return data;
    }).catch(error=>{
      // A dated game list may remain useful during a short provider throttle.
      // Never use this fallback for odds, player stats, or old/foreign slates.
      if(displaySlate&&error.code==='FOOTBALL_COOLDOWN'&&old?.data&&old.at!==null&&now()-old.at>=0&&now()-old.at<=600000){
        if(cache.get(endpoint)===item)cache.set(endpoint,old);
        return {...old.data,cache:{stale:true,storedAt:old.at,retryAt:error.retryAt,reason:'provider-cooldown'}};
      }
      if(cache.get(endpoint)===item)cache.delete(endpoint);throw error;
    });
    cache.set(endpoint,item);
    if(cache.size>2000){
      // Never evict an active request and permit a duplicate paid call.
      for(const [key,value] of cache)if(value.at!==null){cache.delete(key);break;}
    }
    return item.pending;
  };
}
module.exports={createCachedAPI};
