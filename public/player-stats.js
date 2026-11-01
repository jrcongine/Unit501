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
      if(opponent?.id)record.games.get(gameId).opponentId=opponent.id;
    }
  }
  // Roster IDs stay in the provider namespace. Never attach ESPN IDs to provider rosters.
  function seedRoster(records,calendar,snapshot,teams,now=Date.now()) {
    if(snapshot?.current!==true||!Array.isArray(snapshot.teams))return 0;
    let added=0;
    for(const team of teams){
      const entries=snapshot.teams.filter(t=>String(t.id)===String(team.id));
      if(entries.length!==1)continue;const roster=entries[0].roster;
      if(roster?.available!==true||!Number.isFinite(roster.checkedAt)||roster.checkedAt>now||now-roster.checkedAt>3600000||!Array.isArray(roster.rows))continue;
      for(const player of roster.rows){
        const playerId=String(player.id||''),name=String(player.name||'').trim();
        if(!/^\d{1,12}$/.test(playerId)||!name||name==='Unknown player'||!['QB','RB','FB','WR','TE'].includes(player.position)||
           roster.rows.filter(p=>String(p.id)===playerId||normalize(p.name)===normalize(name)).length!==1||
           snapshot.rosterOwnership?.conflicts?.some(p=>String(p.id)===playerId))continue;
        const id=String(team.id)+':'+playerId,old=records.get(id);
        if(old){if(normalize(old.name)===normalize(name))old.position=player.position;continue;}
        records.set(id,{id,playerId,teamId:String(team.id),team:team.name,name,position:player.position,games:new Map()});added++;
      }
    }
    completeCalendar(records,calendar);return added;
  }
  function missingGames(records) {
    const games=new Set();
    for(const record of records.values()){
      const history=[...record.games.values()];
      const groups=[
        {roles:['QB'],usage:['attempts','passYds','passTD'],keys:['attempts','passYds','passTD']},
        {roles:['QB','RB','FB'],usage:['carries','rushYds','rushTD'],keys:['carries','rushYds','rushTD']},
        {roles:['RB','FB','WR','TE'],usage:['targets','rec','recYds','recTD'],keys:['rec','recYds','recTD']}
      ].filter(g=>g.roles.includes(record.position)&&history.some(line=>['attempts','carries','targets','rec','passYds','rushYds','recYds'].some(k=>Number.isFinite(line[k])&&line[k]!==0))||history.some(line=>g.usage.some(k=>Number.isFinite(line[k])&&line[k]!==0)));
      for(const [id,line]of record.games){
        if(line.participation==='conflict'||line.participation==='dnp'&&line.verification?.participation)continue;
        if(groups.some(g=>g.keys.some(k=>!Number.isFinite(line[k]))))games.add(String(id));
      }
    }
    return games;
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
  // Match exact team/game identities and unique initial+surname abbreviations.
  // Collisions remain unresolved; no fuzzy matching or current-roster assumptions.
  function applyParticipation(records,calendar,report,scope) {
    if(!report?.available||String(report.league)!==String(scope?.league)||String(report.season)!==String(scope?.season)||!(/^https:\/\/static\.(?:clubs\.nfl\.com\/|www\.nfl\.com\/image\/upload\/)/.test(report.source||'')||/^https:\/\/www\.ncaa\.com\/game\/\d+$/.test(report.source||'')||/^https:\/\/site\.api\.espn\.com\/apis\/site\/v2\/sports\/football\/(nfl|college-football)\/summary\?event=\d+$/.test(report.source||''))||!Array.isArray(report.teams)||report.teams.length!==2)return 0;
    const past=calendar.get(String(report.gameId));if(!past||past.date!==report.gameDate)return 0;
    const short=name=>{const parts=String(name||'').trim().split(/\s+/);return parts.length>1?normalize(parts[0][0]+parts.slice(1).join('')).replace(/ /g,''):'';};
    const abbreviation=name=>normalize(name).replace(/ /g,'');
    const keys=[...definitions.map(d=>d.key),'attempts','targets'];let updated=0;
    for(const team of report.teams){
      const opponent=past.teams.get(String(team.id)),other=report.teams.filter(t=>String(t.id)!==String(team.id));
      if(!opponent||other.length!==1||other[0].name!==opponent.name||team.scored!==opponent.scored||team.allowed!==opponent.allowed||!Array.isArray(team.players))continue;
      const candidates=[...records.values()].filter(r=>r.teamId===String(team.id)&&r.team===team.name);
      for(const record of candidates){
        const matchName=report.nameFormat==='full'?normalize:short;
        const name=matchName(record.name);if(!name||candidates.filter(r=>matchName(r.name)===name).length!==1)continue;
        const matches=team.players.filter(p=>(report.nameFormat==='full'?normalize(p.name):abbreviation(p.name))===name);if(matches.length!==1)continue;
        const row=matches[0],line=record.games.get(String(report.gameId));if(!line||!['played','dnp'].includes(row.participation))continue;
        const verifiedKeys=report.nameFormat==='full'?keys.filter(k=>row.markets?.includes(k)):keys;
        if(row.participation==='played'&&verifiedKeys.some(k=>!Number.isFinite(row[k])||(!k.endsWith('Yds')&&row[k]<0)))continue;
        const conflict=line.participation==='conflict'||(row.participation==='dnp'
          ? line.participation==='played'||keys.some(k=>Number.isFinite(line[k])&&line[k]!==0)
          : line.participation==='dnp'||verifiedKeys.some(k=>line[k]!==undefined&&line[k]!==row[k]));
        if(conflict){for(const k of keys)delete line[k];line.participation='conflict';line.verification={source:report.source,participation:false,reason:'Verified source conflicts with the recorded history.'};continue;}
        for(const k of keys){if(row.participation==='dnp')delete line[k];else if(verifiedKeys.includes(k))line[k]=row[k];}
        line.participation=row.participation;line.verification={source:report.source,participation:true,markets:row.participation==='played'?verifiedKeys:[],checkedAt:report.checkedAt};updated++;
      }
    }
    return updated;
  }
  // Reviewed provider spellings from the 2026 college roster/odds comparison.
  // These aliases do not authorize generic nickname expansion or suffix removal.
  function quotePlayers(quote,players,scope={}) {
    const key=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
    const name=key(quote?.name);
    if(!name)return [];
    const aliases=String(scope.league)==='2'&&String(scope.season)==='2026'?[
      {teams:['baylor','baylorbears'],names:['louisbrown','louisbrowniv']},
      {teams:['ucf','ucfknights'],names:['joshderry','joshuaderry']}
    ]:[];
    return players.filter(p=>key(p.name)===name||aliases.some(a=>a.teams.includes(key(p.team))&&a.names.includes(name)&&a.names.includes(key(p.name))));
  }
  const api={definitions,extract,teamYards,accumulate,completeCalendar,seedRoster,missingGames,applyReviewedHistory,applyParticipation,quotePlayers};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.Unit501PlayerStats=api;
})(typeof globalThis!=='undefined'?globalThis:this);
