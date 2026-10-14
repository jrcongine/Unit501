/* Show the same archived-pair comparison used by the offline command. */
(()=>{
 'use strict';
 const panel=document.getElementById('forecast-review-results');
 const labels={passYds:'Passing yards',passTD:'Passing TDs',carries:'Rushing attempts',rushYds:'Rushing yards',rushTD:'Rushing TDs',recYds:'Receiving yards',rec:'Receptions',recTD:'Receiving TDs'};
 const node=(tag,text)=>{const n=document.createElement(tag);n.textContent=text;return n;};
 function render(){
  panel.replaceChildren();
  try{
   const archive=Unit501ForecastArchive.read(localStorage);
   const picks=archive.snapshots.filter(s=>s.selection);
   panel.append(node('h3','Selected picks'),node('p',picks.length?'Selections are separate from all forecast accuracy. Results below compare final statistics with the saved line; sportsbook participation, void and settlement rules still require review.':'No picks marked yet. Use Save selected pick on a player card or after a game simulation.'));
   if(picks.length){const results=picks.map(Unit501ForecastArchive.selectionResult);panel.append(node('p',`${results.filter(r=>r==='Win by statistic').length} wins · ${results.filter(r=>r==='Loss by statistic').length} losses · ${results.filter(r=>r==='Push by statistic').length} pushes · ${results.filter(r=>r==='Pending statistic').length} pending. Statistical results only; no bankroll profit inferred.`));}
   for(const s of picks){
    const p=s.selection,r=s.records[0];
    const name=s.inputs?.playerName||`${s.game.a||s.game.awayId} vs ${s.game.h||s.game.homeId}`;
    const line=p.market==='spread'&&p.direction==='home'?-p.line:p.line;
    panel.append(node('p',`${name} · ${labels[p.market]||p.market} · ${p.direction} ${line} · price ${p.price===null?'unknown':p.price>0?'+'+p.price:p.price} · ${Unit501ForecastArchive.selectionResult(s)} · ${new Date(p.selectedAt).toLocaleString('en-US',{timeZone:'America/Chicago'})} CT · ${r.modelVersion}`));
   }
   panel.append(node('h3','All saved forecasts'));
   const audit=Unit501InjuryBacktest.compare(archive.snapshots.filter(s=>!s.selection).flatMap(s=>s.records||[]));
   panel.append(node('p',`${audit.accepted} matched targets. ${audit.skips.pending} pending final outcomes. Excluded: ${audit.skips.ambiguous} duplicate, ${audit.skips.invalid} invalid, ${audit.skips.late} late and ${audit.skips.version} mixed-model targets.`));
   if(!audit.accepted){panel.append(node('p','No eligible final outcomes to compare yet. Run pregame forecasts, then match them with final results.'));if(!audit.skips.pending)return;}
   const wrap=document.createElement('div');wrap.style.overflowX='auto';
   const table=document.createElement('table');table.style.cssText='width:100%;border-collapse:collapse;text-align:left';
   const head=document.createElement('thead'),header=document.createElement('tr');
   for(const text of ['Forecast','Scored games','Scored targets','Pending targets','Baseline avg miss','Adjusted avg miss','Error change','Baseline bias','Adjusted bias','Evidence']){const th=node('th',text);th.setAttribute('scope','col');header.append(th);}
   head.append(header);table.append(head);const body=document.createElement('tbody');
   const display=v=>v===null?'—':v.toFixed(2);
   const bias=v=>v===null?'—':`${v>0?'+':''}${v.toFixed(2)}`;
   for(const [id,name] of [['1','NFL'],['2','College']]){
    const rows=[['Team points',audit.scores[id]],...Object.entries(audit.props[id]).map(([market,m])=>[labels[market]||market,m])];
    for(const [label,m] of rows){
     if(!m.pairs&&!m.pending)continue;
     const tr=document.createElement('tr');
     const change=m.improvement===null?'—':m.improvement===0?'Unchanged':`${display(Math.abs(m.improvement))} ${m.improvement>0?'lower':'higher'}`;
     const evidence=!m.games?'Awaiting matched final outcomes':m.games<30?`${m.games}/30 games — insufficient`:m.status==='lower-observed-error'?'Lower error in this sample':'No improvement in this sample';
     for(const text of [`${name} · ${label}`,String(m.games),String(m.pairs),String(m.pending),display(m.baselineMAE),display(m.adjustedMAE),change,bias(m.baselineBias),bias(m.adjustedBias),evidence]){const td=node('td',text);td.style.padding='8px 6px';tr.append(td);}
     body.append(tr);
    }
   }
   table.append(body);wrap.append(table);panel.append(wrap,node('p','Pending targets have no matched final statistic yet; this can include upcoming games or missing player statistics after a game ends. They do not count toward scored games or accuracy, and missing stats are never treated as zero. Bias is forecast minus actual: positive means projections ran too high; negative means they ran too low. Near-zero bias can hide large misses in opposite directions, so read it alongside average absolute miss. Both measures use equal weight per game, comparing the same targets with and without scenario adjustments. Leagues and prop markets stay separate. Fewer than 30 games is insufficient evidence; larger samples describe observed errors and do not establish future accuracy or betting profit. Device timestamps and captured reports still require review.'));
  }catch{panel.append(node('p','Saved forecast archive could not be read. Existing data retained.'));}
 }
 document.addEventListener('unit501:archive-updated',render);
 window.addEventListener('storage',e=>{if(e.key===Unit501ForecastArchive.key||e.key===null)render();});
 window.Unit501ForecastReview={render};render();
})();
