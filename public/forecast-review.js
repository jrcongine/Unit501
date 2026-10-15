/* Show the same archived-pair comparison used by the offline command. */
(()=>{
 'use strict';
 const panel=document.getElementById('forecast-review-results');
 const filters={league:'',season:'',modelVersion:'',from:'',to:''};
 let patternsOpen=false;
 let reliabilityOpen=false;
 const labels={passYds:'Passing yards',passTD:'Passing TDs',carries:'Rushing attempts',rushYds:'Rushing yards',rushTD:'Rushing TDs',recYds:'Receiving yards',rec:'Receptions',recTD:'Receiving TDs'};
 const node=(tag,text)=>{const n=document.createElement(tag);n.textContent=text;return n;};
 function render(){
  panel.replaceChildren();
  try{
   const archive=Unit501ForecastArchive.read(localStorage);
   panel.append(node('h3','Accuracy dashboard'));
   const controls=node('div','');
   const records=archive.snapshots.flatMap(s=>s.records||[]);
   for(const [key,title] of [['league','League'],['season','Season'],['modelVersion','Model version']]){
    const label=node('label',title+' '),select=node('select','');
    const values=[...new Set(records.map(r=>String(r[key]??'')).filter(Boolean))].sort();
    if(!values.includes(filters[key]))filters[key]='';
    for(const value of ['',...values]){
     const option=node('option',value?(key==='league'?({'1':'NFL','2':'College'}[value]||value):value):'All');option.value=value;select.append(option);
    }
    select.value=filters[key];select.addEventListener('change',()=>{filters[key]=select.value;render();});
    label.append(select);controls.append(label);
   }
   for(const [key,title] of [['from','Games from'],['to','Games through']]){
    const label=node('label',title+' '),input=node('input','');input.type='date';input.value=filters[key];
    input.addEventListener('change',()=>{filters[key]=input.value;render();});label.append(input);controls.append(label);
   }
   const reset=node('button','Reset filters');reset.type='button';reset.addEventListener('click',()=>{for(const key of Object.keys(filters))filters[key]='';render();});controls.append(reset);
   if(filters.from&&filters.to&&filters.from>filters.to)panel.append(node('p','Start date is after end date. Change the dates to see results.'));
   panel.append(controls,node('p','Filter saved forecasts and selected picks by league, season, model version or game date (Central Time). All-model results exclude markets with mixed versions; select a version to review those forecasts separately.'));
   const scoped=Unit501ForecastDashboard.filter(archive.snapshots,filters);
   panel.append(node('p',`${scoped.length} of ${archive.snapshots.length} saved snapshots in this view. History starts when forecasts were saved on this browser; earlier season predictions are not reconstructed.`));
   const picks=scoped.filter(s=>s.selection);
   panel.append(node('h3','Selected picks'),node('p',picks.length?'Selections are separate from all forecast accuracy. Results below compare final statistics with the saved line; sportsbook participation, void and settlement rules still require review.':'No picks marked yet. Use Save selected pick on a player card or after a game simulation.'));
   if(picks.length){const results=picks.map(Unit501ForecastArchive.selectionResult);panel.append(node('p',`${results.filter(r=>r==='Win by statistic').length} wins · ${results.filter(r=>r==='Loss by statistic').length} losses · ${results.filter(r=>r==='Push by statistic').length} pushes · ${results.filter(r=>r==='Pending statistic').length} pending. Statistical results only; no bankroll profit inferred.`));}
   for(const s of picks){
    const p=s.selection,r=s.records[0];
    const name=s.inputs?.playerName||`${s.game.a||s.game.awayId} vs ${s.game.h||s.game.homeId}`;
    const line=p.market==='spread'&&p.direction==='home'?-p.line:p.line;
    panel.append(node('p',`${name} · ${labels[p.market]||p.market} · ${p.direction} ${line} · price ${p.price===null?'unknown':p.price>0?'+'+p.price:p.price} · ${Unit501ForecastArchive.selectionResult(s)} · ${new Date(p.selectedAt).toLocaleString('en-US',{timeZone:'America/Chicago'})} CT · ${r.modelVersion}`));
   }
   panel.append(node('h3','All saved forecasts'));
   const audit=Unit501InjuryBacktest.compare(scoped.filter(s=>!s.selection).flatMap(s=>s.records||[]));
   panel.append(node('p',`${audit.accepted} matched targets. ${audit.skips.pending} pending final outcomes. Excluded: ${audit.skips.ambiguous} duplicate, ${audit.skips.invalid} invalid, ${audit.skips.late} late and ${audit.skips.version} mixed-model targets.`));
   for(const check of audit.scoringAudits||[])panel.append(Unit501ScoreAuditUI.render(check,`${check.league==='1'?'NFL':'College'} ${check.season} · saved scoring audit`));
   const download=node('button','Download filtered accuracy report');download.type='button';
   download.addEventListener('click',()=>{
    const report=Unit501ForecastDashboard.report(scoped,filters,audit);
    const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));
    const link=node('a','');link.href=url;link.download='unit501-accuracy-report.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
   });panel.append(download);
   if(!audit.accepted)panel.append(node('p','No eligible final outcomes to compare yet. Run pregame forecasts, then match them with final results.'));
   const wrap=document.createElement('div');wrap.style.overflowX='auto';
   const table=document.createElement('table');table.style.cssText='width:100%;border-collapse:collapse;text-align:left';
   const head=document.createElement('thead'),header=document.createElement('tr');
   for(const text of ['Forecast','Scored games','Scored targets','Pending targets','Baseline avg miss','Adjusted avg miss','Error change','Baseline bias','Adjusted bias','Projection tendency','Evidence']){const th=node('th',text);th.setAttribute('scope','col');header.append(th);}
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
     for(const text of [`${name} · ${label}`,String(m.games),String(m.pairs),String(m.pending),display(m.baselineMAE),display(m.adjustedMAE),change,bias(m.baselineBias),bias(m.adjustedBias),Unit501ForecastDashboard.diagnosis(m),evidence]){const td=node('td',text);td.style.padding='8px 6px';tr.append(td);}
     body.append(tr);
    }
   }
   table.append(body);wrap.append(table);panel.append(wrap,node('p','Pending targets have no matched final statistic yet; this can include upcoming games or missing player statistics after a game ends. They do not count toward scored games or accuracy, and missing stats are never treated as zero. Bias is forecast minus actual: positive means projections ran too high; negative means they ran too low. Near-zero bias can hide large misses in opposite directions, so read it alongside average absolute miss. Both measures use equal weight per game, comparing the same targets with and without scenario adjustments. Leagues and prop markets stay separate. Fewer than 30 games is insufficient evidence; larger samples describe observed errors and do not establish future accuracy or betting profit. Device timestamps and captured reports still require review.'));

   // Segregate leagues, seasons, models, and prop units; never rank yardage against TD counts.
   const reliability=node('details','');reliability.id='forecast-market-reliability';reliability.open=reliabilityOpen;
   reliability.addEventListener('toggle',()=>{reliabilityOpen=reliability.open;});
   reliability.append(node('summary','Market reliability — recorded results by prop type'));
   reliability.append(node('p','Each completed game counts once per market, even if multiple players were projected. The latest and previous windows each use up to 10 matched games, not calendar days. Leagues, seasons and model versions stay separate. These are diagnostic errors measured in each market’s own units; do not compare yards with touchdowns or interpret the smallest error as the best wager.'));
   const reliabilityRows=audit.marketReliability||[];
   if(!reliabilityRows.length)reliability.append(node('p','No recorded prop forecasts in this view yet. Load pregame player projections, then match completed-game statistics to build this history.'));
   else{
    const div=node('div','');div.style.overflowX='auto';
    const tbl=node('table','');tbl.style.cssText='width:100%;border-collapse:collapse;text-align:left;font-size:.9em';
    const header=node('tr','');
    for(const heading of ['League / season / model','Market','Matched games / targets','Pending targets','Average miss','Average signed bias','Latest 10 avg miss','Previous 10 avg miss','Recent direction']){const h=node('th',heading);h.setAttribute('scope','col');h.style.padding='8px 6px';header.append(h);}
    const thead=node('thead','');thead.append(header);tbl.append(thead);
    const tbody=node('tbody','');
    const n2=x=>Number.isFinite(x)?x.toFixed(2):'—';
    for(const m of reliabilityRows){
     const tr=node('tr','');
     const scope=`${m.league==='1'?'NFL':'College'} · ${m.season} · ${m.modelVersion}`;
     for(const v of [scope,labels[m.market]||m.market,`${m.games} games / ${m.targets} targets`,String(m.pending),n2(m.mae),n2(m.bias),
       `${n2(m.recentMAE)} (${m.recentGames})`,`${n2(m.previousMAE)} (${m.previousGames})`,m.trend]){
      const td=node('td',v);td.style.cssText='padding:8px 6px;border-bottom:1px solid #293142;vertical-align:top';tr.append(td);
     }
     tbody.append(tr);
    }
    tbl.append(tbody);div.append(tbl);reliability.append(div);
   }
   reliability.append(node('p','A minimum of 30 distinct matched games in the same league, season, model version and market is required before comparing recent and prior errors; a 10% change is only a review heuristic, not statistical significance. Pending or missing statistics do not count as misses or as zeros. Duplicate, late, invalid, mixed-model and selected-pick rows are excluded using the forecast accuracy gates. Observed accuracy cannot validate a hit probability, sportsbook edge or future profitability. Browser-local archive history can be incomplete.'));
   panel.append(reliability);

   // Diagnostic view is intentionally read-only and collapsed by default.
   // It uses the same eligible archive targets as the accuracy comparison above.
   const missDetails=node('details','');missDetails.id='forecast-miss-patterns';
   missDetails.open=patternsOpen;
   missDetails.addEventListener('toggle',()=>{patternsOpen=missDetails.open;});
   missDetails.append(node('summary','Where projections miss — recent patterns & examples'));
   missDetails.append(node('p','Each game counts once within its league and market. Recent means the latest 10 completed, matched games; previous means the 10 matched games immediately before those, not the last 10 calendar days. These are descriptive checks, not automatic adjustments or validated betting edges.'));
   const names=new Map();
   const identity=r=>JSON.stringify([String(r.league),String(r.season),String(r.gameId),String(r.teamId),r.playerId==null?null:String(r.playerId),r.market]);
   for(const snap of scoped){
    if(snap.selection)continue;
    const g=snap.game||{};
    for(const r of snap.records||[]){
     if(!r||typeof r!=='object')continue;
     const team=String(r.teamId)===String(g.awayId)?g.a:String(r.teamId)===String(g.homeId)?g.h:null;
     const match=g.a&&g.h?g.a+' vs '+g.h:'Game '+r.gameId;
     const who=r.playerId==null?team:(snap.inputs?.playerName||'Player '+r.playerId);
     names.set(identity(r),(who?who+' · ':'')+match);
    }
   }
   const breakdown=node('div','');breakdown.style.overflowX='auto';
   const patternTable=node('table','');patternTable.style.cssText='width:100%;border-collapse:collapse;text-align:left;font-size:.9em';
   const headings=node('tr','');
   for(const heading of ['Market','Matched games','Game-level high / low / even','Latest 10 avg miss','Previous 10 avg miss','Directional review','Largest matched miss']){
    const h=node('th',heading);h.style.padding='8px 6px';headings.append(h);
   }
   patternTable.append(headings);
   let found=false;
   const fmt=n=>n===null?'—':n.toFixed(2);
   const windowText=(value,count)=>fmt(value)+' ('+count+' '+(count===1?'game':'games')+')';
   for(const [league,leagueName]of [['1','NFL'],['2','College']]){
    const series=[['Team points',audit.scores[league]],...Object.entries(audit.props[league]).map(([market,m])=>[labels[market]||market,m])];
    for(const [market,m] of series){
     if(!m.games)continue;
     found=true;
     const p=m.pattern;
     const signal=p.tendency==='insufficient'?'Too few games (<30)':
       p.tendency==='mostly-high'?'Watch: ≥70% games high':
       p.tendency==='mostly-low'?'Watch: ≥70% games low':'Mixed directions';
     const example=p.worst[0];
     const sample=example?(names.get(identity(example))||'Game '+example.gameId)+
       ` — ${example.adjusted.toFixed(1)} projected / ${example.actual.toFixed(1)} actual (${example.signedMiss>0?'+':''}${example.signedMiss.toFixed(1)} miss)`:'—';
     const tr=node('tr','');
     for(const value of [leagueName+' · '+market,String(m.games),
       `${p.highGames} / ${p.lowGames} / ${p.evenGames}`,
       windowText(p.recentMAE,p.recentGames),
       windowText(p.previousMAE,p.previousGames),signal,sample]){
      const td=node('td',value);td.style.cssText='padding:9px 6px;border-bottom:1px solid #293142;vertical-align:top';tr.append(td);
     }
     patternTable.append(tr);
    }
   }
   if(found){breakdown.append(patternTable);missDetails.append(breakdown);}
   else missDetails.append(node('p','No eligible completed game forecasts yet. Pending outcomes cannot establish a pattern.'));
   missDetails.append(node('p','High/low compares each game’s average adjusted forecast with its actual results; score games average both teams. Opposite misses can cancel the signed direction, so inspect absolute error too. The largest example is the single biggest adjusted miss per market, not a guaranteed future outcome. A 70% direction in at least 30 games is only a manual-review flag; multiple markets are being examined. Spreads and totals are graded as selected picks below, not reconstructed as historical bookmaker-line accuracy.'));
   if(picks.length){
    missDetails.append(node('h4','Saved selected picks by market'));
    const groups=new Map();
    for(const pick of picks){
     const groupKey=String(pick.game?.league)+'|'+pick.selection.market;
     const tally=groups.get(groupKey)||{league:String(pick.game?.league),market:pick.selection.market,wins:0,losses:0,pushes:0,pending:0};
     const result=Unit501ForecastArchive.selectionResult(pick);
     if(result==='Win by statistic')tally.wins++;
     else if(result==='Loss by statistic')tally.losses++;
     else if(result==='Push by statistic')tally.pushes++;
     else tally.pending++;
     groups.set(groupKey,tally);
    }
    for(const item of [...groups.values()].sort((a,b)=>a.league.localeCompare(b.league)||a.market.localeCompare(b.market))){
     const market={spread:'Spread',total:'Total',...labels}[item.market]||item.market;
     missDetails.append(node('p',`${{'1':'NFL','2':'College'}[item.league]||item.league} · ${market}: ${item.wins}W–${item.losses}L · ${item.pushes} push · ${item.pending} pending (${item.wins+item.losses} graded decisions).`));
    }
    missDetails.append(node('p','Selected-pick results are statistical outcomes only. They are not verified sportsbook settlement or profit, and selected games are not an unbiased model-accuracy sample.'));
   }
   panel.append(missDetails);
  }catch{panel.append(node('p','Saved forecast archive could not be read. Existing data retained.'));}
 }
 document.addEventListener('unit501:archive-updated',render);
 window.addEventListener('storage',e=>{if(e.key===Unit501ForecastArchive.key||e.key===null)render();});
 window.Unit501ForecastReview={render};render();
})();
