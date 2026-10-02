'use strict';
// Team-season player lists are provider rosters, not verified transaction histories.
function createAvailability(api, now = Date.now) {
  const cache = new Map();
  async function read(path, ttl) {
    const old = cache.get(path);
    if (old && now() - old.at < ttl) return old.pending;
    const item = {at:now()};
    item.pending = (async () => {
      const data = await api(path);
      if (data.errors && Object.keys(data.errors).length) throw new Error('Provider could not supply this report.');
      if (!Array.isArray(data.response)) throw new Error('Provider returned an invalid report.');
      if (data.paging?.total > 1) throw new Error('Provider returned an incomplete paginated report.');
      return {rows:data.response,checkedAt:now()};
    })();
    cache.set(path,item);
    if(cache.size>500) cache.delete(cache.keys().next().value);
    item.pending.catch(()=>{if(cache.get(path)===item)cache.delete(path);});
    return item.pending;
  }
  async function part(path, ttl, transform) {
    try {const data=await read(path,ttl);return {available:true,checkedAt:data.checkedAt,rows:data.rows.map(transform)};}
    catch {return {available:false,checkedAt:null,rows:[],message:'Report unavailable. Player availability is unknown.'};}
  }
  return async function get(q) {
    const coverage = await read(`/leagues?id=${q.league}&season=${q.season}`,3600000);
    const season=coverage.rows.find(r=>String(r.league?.id)===q.league)?.seasons?.find(s=>String(s.year)===q.season);
    // Current injury reports must never be presented as historical game-day data.
    if(!season) return {current:false,teams:[],message:'Season coverage could not be verified. Roster and injury status are unknown.'};
    if(!season.current) return {current:false,teams:[],message:'Current roster and injury reports are unavailable for this historical season.'};
    const teams = await Promise.all([q.away,q.home].map(async id=>{
      const unavailable={available:false,checkedAt:null,rows:[],message:'Provider does not confirm coverage. Availability is unknown.'};
      const [roster,injuries]=await Promise.all([
        season.coverage?.players===true ? part(`/players?team=${id}&season=${q.season}`,3600000,p=>({id:String(p.id||''),name:p.name||'Unknown player',position:p.position||'Unknown',group:p.group||'Not supplied',number:p.number??null})) : unavailable,
        season.coverage?.injuries===true ? part(`/injuries?team=${id}`,900000,p=>({id:String(p.player?.id||''),name:p.player?.name||'Unknown player',teamId:String(p.team?.id||''),status:p.status||'Unknown',description:p.description||'Not supplied',date:p.date||null})) : unavailable
      ]);
      // Preserve empty-report uncertainty; discard reports explicitly belonging to another team.
      injuries.rows=injuries.rows.filter(p=>!p.teamId || p.teamId===id);
      return {id,roster,injuries};
    }));
    return {current:true,teams,message:'Current provider reports—not confirmed game-day lineups. Roster lists do not verify trades or starting roles.'};
  };
}
module.exports={createAvailability};
