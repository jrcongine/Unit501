(()=>{
 'use strict';
 const panel=document.createElement('details');panel.className='card hidden player-rating-panel';panel.id='player-ratings-panel';
 document.getElementById('player-lab').before(panel);
 let version=0,timer,ratings=null,game=null,lastEffect='';
 const scenarios=new Map();
 const estimateKey=p=>JSON.stringify({allocations:p.allocations,roles:p.candidates.map(c=>[c.id,c.roleState,c.source])});
 const node=(tag,text)=>{const n=document.createElement(tag);n.textContent=text;return n;};
 const changed=()=>{
  const result=window.Unit501Lineups?.evaluate();
  const effect=JSON.stringify({props:result?.props||{},points:Object.fromEntries(Object.entries(result?.teams||{}).map(([id,t])=>[id,t.points]))});
  if(effect===lastEffect)return;
  lastEffect=effect;invalidateSimulation();document.dispatchEvent(new Event('unit501:lineup-updated'));
 };
 window.Unit501Lineups={snapshot(){
  if(game!==selected||!ratings)return null;
  const reviewed=[...scenarios.values()].filter(s=>s.confirmed);
  const ids=new Set(reviewed.flatMap(s=>[s.playerId,...(s.allocations?s.allocations.map(a=>a.replacementId):[s.replacementId])].map(id=>String(s.teamId)+':'+String(id))));
  return JSON.parse(JSON.stringify({ratings:{...ratings,players:ratings.players.filter(p=>ids.has(String(p.teamId)+':'+String(p.id)))},scenarios:reviewed}));
 },evaluate(){
  if(!ratings||game!==selected||ratings.before!==game.kickoff||String(ratings.league)!==game.league||String(ratings.season)!==String(game.season))return null;
  const rows=[],reasons=[];
  const availability=window.Unit501Availability?.snapshot();
  for(const s of scenarios.values()){
   if(!s.confirmed)continue;
   if(game.kickoff<=Date.now()||game.kickoff>Date.now()+7*86400000){reasons.push('Current lineup scenarios apply only to upcoming games within seven days.');continue;}
   const team=availability?.teams?.find(t=>String(t.id)===s.teamId);
   const roster=team?.roster;
   if(!availability?.current||!roster?.available||!Number.isFinite(roster.checkedAt)||Date.now()-roster.checkedAt>3600000||roster.checkedAt>Date.now()||![s.playerId,...(s.allocations?s.allocations.map(a=>String(a.replacementId)):[s.replacementId])].every(id=>roster.rows.some(p=>String(p.id)===id))){reasons.push('Current team membership needs a fresh roster check for both players.');continue;}
   if(s.allocations&&s.estimateKey){
    const original=ratings.players.find(p=>String(p.teamId)===s.teamId&&String(p.id)===s.playerId);
    const fresh=Unit501LineupModel.recommend(ratings.players,original,availability,game,Unit501InjuryModel.assess);
    if(estimateKey(fresh)!==s.estimateKey){reasons.push('Estimated replacement evidence changed or expired. Review the updated proposal before applying it again.');continue;}
   }
   const replacementIds=s.allocations?s.allocations.map(a=>a.replacementId):[s.replacementId];
   if(replacementIds.some(id=>Unit501InjuryModel.assess(availability,game,s.teamId,id,Date.now(),true).blocked)){reasons.push('Replacement is unavailable or team membership is unconfirmed.');continue;}
   const original=Unit501InjuryModel.assess(availability,game,s.teamId,s.playerId);
   if(original.state==='conflict'){reasons.push('Conflicting reports for the original player: replacement workload scenario withheld until availability is resolved.');continue;}
   if(!original.blocked&&s.workload===100)continue;
   rows.push({...s,workload:original.blocked?0:s.workload});
  }
  const context=typeof scoringContext!=='undefined'&&scoringContext?.game===game?scoringContext.data:null;
  const result=Unit501LineupModel.evaluate(ratings.players,rows,context,game);result.withheld.push(...reasons);return result;
 }};
 function render(){
  const results=document.getElementById('ratings-results');if(!results||!ratings)return;
  const expanded=new Map(Array.from(results.querySelectorAll?.('details[data-rating-key]')||[],el=>[el.dataset.ratingKey,el.open]));
  results.replaceChildren();
  const availability=window.Unit501Availability?.snapshot();
  const review=node('details','');review.id='automatic-replacement-review';
  review.append(node('summary','Automatic missing-starter replacement review'));
  review.append(node('p','Read-only scouting: official or supported availability reports identify the absence. Depth-chart candidates and workload splits are estimates based on recorded usage; nothing is applied to team scores or player props until a scenario is reviewed and confirmed.'));
  let missing=0;
  for(const [teamId,teamName]of [[game.awayId,game.a],[game.homeId,game.h]]){
   for(const p of ratings.players.filter(p=>String(p.teamId)===teamId&&['QB','RB','FB','WR','TE'].includes(p.role))){
    const reported=Unit501InjuryModel.assess(availability,game,teamId,p.id,Date.now(),true);
    if(!['unavailable','nonstarter'].includes(reported.state))continue;
    missing++;
    const proposal=Unit501LineupModel.recommend(ratings.players,p,availability,game,Unit501InjuryModel.assess);
    const candidates=proposal.candidates.map(c=>c.name+
      ' (role '+c.roleState+', workload '+c.workloadState+')').join(', ');
    review.append(node('p',teamName+' · '+p.name+' ('+p.position+') — '+reported.state+
      '. Replacement: '+(candidates||'unknown')+'. '+proposal.reason));
    for(const gap of proposal.workloadGaps||[])review.append(node('p','Incomplete '+gap.category+' profile — '+gap.player+': '+gap.reason));
   }
  }
  if(!missing)review.append(node('p','No confirmed missing QB/RB/FB/WR/TE with a supported roster identity in the current reviewed reports. This is not a guarantee everyone is healthy.'));
  results.append(review);
  for(const [id,name]of [[game.awayId,game.a],[game.homeId,game.h]]){
   const players=ratings.players.filter(p=>String(p.teamId)===id).sort((a,b)=>(b.rating??-1)-(a.rating??-1)||a.name.localeCompare(b.name));
   const team=node('details','');team.className='player-rating-team';team.dataset.ratingKey='team:'+id;team.open=expanded.get('team:'+id)??false;
   team.append(node('summary',`${name} · ${players.filter(p=>p.rating!==null).length} rated / ${players.length} ${players.length===1?'player':'players'}`));
   const table=node('table','');table.className='player-ratings-table';
   const head=node('tr','');for(const text of ['Player / position','Production / trend','Sample','Baseline role and replacement scenario'])head.append(node('th',text));table.append(head);
   for(const p of players){
    const tr=node('tr','');tr.title=p.reason;
    tr.append(node('td',`${p.name} · ${p.position}`),node('td',p.rating===null?'Unrated':`${p.rating}/99 · ${p.trend}`));
    const count=p.coverage.length?Math.min(...p.coverage.map(c=>c.count)):p.games;
    const sample=node('td',p.rating===null?'Unrated · limited data':`${count<5?'Limited':count<9?'Developing':'Larger'} · ${count} recorded games`);
    const sampleNote=[p.rating===null?p.reason:null,p.limitation].filter(Boolean).join(' ');
    if(sampleNote){const note=node('details','');note.className='player-rating-note';note.append(node('summary','Sample note'),node('p',sampleNote));sample.append(note);}
    tr.append(sample);
    const cell=node('td','');
    const review=node('details','');review.className='player-rating-scenario';review.dataset.ratingKey='player:'+id+':'+p.id;review.open=expanded.get(review.dataset.ratingKey)??false;
    review.append(node('summary','Review / adjust'));
    const settings=node('div','');settings.className='player-rating-settings';
    for(const [category,profile] of Object.entries(p.profiles||{})){
     settings.append(node('p',`${category}: ${profile.usage.toFixed(1)} baseline workload, ${profile.efficiency.toFixed(2)} estimated yards per touch, ${profile.games} paired games${profile.dampened?`; ${profile.dampened} high-efficiency game(s) dampened in estimate`:''}. Recorded statistics are unchanged.`));
    }
    const availability=window.Unit501Availability?.snapshot();
    const reported=Unit501InjuryModel.assess(availability,game,id,p.id,Date.now(),true);
    const proposal=['unavailable','nonstarter'].includes(reported.state)?Unit501LineupModel.recommend(ratings.players,p,availability,game,Unit501InjuryModel.assess):null;
    if(proposal){
     settings.append(node('p','Replacement workload: '+proposal.state+'. '+proposal.reason));
     for(const gap of proposal.workloadGaps||[]){
      const category={passing:'Passing attempts',rushing:'Carries',receiving:'Receptions'}[gap.category]||gap.category;
      settings.append(node('p',`${category} withheld — ${gap.player}: ${gap.reason}`));
     }
     for(const candidate of proposal.candidates){
      const usage=Object.entries(candidate.usage).map(([category,u])=>`${category}: ${u.total.toFixed(1)} estimated ${{passing:'pass attempts',rushing:'carries',receiving:'receptions'}[category]} (${u.baseline.toFixed(1)} recent baseline, ${u.extra>=0?'+':''}${u.extra.toFixed(1)} change; ${u.share.toFixed(0)}% share)`).join(' · ');
      settings.append(node('p',`${candidate.name}: role ${candidate.roleState}; workload ${candidate.workloadState}. ${usage || 'Recent workload coverage is insufficient.'}`));
      if(candidate.source){const source=node('a','Replacement source');source.href=candidate.source;source.target='_blank';source.rel='noopener noreferrer';settings.append(source);}
     }
    }
    if(Object.keys(p.profiles||{}).length&&['QB','RB','FB','WR','TE'].includes(p.role)){
     const key=id+':'+p.id;
     const s=scenarios.get(key)||{teamId:id,playerId:String(p.id),replacementId:'',workload:100,replacementShare:100,confirmed:false};scenarios.set(key,s);
     const confirm=node('input','');confirm.type='checkbox';confirm.checked=s.confirmed;confirm.id='baseline-'+key;
     const label=node('label','');label.append(confirm,' I reviewed the baseline role and replacement workload assumptions');label.title='Changing the replacement or workload clears this confirmation. Review the revised scenario before checking it again.';
     const workload=node('select','');workload.setAttribute('aria-label',p.name+' expected workload');workload.id='workload-'+key;
     for(const value of [100,75,50,25,0]){const option=node('option',`${value}% of normal workload`);option.value=String(value);workload.append(option);}workload.value=String(s.workload);
     const replacement=node('select','');replacement.id='replacement-'+key;replacement.setAttribute('aria-label',p.name+' replacement');
     const empty=node('option','Choose same-position replacement');empty.value='';replacement.append(empty);
     for(const r of ratings.players.filter(r=>String(r.teamId)===id&&r.id!==p.id&&r.role===p.role)){const option=node('option',r.name+` (${r.rating===null?'unrated':r.rating+'/99'})`);option.value=String(r.id);replacement.append(option);}replacement.value=s.replacementId;
     const share=node('select','');share.setAttribute('aria-label',p.name+' replacement share');share.id='replacement-share-'+key;
     for(const value of [100,75,50,25,0]){const option=node('option',`${value}% of removed workload to this replacement`);option.value=String(value);share.append(option);}share.value=String(s.replacementShare??100);
     const update=()=>{s.confirmed=confirm.checked;s.workload=Number(workload.value);s.replacementId=replacement.value;s.replacementShare=Number(share.value);changed();showScenario();};
     confirm.onchange=update;
     const revise=()=>{confirm.checked=false;s.confirmed=false;delete s.allocations;update();};
     workload.onchange=revise;replacement.onchange=revise;share.onchange=revise;
     settings.append(label,workload,replacement,share);
     if(s.allocations){
      workload.disabled=true;replacement.disabled=true;share.disabled=true;
      settings.append(node('p','Estimated split selected. Review and check the confirmation box to apply. Workload remains an estimate.'));
      const manual=node('button','Switch to manual replacement');manual.type='button';manual.onclick=()=>{delete s.allocations;s.confirmed=false;changed();render();};settings.append(manual);
     }
     if(proposal?.allocations.length){
      const use=node('button','Use estimated replacement split');use.type='button';use.id='estimate-'+key;
      use.onclick=()=>{
       const fresh=Unit501LineupModel.recommend(ratings.players,p,window.Unit501Availability?.snapshot(),game,Unit501InjuryModel.assess);
       if(!fresh.allocations.length){showScenario();render();return;}
       s.allocations=fresh.allocations;s.estimateKey=estimateKey(fresh);s.replacementId=String(fresh.allocations[0].replacementId);s.workload=0;s.replacementShare=100;s.confirmed=false;changed();render();
      };
      settings.append(use);
     }

    }else settings.append(node('p','Automatic replacement valuation unavailable for this position or workload sample. Use the separate point scenario only with supporting information.'));
    review.append(settings);cell.append(review);
    tr.append(cell);table.append(tr);
   }
   const scroll=node('div','');scroll.style.overflowX='auto';scroll.append(table);team.append(scroll);results.append(team);
  }
  showScenario();
 }
 function showScenario(){
  const status=document.getElementById('lineup-status');if(!status)return;
  const result=window.Unit501Lineups.evaluate();
  status.textContent=result?.applied?result.details.map(r=>`${r.player} → ${r.replacement}: ${r.transferredUsage.toFixed(1)} ${r.category} touches transferred${r.unassignedUsage?`; ${r.unassignedUsage.toFixed(1)} unassigned`:""}, ${r.yardChange>=0?'+':''}${r.yardChange.toFixed(1)} team yards`).join(' · ')+' · '+Object.entries(result.teams).map(([id,t])=>`${id===game.awayId?game.a:game.h}: ${t.points>=0?'+':''}${t.points.toFixed(1)} points`).join(' · '):'No confirmed replacement scenario applied. Normal production is already included in the baseline.';
  if(result?.withheld.length)status.textContent+=' '+[...new Set(result.withheld)].join(' ');
 }
 function reset(){
  clearTimeout(timer);version++;ratings=null;game=selected;scenarios.clear();changed();panel.replaceChildren();panel.open=false;panel.classList.toggle('hidden',!game);if(!game)return;
  panel.append(node('summary','Player ratings & replacement scenarios'));
  const help=node('details','');help.className='player-rating-help';help.append(node('summary','How ratings and replacements work'),node('p','Production grades update with recorded season and recent form, comparing the same position across this league. Every roster player appears; positions without measurable blocking or coverage remain unrated. Grades describe production, not talent. Roster lists reflect the provider’s current team assignment; historical rating views are not archived rosters. Normal performance already affects baseline scores and props. Replacement scenarios change only transferred workload, using recorded efficiency.'));
  const button=node('button','Build league player ratings');button.type='button';button.id='build-player-ratings';
  const status=node('p','Build ratings for both teams. The first league-wide build can take several minutes; cached reports are reused.');status.setAttribute('role','status');
  const results=node('div','');results.id='ratings-results';const scenarioStatus=node('p','');scenarioStatus.id='lineup-status';scenarioStatus.setAttribute('role','status');
  help.append(node('p','For an absence or role change, confirm the baseline role, choose a same-position replacement and set expected workload and the share of removed touches assigned to that replacement. Estimated splits may allocate work across multiple replacements; review their source and assumptions before confirming. Partial transfers withhold the team score adjustment until the rest of the workload is assigned; player scenarios still apply. A fresh unavailable report overrides that workload to zero. Replacement availability is still conditional. Replacement TD increases are not inferred from transferred touches; baseline TDs are scaled down for reduced workload only. Score conversion uses half the team’s recorded points per offensive yard, capped at ±8 points; this assumption has not been historically validated. Manual injury points and individual prop workload percentages are additional—avoid applying the same loss twice.'),node('p','First build checks each league roster and completed player report before kickoff: 32 NFL teams or the verified 138-team college FBS pool. Sample labels reflect recorded data quantity, not prediction confidence.'));
  panel.append(button,status,help,scenarioStatus,results);
  button.onclick=async()=>{
   const task=++version,selection=game;button.disabled=true;ratings=null;changed();results.replaceChildren();
   const q=new URLSearchParams({league:game.league,season:game.season,before:game.kickoff});let polls=0;
   async function poll(){try{
    const r=await fetch('/api/player-ratings?'+q,{signal:AbortSignal.timeout(20000)});const d=await r.json();if(task!==version||selected!==selection)return;
    if(!r.ok||d.error||d.state==='error')throw new Error(d.error||d.message||'Ratings unavailable.');
    if(d.state!=='ready'){status.textContent=d.total?`Building player ratings: ${d.completed}/${d.total} roster and game reports checked.`:d.message||'Finding season history…';if(++polls>=1200)throw new Error('Build still running. Retry to check progress.');timer=setTimeout(poll,3000);return;}
    if(d.data?.league!==game.league||String(d.data.season)!==String(game.season)||d.data.before!==game.kickoff)throw new Error('Ratings do not match this league and kickoff.');
    ratings=d.data;status.textContent='Ratings ready. Expand a team below to inspect players; open Review / adjust only when changing a lineup.';render();changed();button.disabled=false;
   }catch(e){if(task===version){status.textContent=e.message+' Retry after a minute.';button.disabled=false;}}}
   poll();
  };
 }
 document.addEventListener('unit501:selection-changed',reset);
 for(const event of ['unit501:availability-updated','unit501:team-context-updated'])document.addEventListener(event,()=>{render();changed();});
})();
