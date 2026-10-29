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
  function completeCalendar(records,calendar) {
    for(const record of records.values())for(const [gameId,past]of calendar) {
      const opponent=past.teams.get(record.teamId);
      if(opponent&&!record.games.has(gameId))
        record.games.set(gameId,{gameDate:past.date,opponent:opponent.name});
    }
  }
  // Reviewed official correction, never a blanket missing-to-zero conversion.
  // Packers season totals confirm seven appearances; the seven game logs account
  // for all six receptions and all 94 yards. Targets remain unknown.
  const smithReview={league:'1',season:'2026',team:'Green Bay Packers',name:'Jonnu Smith',
    source:'https://www.packers.com/team/players-roster/jonnu-smith/logs/',
    participationSource:'https://www.packers.com/team/players-roster/jonnu-smith/',
    rows:[
      ['2026-09-13','Minnesota Vikings',22,39,2,50],
      ['2026-09-20','New York Jets',20,17,0,0],
      ['2026-09-24','Atlanta Falcons',14,35,2,16],
      ['2026-10-04','Tampa Bay Buccaneers',17,14,1,19],
      ['2026-10-11','Chicago Bears',31,7,0,0],
      ['2026-10-18','Dallas Cowboys',23,13,0,0],
      ['2026-10-25','Detroit Lions',17,20,1,9]
    ]};
  function applyReviewedHistory(records,calendar,scope) {
    const review=smithReview;
    if(String(scope?.league)!==review.league||String(scope?.season)!==review.season)return false;
    const matches=[...records.values()].filter(r=>r.name===review.name&&r.team===review.team);
    if(matches.length!==1)return false;
    const record=matches[0],updates=[];
    for(const [date,opponent,scored,allowed,rec,recYds] of review.rows){
      const games=[...calendar].filter(([,g])=>Number.isFinite(g.date)&&
        new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(g.date*1000))===date&&
        g.teams.get(record.teamId)?.name===opponent&&g.teams.get(record.teamId)?.scored===scored&&g.teams.get(record.teamId)?.allowed===allowed);
      if(games.length!==1)return false;
      const [id]=games[0],line=record.games.get(id);
      if(!line||line.participation==='dnp'||['rec','recYds'].some(k=>line[k]!==undefined&&line[k]!==({rec,recYds})[k]))return false;
      updates.push({line,rec,recYds});
    }
    for(const {line,rec,recYds} of updates)Object.assign(line,{rec,recYds,participation:'played',
      verification:{source:review.source,participationSource:review.participationSource,reviewedAt:'2026-10-29',markets:['rec','recYds']}});
    return true;
  }
  const api={definitions,extract,teamYards,accumulate,completeCalendar,applyReviewedHistory};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.Unit501PlayerStats=api;
})(typeof globalThis!=='undefined'?globalThis:this);
