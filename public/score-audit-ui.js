/* Shared compact rendering for replay and genuinely saved forecast audits. */
(function(root){
 'use strict';
 function render(check,title){
  const node=(tag,text)=>{const n=document.createElement(tag);n.textContent=text;return n;};
  const details=node('details','');details.append(node('summary',title));
  const fmt=v=>Number.isFinite(v)?v.toFixed(1):'—';
  const wrap=node('div','');wrap.style.overflowX='auto';
  const table=node('table','');table.style.width='100%';
  const head=node('tr','');
  for(const label of ['Sample','Games','Total avg miss','Total bias','Margin avg miss','Favorite-margin bias']){const th=node('th',label);th.scope='col';head.append(th);}table.append(head);
  const row=(label,m)=>{const tr=node('tr','');for(const value of [label,m.games,fmt(m.totalMAE),fmt(m.totalBias),fmt(m.marginMAE),fmt(m.favoriteMarginBias)])tr.append(node('td',String(value)));table.append(tr);};
  details.append(node('p',`${check.overall.actualBlowouts ?? 0} actual 21+ point games; ${check.overall.projectedBlowouts ?? 0} point forecasts of 21+. ${check.overall.closeProjectionBlowouts ?? 0} actual blowouts followed projections below 7 points. A mean score need not match the most extreme possible outcome.`));
  row('All eligible games',check.overall);row('Latest 10 eligible games',check.recent);
  for(const band of check.marginBands)row('Projected margin '+band.label,band);
  row('Later games · current',check.candidate.current);row('Same games · candidate',check.candidate.proposed);
  wrap.append(table);details.append(wrap);
  details.append(node('p',check.candidate.status==='insufficient'?`Candidate evaluation: ${check.candidate.current.games}/30 later games; insufficient evidence. Live formula unchanged.`:check.candidate.status==='review-candidate'?'Candidate had lower total and margin error in this sample. Ready for further review, not automatically activated.':'Candidate did not improve both total and margin error. Current formula retained.'));
  details.append(node('p',check.explanation));return details;
 }
 root.Unit501ScoreAuditUI={render};
})(typeof globalThis!=='undefined'?globalThis:this);
