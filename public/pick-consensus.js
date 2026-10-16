/* Conservative agreement matching: uncertain dates/markets stay ungrouped. */
(function(root){
  'use strict';
  const clean=s=>String(s||'').toLowerCase().replace(/[−–]/g,'-').replace(/\s+/g,' ').trim();
  function dateOf(p,checkedAt){
    if(p.eventAt && Number.isFinite(Date.parse(p.eventAt)))return new Date(p.eventAt).toLocaleDateString('en-CA',{timeZone:'America/New_York'});
    const m=String(p.eventLabel||'').match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2})\b/i);
    const checked=new Date(checkedAt);if(!m || !Number.isFinite(+checked))return null;
    const candidates=[-1,0,1].map(y=>new Date(`${m[1]} ${m[2]}, ${checked.getUTCFullYear()+y} 12:00:00 GMT`)).sort((a,b)=>Math.abs(a-checked)-Math.abs(b-checked));
    return Number.isFinite(+candidates[0])?candidates[0].toISOString().slice(0,10):null;
  }
  function identify(p,checkedAt){
    if(p.requiresReview)return null;
    const date=dateOf(p,checkedAt);if(!date)return null;
    const teams=clean(p.matchup).replace(/:\s*(total|spread|moneyline).*$/,'').split(/\s+(?:vs\.?|at|@)\s+/);
    if(teams.length!==2 || teams.some(t=>!t))return null;
    const game=[p.league,date,...teams.sort()].join('|');
    const pick=clean(p.pick).replace(/\s*\([+-]\d+(?:\.\d+)?\)\s*$/,'').trim();
    let m=pick.match(/^(?:total\s+)?(over|under|o|u)\s*(\d+(?:\.\d+)?)$/);
    if(m)return {game,market:'total',side:/^(over|o)$/.test(m[1])?'Over':'Under',line:m[2],date};
    m=pick.match(/^(.+?)\s+([+-]\d+(?:\.\d+)?)$/);
    if(m && teams.includes(m[1]))return {game,market:'spread',side:m[1],line:m[2],date};
    m=pick.match(/^(.+?)\s+(?:ml|moneyline)$/);
    if(m && teams.includes(m[1]))return {game,market:'moneyline',side:m[1],line:'ML',date};
    return null;
  }
  function build(sources){
    const groups=new Map();let unmatched=0;
    for(const source of sources||[])for(const p of source.picks||[]){
      const id=identify(p,source.checkedAt);if(!id || !clean(p.author)){unmatched++;continue;}
      const key=[id.game,id.market,id.side].join('|');
      if(!groups.has(key))groups.set(key,{...id,matchup:p.matchup,entries:[],authors:new Set(),sources:new Set(),lines:new Set()});
      const g=groups.get(key),author=clean(p.author);
      // Preserve distinct published lines and provenance, count each person once.
      if(!g.entries.some(e=>clean(e.author)===author && e.source===source.name && e.pick===p.pick))g.entries.push({...p,source:source.name});
      g.authors.add(author);g.sources.add(source.name);g.lines.add(id.line);
    }
    const rows=[...groups.values()];
    for(const g of rows){
      g.agreement=g.authors.size;g.sourceCount=g.sources.size;
      g.opposition=new Set(rows.filter(o=>o.game===g.game && o.market===g.market && o.side!==g.side).flatMap(o=>[...o.authors])).size;
      g.lines=[...g.lines];g.sources=[...g.sources];
    }
    for(const g of rows)delete g.authors;
    rows.sort((a,b)=>b.sourceCount-a.sourceCount||b.agreement-a.agreement||a.game.localeCompare(b.game)||a.side.localeCompare(b.side));
    return {groups:rows,unmatched};
  }
  const api={build,identify};if(root)root.Unit501PickConsensus=api;
  if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?null:window);
