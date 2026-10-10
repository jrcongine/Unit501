(() => {
  'use strict';
  const panel=document.createElement('section');
  panel.className='card hidden';
  document.getElementById('player-lab').before(panel);
  let version=0, data=null, game=null;
  const node=(tag,text)=>{const n=document.createElement(tag);n.textContent=text;return n;};
  const timestamp=value=>value?new Date(value).toLocaleString('en-US',{timeZone:'America/Chicago',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})+' CT':'unknown';
  function reportAge(date) {
    const time=Date.parse(date);
    if(!Number.isFinite(time)) return 'report date unknown';
    if(Date.now()-time>7*86400000) return 'older report—recheck status';
    return 'report date '+date;
  }
  window.Unit501Availability={
    snapshot(){return game===selected?data:null;},
    assess(teamId,playerId) {
      return Unit501InjuryModel.assess(game === selected ? data : null, selected, teamId, playerId, Date.now(), true);
    },
    describe(teamId,playerId) {
      if(!data || !game || game!==selected) return 'Roster and injury status not checked yet.';
      if(!data.current) return data.message;
      const t=data.teams.find(t=>t.id===String(teamId));
      if(!t) return 'Roster and injury status unknown.';
      const lines=[];
      const roster=t.roster.rows.find(p=>p.id===String(playerId));
      lines.push(!t.roster.available?'Roster unavailable.':roster?`Provider roster: ${roster.position}; ${roster.group}.`:'Not found on the provider team roster—verify current team before using this projection.');
      if (roster && /injured reserve/i.test(roster.group || '')) {
  lines.push(
    'AVAILABILITY WARNING: The roster lists an injured-reserve category. ' +
    'Confirm current game status before using this projection; ' +
    'a missing injury report does not clear this warning.'
  );
}
      const reports=t.injuries.rows.filter(p=>p.id===String(playerId));
      if(!t.injuries.available) lines.push('Injury status unknown: report unavailable.');
      else if(!reports.length) lines.push('No injury entry returned; playing status is not confirmed.');
      else for(const r of reports) lines.push(`Reported ${r.status}: ${r.description} (${reportAge(r.date)}).`);
      lines.push('Injuries checked '+timestamp(t.injuries.checkedAt)+'. ' + this.assess(teamId,playerId).reason);
      return lines.join(' ');
    }
  };
  function render(message,loading=false) {
    panel.replaceChildren(node('h2','Rosters & injury reports'));
    const refresh=node('button','Refresh roster & injuries');refresh.type='button';refresh.disabled=loading;
    refresh.onclick=load;
    panel.append(refresh,node('p',message));
    if(!data?.current) return;
    panel.append(node('p','Source: API-Sports. Fetch times show when we checked the feed, not when a roster changed. Injuries cache for 15 minutes; rosters for one hour.'));
    for(const t of data.teams) {
      panel.append(node('h3',t.id===game.awayId?game.a:game.h));
      const summary=Unit501InjuryModel.teamSummary(data,game,t.id);
      panel.append(node('p',`Availability review: ${summary.unavailable.length} reported unavailable, ${summary.conditional.length} conditional entries, ${summary.unknown.length} unresolved entries. ${summary.reason}`));
      if(summary.unavailable.length) panel.append(node('p','Reported unavailable: '+summary.unavailable.map(p=>p.name).join(', ')+'. Review their roles before entering an injury impact scenario above.'));
      panel.append(node('p','Injuries checked: '+timestamp(t.injuries.checkedAt)));
      if(!t.injuries.available) panel.append(node('p',t.injuries.message));
      else if(!t.injuries.rows.length) panel.append(node('p','No injury entries returned. This does not confirm everyone is healthy or available.'));
      else {
        const list=node('ul','');
        for(const p of t.injuries.rows) list.append(node('li',`${p.name} — ${p.status}: ${p.description} · ${reportAge(p.date)}`));
        panel.append(list);
      }
      const details=node('details','');
      details.append(node('summary',`Provider roster (${t.roster.rows.length} players) · checked ${timestamp(t.roster.checkedAt)}`));
      if(!t.roster.available) details.append(node('p',t.roster.message));
      else if(!t.roster.rows.length) details.append(node('p','No roster returned. Current team membership is unknown.'));
      else {
        const list=node('ul','');
        for(const p of t.roster.rows) list.append(node('li',`${p.name} — ${p.position} · ${p.group}`));
        details.append(list);
      }
      panel.append(details);
    }
  }
  async function load() {
    const task=++version;data=null;game=selected;
    document.dispatchEvent(new Event('unit501:availability-updated'));
    if(!game){panel.classList.add('hidden');return;}
    panel.classList.remove('hidden');
    render('Loading current provider reports…',true);
    const q=new URLSearchParams({league:game.league,season:game.season,away:game.awayId,home:game.homeId});
    try {
      const r=await fetch('/api/availability?'+q);const result=await r.json();
      if(task!==version)return;
      if(!r.ok || result.error)throw new Error('Roster and injury reports could not be loaded. Availability remains unknown.');
      data=result;render(data.message);
    }catch(e){if(task===version)render(e.message);}
    if(task===version)document.dispatchEvent(new Event('unit501:availability-updated'));
  }
  document.addEventListener('unit501:selection-changed',load);
})();
