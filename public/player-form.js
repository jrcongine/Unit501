/* Recorded performance, not a player talent grade or calibrated forecast. */
(function(root){
  'use strict';
  const isDNP=g=>g.participation==='dnp'&&g.verification?.participation===true;
  function compareCovers(a,b,mode) {
    const history=row=>{
      const values=row.values.filter(Number.isFinite);
      const above=values.filter(value=>value>row.line).length;
      const below=values.filter(value=>value<row.line).length;
      return {count:values.length,rate:values.length?above/values.length:null,below:values.length?below/values.length:0};
    };
    const x=history(a),y=history(b);
    if(x.rate===null||y.rate===null)return Number(x.rate===null)-Number(y.rate===null);
    return (mode==='least-covers'?x.rate-y.rate||y.below-x.below:y.rate-x.rate)||
      y.count-x.count||a.record.name.localeCompare(b.record.name)||a.def.key.localeCompare(b.def.key);
  }
  function compareRecent(a,b,mode) {
    const side=mode.startsWith('above')?'above':'below';
    const result=row=>{
      const values=row.values.filter(Number.isFinite);
      return {games:values.length,hits:values.filter(v=>side==='above'?v>row.line:v<row.line).length};
    };
    const x=result(a),y=result(b);
    // Do not rank incomplete recorded-game histories ahead of fully verified samples.
    const miss=r=>Number.isFinite(r.form?.coverage?.missing)?r.form.coverage.missing:0;
    if(Boolean(miss(a))!==Boolean(miss(b)))return Number(Boolean(miss(a)))-Number(Boolean(miss(b)));
    // No results are unknown, not 0%. Rank these last in either direction.
    if(!x.games||!y.games)return Number(!x.games)-Number(!y.games)||
      a.record.name.localeCompare(b.record.name)||a.def.key.localeCompare(b.def.key);
    const direction=mode.endsWith('-asc')?1:-1;
    // Compare exact fractions to avoid rounding ties; equal-to-line is a separate non-hit.
    return direction*(x.hits*y.games-y.hits*x.games)||
      y.games-x.games||a.record.name.localeCompare(b.record.name)||a.def.key.localeCompare(b.def.key);
  }
  function roleContext(history,key,team,playerId,game,manual='',now=Date.now()) {
    const alerts=[];
    const labels={new:'New starter',returning:'Back to starter role',primary:'Primary option',increase:'Significant usage increase'};
    if(labels[manual])alerts.push({label:labels[manual],detail:'Your role review for this matchup. Season averages may reflect a smaller prior role.',source:'manual'});
    // Routine starter/depth-chart status is informational, not a role alert.
    // Dedicated availability and report details still retain those source records.
    const fresh=(at,age)=>Number.isFinite(at)&&at<=now&&now-at<=age;
    const metric=key.startsWith('pass')?'attempts':key.startsWith('rush')||key==='carries'?'carries':'targets';
    const label={attempts:'pass attempts',carries:'carries',targets:'targets'}[metric];
    const games=history.filter(g=>Number.isFinite(g.gameDate)&&(!Number.isFinite(game?.kickoff)||g.gameDate*1000<game.kickoff)).sort((a,b)=>b.gameDate-a.gameDate);
    const latest=games[0]?.[metric];
    const prior=games.slice(1,4).map(g=>g[metric]);
    // Compare consecutive team games: missing workload must not become zero or
    // skip a recent gap to manufacture a promotion from an older appearance.
    if(Number.isFinite(latest)&&latest>=0&&prior.length>=2&&prior.every(v=>Number.isFinite(v)&&v>=0)){
      const average=prior.reduce((a,b)=>a+b,0)/prior.length;
      const minimum={attempts:8,carries:5,targets:3}[metric];
      if(latest>=1.5*Math.max(average,1)&&latest-average>=minimum)
        alerts.push({label:'Usage increase',detail:'Latest game: '+latest+' '+label+' vs '+average.toFixed(1)+' across the previous '+prior.length+' games. Review whether the larger role continues.',source:'box-score'});
    }
    // A larger role can begin today, before it appears in past box scores.
    // Match an exact-game official absence to a recently used teammate at the
    // same roster position. This is an opportunity flag, not a starter claim.
    const own=(team?.roster?.rows||[]).filter(p=>String(p.id)===String(playerId));
    const official=team?.official,usage=team?.injuryUsage;
    const scoped=report=>String(report?.gameId)===String(game?.id)&&report?.kickoff===game?.kickoff;
    if(own.length===1&&['QB','RB','FB','WR','TE'].includes(own[0].position)&&
       team.roster.available&&fresh(team.roster.checkedAt,3600000)&&
       official?.available&&scoped(official)&&fresh(official.checkedAt,900000)&&
       usage?.available&&scoped(usage)&&fresh(usage.checkedAt,3600000)&&
       String(usage.league)===String(game?.league)&&String(usage.season)===String(game?.season)){
      const peers=(official.rows||[]).filter(p=>String(p.id)!==String(playerId)&&String(p.teamId)===String(team.id)&&
        p.position===own[0].position&&/^out$|^inactive$/i.test(p.status||'')&&
        (usage.rows||[]).some(r=>String(r.id)===String(p.id)&&r.position===p.position&&r.role==='recent regular contributor'));
      const recorded=games.map(g=>g[metric]).filter(v=>Number.isFinite(v)&&v>=0);
      if(peers.length&&recorded.length>=2&&Number.isFinite(latest)&&latest>0){
        alerts.push({label:'Expanded role opportunity',detail:peers.map(p=>p.name||'Same-position contributor').join(', ')+
          ' ruled out in the current official report. This player has recorded '+label+' and may take on more work; starting status and workload share remain unconfirmed.',source:'absence'});
      }
    }
    return {alerts,active:alerts.length>0,changed:alerts.some(a=>a.source==='manual'||a.source==='box-score'||a.source==='absence')};
  }
  function summarize(history,key) {
    const games=history.filter(g=>Number.isFinite(g.gameDate)&&!isDNP(g)).sort((a,b)=>b.gameDate-a.gameDate);
    const valid=g=>Number.isFinite(g[key]) && (key.endsWith('Yds') || g[key]>=0);
    const gameDetails=games.filter(valid);
    const values=gameDetails.map(g=>g[key]);
    if(values.length<2)return null;
    const average=values.reduce((a,b)=>a+b,0)/values.length;
    let sum=0,weight=0;
    // Age by recorded team game, so missing statistics do not erase elapsed games.
    games.forEach((g,i)=>{if(valid(g)){const w=2**(-i/3);sum+=g[key]*w;weight+=w;}});
    const recentWeighted=sum/weight;
    const weighted=(average+recentWeighted)/2;
    const recent=values.slice(0,3),earlier=values.slice(3);
    const mean=a=>a.reduce((s,v)=>s+v,0)/a.length;
    const trend=earlier.length<2?'Insufficient history for a trend':mean(recent)>mean(earlier)?'Trending up':mean(recent)<mean(earlier)?'Trending down':'Holding steady';
    const latestConsecutiveMissing=games.findIndex(valid);
    return {values,gameDetails,average,recentWeighted,weighted,trend,
      coverage:{dnp:history.filter(g=>Number.isFinite(g.gameDate)&&isDNP(g)).length,teamGames:history.filter(g=>Number.isFinite(g.gameDate)).length,recorded:values.length,total:games.length,missing:games.length-values.length,latestMissing:!valid(games[0]),latestConsecutiveMissing},
      sample:values.length<5?'Limited sample':values.length<9?'Developing sample':'Larger sample'};
  }
  function workloadSummary(history,key) {
    const metric=key.startsWith('pass')?'attempts':key.startsWith('rush')||key==='carries'?'carries':'targets';
    const label={attempts:'Pass attempts',carries:'Carries',targets:'Targets'}[metric];
    const games=history.filter(g=>Number.isFinite(g.gameDate)&&!isDNP(g)).sort((a,b)=>b.gameDate-a.gameDate);
    const values=games.map(g=>Number.isFinite(g[metric])&&g[metric]>=0?g[metric]:null);
    const recorded=values.filter(v=>v!==null);
    const recent=values.slice(0,3);
    const average=recorded.length?recorded.reduce((a,b)=>a+b,0)/recorded.length:null;
    const missing=values.length-recorded.length;
    const text=values.length
      ? `${label}: ${recent.map(v=>v===null?'missing':v).join(', ')} (latest ${recent.length} team games, newest first); ${average===null?'no recorded average':average.toFixed(1)+' average'} (${recorded.length}/${values.length} games recorded)`
      : `${label}: no dated team games available`;
    return {metric,label,recent,average,recorded:recorded.length,total:values.length,missing,text};
  }
  function workloadWarning(history,key) {
    const metric=key.startsWith('pass')?'attempts':key.startsWith('rush')||key==='carries'?'carries':'targets';
    const label={attempts:'pass attempts',carries:'carries',targets:'targets'}[metric];
    const games=history.filter(g=>Number.isFinite(g.gameDate)).sort((a,b)=>b.gameDate-a.gameDate);
    if(games.length && (!Number.isFinite(games[0][metric]) || games[0][metric]<0))
      return `Workload unverified: latest completed team game has no recorded ${label}. Older appearances do not confirm the current role; missing statistics are not zeros.`;
    const values=games.map(g=>g[metric]).filter(v=>Number.isFinite(v)&&v>=0);
    if(values.length<2)return `Workload unverified: fewer than two games with recorded ${label}. Confirm the expected role; this projection does not establish starting status.`;
    const mean=a=>a.reduce((s,v)=>s+v,0)/a.length;
    const recent=mean(values.slice(0,2)),older=values.slice(2);
    if(older.length>=2 && (recent>=2*Math.max(mean(older),1)||recent<=mean(older)/2))
      return `Workload change: latest two games average ${recent.toFixed(1)} ${label}, versus ${mean(older).toFixed(1)} earlier. Verify the current role before using the season/form estimate.`;
    const threshold={attempts:10,carries:5,targets:3}[metric];
    if(mean(values)<threshold)return `Limited recorded workload: ${mean(values).toFixed(1)} ${label} per appearance. A new starting role or larger workload can make this baseline misleading; verify the role first.`;
    return null;
  }
  function efficiencySummary(pairs,key,usageKey) {
    const median=a=>{const v=[...a].sort((a,b)=>a-b),m=Math.floor(v.length/2);return v.length%2?v[m]:(v[m-1]+v[m])/2;};
    const rates=pairs.map(g=>g[key]/g[usageKey]);
    const typical=median(rates);
    // Four paired games are required before damping high efficiency outliers.
    // Keep actual statistics and negative yardage intact; change only the estimate.
    const mad=median(rates.map(v=>Math.abs(v-typical)));
    const cap=pairs.length>=4?typical+Math.max(3*1.4826*mad,Math.abs(typical)*.5,1):Infinity;
    const totalUsage=pairs.reduce((n,g)=>n+g[usageKey],0);
    const pooled=pairs.reduce((n,g,i)=>n+Math.min(rates[i],cap)*g[usageKey],0)/totalUsage;
    return {efficiency:(pooled+typical)/2,dampened:rates.filter(v=>v>cap).length,cap:Number.isFinite(cap)?cap:null};
  }
  // Protect fallback yardage estimates from a single exceptionally high game.
  // Historical results remain untouched; only the estimate is recomputed.
  function guardedYardage(history,key,form) {
    if (!key.endsWith('Yds') || form.values.length<4)
      return {baseline:form.weighted,outlierAdjustment:null};
    const median=items=>{const ordered=[...items].sort((a,b)=>a-b),mid=Math.floor(ordered.length/2);return ordered.length%2?ordered[mid]:(ordered[mid-1]+ordered[mid])/2;};
    const typical=median(form.values);
    const deviation=median(form.values.map(value=>Math.abs(value-typical)));
    const cap=typical+Math.max(3*1.4826*deviation,Math.abs(typical)*0.5,1);
    const count=form.values.filter(value=>value>cap).length;
    if (!count) return {baseline:form.weighted,outlierAdjustment:null};
    const guarded=summarize(history.map(game=>Number.isFinite(game[key])&&game[key]>cap?{...game,[key]:cap}:game),key);
    return {baseline:guarded.weighted,outlierAdjustment:{count,cap,originalBaseline:form.weighted,adjustedBaseline:guarded.weighted}};
  }
  function project(history,key) {
    const original=history;history=history.filter(g=>!isDNP(g));
    const form=summarize(original,key);
    if(!form)return null;
    if(form.coverage.missing>0)
      return {...form,withheld:true,reason:`Only ${form.coverage.recorded} of ${form.coverage.total} completed team games have this stat, so the sample is incomplete. Projection withheld until the missing games can be verified; missing records are not zeros.`};
    const usageKey={rushYds:'carries',recYds:'rec',passYds:'attempts'}[key];
    const pairs=usageKey?history.filter(g=>Number.isFinite(g.gameDate)&&Number.isFinite(g[key])&&Number.isFinite(g[usageKey])&&g[usageKey]>0):[];
    let baseline=form.weighted,usage=null,usageUnavailable=null,outlierAdjustment=null;
    if(pairs.length>=2) {
      const touches=summarize(history,usageKey);
      if(touches.coverage.missing){
        usageUnavailable='Workload statistics are incomplete. Yardage uses recorded yardage form instead of an older workload estimate; verify current usage.';
      } else {
        const estimate=efficiencySummary(pairs,key,usageKey);
        baseline=touches.weighted*estimate.efficiency;
        usage={key:usageKey,workload:touches.weighted,efficiency:estimate.efficiency,games:pairs.length,
          dampened:estimate.dampened,efficiencyCap:estimate.cap};
      }
    }
    if (!usage) {
      const guarded=guardedYardage(history,key,form);
      baseline=guarded.baseline;
      outlierAdjustment=guarded.outlierAdjustment;
    }
    return {...form,baseline,usage,usageUnavailable,outlierAdjustment};
  }
  function reviewChecks(model,entry,availability,now=Date.now()) {
    const reasons=[];
    if(availability?.state!=='available')reasons.push(availability?.state==='conditional' ? 'Conditional availability: verify participation' : 'Verify participation');
    if(model.values.length<5) reasons.push('Fewer than 5 recorded games');
    if(model.form.coverage.missing>0) reasons.push('Missing game statistics');
    if(model.form.outlierAdjustment?.count) reasons.push('Review outlier-adjusted yardage');
    if(model.workloadWarning || model.form.usageUnavailable || model.workloadHistory?.missing>0) reasons.push('Verify current workload');
    if(model.workload!==100 || model.lineupChange) reasons.push('Scenario-adjusted projection');
    if(!Number.isFinite(entry.savedAt) || entry.savedAt>now || now-entry.savedAt>1800000) reasons.push('Refresh line');
    return reasons;
  }
  // Describes input coverage and cautions, never the likelihood of a wager winning.
  function dataSupport(model,availability) {
    const count=Array.isArray(model?.values)?model.values.length:0;
    const sample=count<5?'Thin sample':count<9?'Developing sample':'Larger sample';
    const flags=[];
    if(model?.form?.coverage?.missing>0)flags.push('stat gaps');
    if(model?.form?.coverage?.latestMissing)flags.push('latest stat missing');
    if(model?.form?.outlierAdjustment?.count)flags.push('yardage spike dampened');
    if(model?.workloadWarning || model?.form?.usageUnavailable || model?.workloadHistory?.missing>0)flags.push('workload uncertainty');
    if(model?.form?.usage?.dampened>0)flags.push('efficiency outlier adjustment');
    if(model?.workload!==100 || model?.lineupChange)flags.push('scenario input');
    if(availability?.state==='conditional')flags.push('conditional availability');
    const needsReview=count<5 || flags.length>0;
    return {sample,count,flags,needsReview,
      label:`${sample} (${count} recorded games)${flags.length?' • Review: '+flags.join(', '):' • No additional data flags'}`};
  }
  const api={isDNP,roleContext,compareRecent,compareCovers,efficiencySummary,summarize,workloadSummary,workloadWarning,project,reviewChecks,dataSupport};
  if(typeof module!=='undefined' && module.exports)module.exports=api;
  else root.Unit501PlayerForm=api;
})(typeof globalThis!=='undefined'?globalThis:this);
