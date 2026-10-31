(() => {
  'use strict';
  const panel=document.createElement('section');
  panel.className='card hidden';
  document.getElementById('player-lab').before(panel);
  const reportDownload=document.createElement('div');
  let concernLabels=[];
  let version=0, data=null, game=null, timer, loading=false, lastAttempt=0;
  const node=(tag,text)=>{const n=document.createElement(tag);n.textContent=text;return n;};
  const timestamp=value=>value?new Date(value).toLocaleString('en-US',{timeZone:'America/Chicago',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})+' CT':'unknown';
  function reportAge(date) {
    const time=Date.parse(date);
    if(!Number.isFinite(time)) return 'report date unknown';
    if(Date.now()-time>7*86400000) return 'older report—recheck status';
    return 'report date '+date;
  }
  window.Unit501Availability={
    scoring(result,applied=false){
      for(const entry of concernLabels){
        const matches=(result?.applied||[]).filter(p=>String(p.teamId)===String(entry.teamId)&&
          (entry.id?String(p.playerId)===String(entry.id):p.name===entry.name));
        const label=matches.length===1?(applied?'OUT — factored in':'OUT — ready for next simulation'):
          entry.out?'OUT — impact unresolved':entry.status;
        entry.node.textContent=entry.name+' — '+label;
      }
    },
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
      const ownership=data.rosterOwnership;
      if(ownership?.available&&String(ownership.league)===String(game.league)&&String(ownership.season)===String(game.season)&&Number.isFinite(ownership.checkedAt)&&ownership.checkedAt<=Date.now()&&Date.now()-ownership.checkedAt<=3600000){
        lines.push(`NFL roster ownership: ${ownership.checkedTeams}/${ownership.expectedTeams} teams checked. ${ownership.message}`);
        const conflict=ownership.conflicts?.find(p=>String(p.id)===String(playerId)&&p.teamIds?.map(String).includes(String(teamId)));
        if(conflict)lines.push('Conflicting current team listings: projection withheld until ownership is resolved.');
      }else if(game.league==='1')lines.push('League-wide roster ownership could not be checked; current team assignment remains conditional.');
      const roster=t.roster.rows.find(p=>p.id===String(playerId));
      lines.push(!t.roster.available?'Roster unavailable.':roster?`Provider roster: ${roster.position}; ${roster.group}.`:'Not found on the provider team roster—verify current team before using this projection.');
      if (roster && /injured reserve/i.test(roster.group || '')) {
  lines.push(
    'AVAILABILITY WARNING: The roster lists an injured-reserve category. ' +
    'Confirm current game status before using this projection; ' +
    'a missing injury report does not clear this warning.'
  );
}
      if(t.official?.available) {
        const reports=t.official.rows.filter(p=>p.id===String(playerId));
        for(const r of reports)lines.push(`${t.official.publisher || `Official NFL Week ${t.official.week}`} : ${r.status || 'no game status'}; ${r.description}${r.practice?'; '+r.practice:''}.`);
      }
      if(t.starters?.rows?.length){
        for(const r of t.starters.rows)if(r.id===String(playerId))lines.push(`${r.publisher} announced starting ${r.position}: ${r.name}. Announcement can change; workload is not confirmed.`);
      }
      if(t.depth?.available) {
        const roles=t.depth.rows.filter(p=>p.id===String(playerId));
        for(const r of roles)lines.push(`Team depth chart: ${r.position}, listed depth ${r.rank}. Game starter and workload remain unconfirmed.`);
      }
      const reports=t.injuries.rows.filter(p=>p.id===String(playerId));
      if(!t.injuries.available && !t.official?.available) lines.push('Injury status unknown: report unavailable.');
      else if(!reports.length && !t.official?.available) lines.push('No injury entry returned; playing status is not confirmed.');
      else for(const r of reports) lines.push(`Reported ${r.status}: ${r.description} (${reportAge(r.date)}).`);
      lines.push('Injuries checked '+timestamp(t.injuries.checkedAt)+'. ' + this.assess(teamId,playerId).reason);
      return lines.join(' ');
    }
  };
  function render(message,loading=false) {
    concernLabels=[];
    reportDownload.replaceChildren();
    panel.replaceChildren(node('h2','Injury watch'));
    const refresh=node('button','Refresh injuries');refresh.id='refresh-availability';refresh.type='button';refresh.disabled=loading;
    refresh.onclick=load;
    panel.append(refresh,node('p',message));
    if(!data?.current) return;
    const download=node('button','Download injury report');download.type='button';download.id='download-injury-report';download.disabled=loading||game!==selected;
    download.onclick=()=>{
      if(!data||loading||game!==selected)return;
      const blob=new Blob([JSON.stringify({exportedAt:new Date().toISOString(),game,availability:data},null,2)],{type:'application/json'});
      const url=URL.createObjectURL(blob),link=node('a','');link.href=url;link.download='unit501-injuries-'+game.id+'.json';
      document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    };
    reportDownload.append(download);

    panel.append(node('p','Source: API-Sports. Fetch times show when we checked the feed, not when a roster changed. Injuries cache for 15 minutes; rosters for one hour. Expired reports refresh automatically while this tab is visible for an upcoming matchup within seven days.'));
    for(const t of data.teams) {
      panel.append(node('h3',t.id===game.awayId?game.a:game.h));
      const summary=Unit501InjuryModel.teamSummary(data,game,t.id);
      panel.append(node('p',`Availability review: ${summary.available?.length || 0} listed available, ${summary.unavailable.length} reported unavailable, ${summary.conditional.length} conditional entries, ${summary.unknown.length} unresolved entries, ${summary.conflicts?.length || 0} conflicting entries, ${summary.nonstarters?.length || 0} QBs withheld for a different announced starter. ${summary.reason}`));
      if(summary.nonstarters?.length)panel.append(node('p','Another QB was announced as starter — normal full-game props withheld: '+summary.nonstarters.map(p=>p.name).join(', ')+'. This does not establish injury or inactive status.'));
      if(summary.conflicts?.length)panel.append(node('p','Conflicting reports — projections withheld: '+summary.conflicts.map(p=>p.name).join(', ')+'.'));
      if(summary.unavailable.length) panel.append(node('p','Reported unavailable: '+summary.unavailable.map(p=>p.name).join(', ')+'. Review their roles before entering an injury impact scenario above.'));
      if(t.starters){
        panel.append(node('p',t.starters.message));
        if(t.starters.unverified)panel.append(node('p',`${t.starters.unverified} reviewed announcement(s) could not be reverified or uniquely matched to the roster; starter confirmation withheld.`));
        for(const r of t.starters.rows){const link=node('a',`${r.publisher} announced starting ${r.position}: ${r.name} (${r.publishedAt.slice(0,10)})`);link.href=r.url;link.target='_blank';link.rel='noopener';panel.append(node('p',r.evidence),link);}
      }
      if(t.starterCandidates){
        panel.append(node('p',t.starterCandidates.message));
        if(t.starterCandidates.failed)panel.append(node('p',`${t.starterCandidates.failed} candidate article(s) could not be checked; discovery is partial.`));
        if(t.starterCandidates.rows.length){const details=node('details','');details.append(node('summary','Possible starter announcements — unreviewed'));for(const r of t.starterCandidates.rows){const link=node('a',`${r.title} (${r.publishedAt.slice(0,10)})`);link.href=r.url;link.target='_blank';link.rel='noopener';details.append(node('p','Roster QBs mentioned: '+r.players.map(p=>p.name).join(', ')),link);}panel.append(details);}
      }
      if(t.depth) {
        panel.append(node('p',t.depth.message));
        if(t.depth.url){const link=node('a','Review team depth chart');link.href=t.depth.url;link.target='_blank';link.rel='noopener';panel.append(link);}
        if(t.depth.available){
          panel.append(node('p',`Depth chart checked ${timestamp(t.depth.checkedAt)}; ${t.depth.unmatched} entries could not be matched to a unique roster player.`));
          if(t.depth.coverage)panel.append(node('p','Offensive depth coverage: '+t.depth.coverage.map(r=>`${r.position}: ${r.matched} matched, ${r.unresolved} unresolved`).join(' • ')+'. Unresolved players in a replacement slot withhold its estimated workload split.'));
          const details=node('details','');details.append(node('summary','Listed depth order — starters unconfirmed'));
          const list=node('ul','');for(const r of t.depth.rows)list.append(node('li',`${r.position}: ${r.name} — depth ${r.rank}`));details.append(list);panel.append(details);
        }
      }
      if(t.inactives) {
        panel.append(node('p',t.inactives.available ? `Final game-day inactives: checked ${timestamp(t.inactives.checkedAt)}. ${t.inactives.rows.length} matched; ${t.inactives.unmatched.length} names unresolved. ${t.inactives.message}` : t.inactives.message));
        if(t.inactives.available){const link=node('a','Review official final inactive lists');link.href=t.inactives.url;link.target='_blank';link.rel='noopener';panel.append(link);}
      }
      if(t.official) {
        panel.append(node('p',t.official.available ? `${t.official.publisher || `Official NFL Week ${t.official.week}`}  cross-check: checked ${timestamp(t.official.checkedAt)}${t.official.publishedAt?'; published '+timestamp(t.official.publishedAt):''}. ${t.official.unmatched} entries could not be matched to a unique roster player. Starting roles remain unverified.` : t.official.message));
        if(t.official.available) {
          if(t.official.unresolved?.length) {
            const warning=node('div','');
            warning.append(node('p','Unmatched official reports — review before using player projections. These names are not linked to a verified roster identity:'));
            const list=node('ul','');
            for(const r of t.official.unresolved) list.append(node('li',`${r.name || 'Unnamed player'}${r.position?' ('+r.position+')':''} — ${r.status || 'no game status'}${r.description?'; '+r.description:''}${r.practice?'; '+r.practice:''}`));
            warning.append(list);panel.append(warning);
          }
          const link=node('a','Review official availability report');link.href=t.official.url;link.target='_blank';link.rel='noopener';panel.append(link);
        }
      }
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
    // Keep the complete source reports accessible without filling the main screen.
    const full=node('details','');
    full.append(node('summary','Full roster & report details'));
    full.append(reportDownload);
    while(panel.children.length>2)full.append(panel.children[2]);
    const teamGrid=node('div','');teamGrid.className='injury-team-grid';
    for(const t of data.teams){
      const teamCard=node('section','');teamCard.className='injury-team-summary';
      const summary=Unit501InjuryModel.teamSummary(data,game,t.id);
      const concerns=new Map();
      const add=(name,status,id=null,out=false)=>{
        const key=String(name||'').toLowerCase().replace(/[^a-z0-9]/g,'');
        if(key&&!concerns.has(key))concerns.set(key,{name,status,id,out});
      };
      for(const p of [...summary.unavailable,...summary.conditional,...(summary.conflicts||[]),...(summary.nonstarters||[])]){
        const assessment=Unit501InjuryModel.assess(data,game,t.id,p.id);
        const official=t.official;
        const fresh=official?.available&&String(official.gameId)===String(game.id)&&official.kickoff===game.kickoff&&
          Number.isFinite(official.checkedAt)&&official.checkedAt<=Date.now()&&Date.now()-official.checkedAt<=900000;
        const reports=fresh?(official.rows||[]).filter(r=>String(r.id)===String(p.id)):[];
        const out=reports.length>0&&reports.every(r=>String(r.status).toLowerCase()==='out')&&assessment.state!=='conflict';
        add(p.name,Unit501InjuryModel.statusLabel(assessment),p.id,out);
      }
      const official=t.official;
      const fresh=official?.available && String(official.gameId)===String(game.id) && official.kickoff===game.kickoff &&
        Number.isFinite(official.checkedAt) && official.checkedAt<=Date.now() && Date.now()-official.checkedAt<=900000;
      if(fresh)for(const p of official.unresolved||[]){
        if(/^(out\b|inactive\b|questionable\b|doubtful\b|probable\b|game time decision\b|suspended\b)/i.test(p.status||''))add(p.name,p.status+' · roster match pending',null,String(p.status).toLowerCase()==='out');
      }
      teamCard.append(node('h3',t.id===game.awayId?game.a:game.h));
      const rows=[...concerns.values()];
      if(rows.length){
        const list=node('ul','');for(const p of rows){const item=node('li',p.name+' — '+(p.out?'OUT — impact unresolved':p.status));if(p.out)item.classList.add('injury-confirmed-out');list.append(item);concernLabels.push({...p,teamId:t.id,node:item});}teamCard.append(list);
      }else teamCard.append(node('p',fresh?'No injury concerns listed.':'No current injury report confirmed.'));
      const notes=t.unofficialNotes;
      if(notes&&String(notes.gameId)===String(game.id)&&notes.kickoff===game.kickoff&&Number.isFinite(notes.checkedAt)&&notes.checkedAt<=Date.now()&&Date.now()-notes.checkedAt<=900000&&Array.isArray(notes.rows)&&notes.rows.length){
        teamCard.append(node('p','Unofficial injury notes · verify before betting'));
        const list=node('ul','');
        for(const p of notes.rows)list.append(node('li',`${p.name} (${p.position}) — ${String(p.status).toUpperCase()} · reported ${p.date}`));
        teamCard.append(list);
        const link=node('a','View source and updates');link.href=notes.url;link.target='_blank';link.rel='noopener';teamCard.append(link);
      }
      teamGrid.append(teamCard);
    }
    panel.append(teamGrid,full);
  }
  async function load(background=false) {
    if(background===true && loading)return;
    const task=++version;const same=game===selected;game=selected;loading=true;lastAttempt=Date.now();
    if(!same){data=null;document.dispatchEvent(new Event('unit501:availability-updated'));}
    if(!game){loading=false;panel.classList.add('hidden');return;}
    panel.classList.remove('hidden');
    render('Loading current provider reports…',true);
    const q=new URLSearchParams({league:game.league,season:game.season,away:game.awayId,home:game.homeId,game:game.id});
    try {
      const r=await fetch('/api/availability?'+q,{signal:AbortSignal.timeout(120000)});const result=await r.json();
      if(task!==version)return;
      if(!r.ok || result.error)throw new Error('Roster and injury reports could not be loaded. Availability remains unknown.');
      data=result;render(data.message);
    }catch(e){if(task===version){data=null;render(e.message);}}
    if(task===version){loading=false;document.dispatchEvent(new Event('unit501:availability-updated'));}
  }
  function watch(){
    clearTimeout(timer);
    timer=setTimeout(async()=>{
      if(game===selected&&game&&!document.hidden){
        // Re-evaluate freshness even if a request is unavailable or kickoff passed.
        document.dispatchEvent(new Event('unit501:availability-updated'));
        if(Date.now()-lastAttempt>=300000&&Unit501InjuryModel.refreshDue(data,game))await load(true);
      }
      if(game===selected&&game)watch();
    },60000);
  }
  document.addEventListener('unit501:selection-changed',()=>{clearTimeout(timer);load().then(()=>{if(game)watch();});});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&game===selected&&game){clearTimeout(timer);watch();if(Date.now()-lastAttempt>=300000&&Unit501InjuryModel.refreshDue(data,game))load(true);}});
})();
