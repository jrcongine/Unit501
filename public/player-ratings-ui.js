(()=>{
 'use strict';
 const panel=document.createElement('section');panel.className='card hidden';
 document.getElementById('player-lab').before(panel);
 let version=0,timer,ratings=null,game=null,lastEffect='';
 const scenarios=new Map();
 const node=(tag,text)=>{const n=document.createElement(tag);n.textContent=text;return n;};
 const changed=()=>{
  const result=window.Unit501Lineups?.evaluate();
  const effect=JSON.stringify({props:result?.props||{},points:Object.fromEntries(Object.entries(result?.teams||{}).map(([id,t])=>[id,t.points]))});
  if(effect===lastEffect)return;
  lastEffect=effect;invalidateSimulation();document.dispatchEvent(new Event('unit501:lineup-updated'));
 };
 window.Unit501Lineups={evaluate(){
  if(!ratings||game!==selected||ratings.before!==game.kickoff||String(ratings.league)!==game.league||String(ratings.season)!==String(game.season))return null;
  const rows=[],reasons=[];
  const availability=window.Unit501Availability?.snapshot();
  for(const s of scenarios.values()){
   if(!s.confirmed)continue;
   if(game.kickoff<=Date.now()||game.kickoff>Date.now()+7*86400000){reasons.push('Current lineup scenarios apply only to upcoming games within seven days.');continue;}
   const team=availability?.teams?.find(t=>String(t.id)===s.teamId);
   const roster=team?.roster;
   if(!availability?.current||!roster?.available||!Number.isFinite(roster.checkedAt)||Date.now()-roster.checkedAt>3600000||roster.checkedAt>Date.now()||![s.playerId,s.replacementId].every(id=>roster.rows.some(p=>String(p.id)===id))){reasons.push('Current team membership needs a fresh roster check for both players.');continue;}
   const replacement=Unit501InjuryModel.assess(availability,game,s.teamId,s.replacementId,Date.now(),true);
   if(replacement.blocked){reasons.push('Replacement is unavailable or team membership is unconfirmed.');continue;}
   const original=Unit501InjuryModel.assess(availability,game,s.teamId,s.playerId);
   if(!original.blocked&&s.workload===100)continue;
   rows.push({...s,workload:original.blocked?0:s.workload});
  }
  const context=typeof scoringContext!=='undefined'&&scoringContext?.game===game?scoringContext.data:null;
  const result=Unit501LineupModel.evaluate(ratings.players,rows,context,game);result.withheld.push(...reasons);return result;
 }};
 function render(){
  const results=document.getElementById('ratings-results');if(!results||!ratings)return;
  results.replaceChildren();
  for(const [id,name]of [[game.awayId,game.a],[game.homeId,game.h]]){
   results.append(node('h3',name));const table=node('table','');table.className='player-ratings-table';
   const head=node('tr','');for(const text of ['Player / position','Production / trend','Sample','Baseline role and replacement scenario'])head.append(node('th',text));table.append(head);
   for(const p of ratings.players.filter(p=>String(p.teamId)===id).sort((a,b)=>(b.rating??-1)-(a.rating??-1)||a.name.localeCompare(b.name))){
    const tr=node('tr','');tr.title=p.reason;
    tr.append(node('td',`${p.name} · ${p.position}`),node('td',p.rating===null?'Unrated':`${p.rating}/99 · ${p.trend}`));
    const count=p.coverage.length?Math.min(...p.coverage.map(c=>c.count)):p.games;
    tr.append(node('td',p.rating===null?p.reason:`${count<5?'Limited':count<9?'Developing':'Larger'} · ${count} recorded games`));
    const cell=node('td','');
    if(Object.keys(p.profiles||{}).length&&['QB','RB','FB','WR','TE'].includes(p.role)){
     const key=id+':'+p.id;
     const s=scenarios.get(key)||{teamId:id,playerId:String(p.id),replacementId:'',workload:100,confirmed:false};scenarios.set(key,s);
     const confirm=node('input','');confirm.type='checkbox';confirm.checked=s.confirmed;confirm.id='baseline-'+key;
     const label=node('label','');label.append(confirm,' I verified this player’s baseline role and the replacement’s expected usage');label.title='Changing the replacement or workload clears this confirmation. Review the revised scenario before checking it again.';
     const workload=node('select','');workload.setAttribute('aria-label',p.name+' expected workload');workload.id='workload-'+key;
     for(const value of [100,75,50,25,0]){const option=node('option',`${value}% of normal workload`);option.value=String(value);workload.append(option);}workload.value=String(s.workload);
     const replacement=node('select','');replacement.id='replacement-'+key;replacement.setAttribute('aria-label',p.name+' replacement');
     const empty=node('option','Choose same-position replacement');empty.value='';replacement.append(empty);
     for(const r of ratings.players.filter(r=>String(r.teamId)===id&&r.id!==p.id&&r.role===p.role)){const option=node('option',r.name+` (${r.rating===null?'unrated':r.rating+'/99'})`);option.value=String(r.id);replacement.append(option);}replacement.value=s.replacementId;
     const update=()=>{s.confirmed=confirm.checked;s.workload=Number(workload.value);s.replacementId=replacement.value;changed();showScenario();};
     confirm.onchange=update;
     const revise=()=>{confirm.checked=false;s.confirmed=false;update();};
     workload.onchange=revise;replacement.onchange=revise;
     cell.append(label,workload,replacement);
    }else cell.textContent='Automatic replacement valuation unavailable for this position. Use the separate point scenario only with supporting information.';
    tr.append(cell);table.append(tr);
   }
   const scroll=node('div','');scroll.style.overflowX='auto';scroll.append(table);results.append(scroll);
  }
  showScenario();
 }
 function showScenario(){
  const status=document.getElementById('lineup-status');if(!status)return;
  const result=window.Unit501Lineups.evaluate();
  status.textContent=result?.applied?result.details.map(r=>`${r.player} → ${r.replacement}: ${r.transferredUsage.toFixed(1)} ${r.category} touches transferred, ${r.yardChange>=0?'+':''}${r.yardChange.toFixed(1)} team yards`).join(' · ')+' · '+Object.entries(result.teams).map(([id,t])=>`${id===game.awayId?game.a:game.h}: ${t.points>=0?'+':''}${t.points.toFixed(1)} points`).join(' · '):'No confirmed replacement scenario applied. Normal production is already included in the baseline.';
  if(result?.withheld.length)status.textContent+=' '+[...new Set(result.withheld)].join(' ');
 }
 function reset(){
  clearTimeout(timer);version++;ratings=null;game=selected;scenarios.clear();changed();panel.replaceChildren();panel.classList.toggle('hidden',!game);if(!game)return;
  panel.append(node('h2','Player ratings & replacement scenarios'),node('p','Production grades update with recorded season and recent form, comparing the same position across this league. Every roster player appears; positions without measurable blocking or coverage remain unrated. Grades describe production, not talent. Roster lists reflect the provider’s current team assignment; historical rating views are not archived rosters. Normal performance already affects baseline scores and props. Replacement scenarios change only transferred workload, using recorded efficiency.'));
  const button=node('button','Build league player ratings');button.type='button';button.id='build-player-ratings';
  const status=node('p','First build checks every league roster and completed player report before kickoff. NFL has 32 teams; college uses the verified 138-team FBS pool. This can take several minutes; cached reports are reused.');status.setAttribute('role','status');
  const results=node('div','');results.id='ratings-results';const scenarioStatus=node('p','');scenarioStatus.id='lineup-status';scenarioStatus.setAttribute('role','status');
  panel.append(button,status,node('p','For an absence or role change, confirm the baseline role, choose a same-position replacement and set expected workload. A fresh unavailable report overrides that workload to zero. Replacement availability is still conditional. Replacement TD increases are not inferred from transferred touches; baseline TDs are scaled down for reduced workload only. Score conversion uses half the team’s recorded points per offensive yard, capped at ±8 points; this assumption has not been historically validated. Manual injury points and individual prop workload percentages are additional—avoid applying the same loss twice.'),scenarioStatus,results);
  button.onclick=async()=>{
   const task=++version,selection=game;button.disabled=true;ratings=null;changed();results.replaceChildren();
   const q=new URLSearchParams({league:game.league,season:game.season,before:game.kickoff});let polls=0;
   async function poll(){try{
    const r=await fetch('/api/player-ratings?'+q,{signal:AbortSignal.timeout(20000)});const d=await r.json();if(task!==version||selected!==selection)return;
    if(!r.ok||d.error||d.state==='error')throw new Error(d.error||d.message||'Ratings unavailable.');
    if(d.state!=='ready'){status.textContent=d.total?`Building player ratings: ${d.completed}/${d.total} roster and game reports checked.`:d.message||'Finding season history…';if(++polls>=1200)throw new Error('Build still running. Retry to check progress.');timer=setTimeout(poll,3000);return;}
    if(d.data?.league!==game.league||String(d.data.season)!==String(game.season)||d.data.before!==game.kickoff)throw new Error('Ratings do not match this league and kickoff.');
    ratings=d.data;status.textContent='Build complete. Sample labels describe recorded data quantity, not prediction confidence. Missing metrics are omitted. Confirm baseline roles before applying replacements.';render();changed();button.disabled=false;
   }catch(e){if(task===version){status.textContent=e.message+' Retry after a minute.';button.disabled=false;}}}
   poll();
  };
 }
 document.addEventListener('unit501:selection-changed',reset);
 for(const event of ['unit501:availability-updated','unit501:team-context-updated'])document.addEventListener(event,()=>{showScenario();changed();});
})();
