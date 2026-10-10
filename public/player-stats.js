/* Shared box-score parsing. Team changes never merge separate team histories. */
(function(root){
  'use strict';
  const normalize=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const number=v=>typeof v==='number'&&Number.isFinite(v)?v:typeof v==='string'&&/^-?\d+(?:\.\d+)?$/.test(v.trim())?Number(v):null;
  const definitions=[
    {key:'passYds',title:'Passing yards',group:'passing',keys:['yards']},
    {key:'passTD',title:'Passing TDs',group:'passing',keys:['passing touch downs','passing touchdowns']},
    {key:'carries',title:'Rushing attempts',group:'rushing',keys:['total rushes','rushing attempts','rush attempts','attempts','carries']},
    {key:'rushYds',title:'Rushing yards',group:'rushing',keys:['yards']},
    {key:'rushTD',title:'Rushing TDs',group:'rushing',keys:['rushing touch downs','rushing touchdowns']},
    {key:'recYds',title:'Receiving yards',group:'receiving',keys:['yards']},
    {key:'rec',title:'Receptions',group:'receiving',keys:['receptions','total receptions']},
    {key:'recTD',title:'Receiving TDs',group:'receiving',keys:['receiving touch downs','receiving touchdowns']}
  ];
  function extract(stats,group,keys) {
    if(!Array.isArray(stats))return null;
    const row=stats.find(s=>keys.includes(normalize(s.name)));
    return row?number(row.value):null;
  }
  function teamYards(team,category) {
    const values=(team?.groups||[]).filter(g=>normalize(g.name)===category)
      .flatMap(g=>(g.players||[]).map(p=>extract(p.statistics,category,['yards']))).filter(v=>v!==null);
    return values.length?values.reduce((s,v)=>s+v,0):null;
  }
  function accumulate(map,teamEntry,gameId,gameDate,opponent) {
    const team=teamEntry.team||{};
    for(const group of teamEntry.groups||[]) for(const item of group.players||[]) {
      const person=item.player||{},groupName=normalize(group.name);
      if(!person.id||!person.name)continue;
      const playerId=String(person.id),id=String(team.id)+':'+playerId;
      if(!map.has(id))map.set(id,{id,playerId,name:person.name,team:team.name||'Team',teamId:String(team.id||''),games:new Map()});
      const record=map.get(id);
      if(!record.games.has(gameId))record.games.set(gameId,{gameDate,opponent});
      const line=record.games.get(gameId);
      if(groupName==='passing') {
        const combined=(item.statistics||[]).find(s=>normalize(s.name)==='comp att');
        const match=String(combined?.value||'').match(/^\s*\d+\s*\/\s*(\d+)\s*$/);
        const attempts=extract(item.statistics,groupName,['passing attempts','attempts']);
        if(match)line.attempts=Number(match[1]);else if(attempts!==null)line.attempts=attempts;
      }
      if(groupName==='receiving') {
        const targets=extract(item.statistics,groupName,['targets']);
        if(targets!==null)line.targets=targets;
      }
      for(const def of definitions) if(def.group===groupName) {
        const value=extract(item.statistics,groupName,def.keys);
        if(value!==null)line[def.key]=value;
      }
    }
  }
  const api={definitions,extract,teamYards,accumulate};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.Unit501PlayerStats=api;
})(typeof globalThis!=='undefined'?globalThis:this);
