/* Explicit role/replacement scenarios relative to the recorded baseline lineup. */
(function(root){
  'use strict';
  function evaluate(players,scenarios,teamContext,game){
    const result={applied:false,teams:{},props:{},details:[],withheld:[]};
    const used=new Set(),replaced=new Set(scenarios.map(s=>String(s.teamId)+':'+String(s.playerId)));
    const valid=p=>p&&p.games>=2&&!p.latestMissing&&p.coverage.recorded*2>=p.coverage.total&&p.usage>0&&Number.isFinite(p.efficiency);
    for(const s of scenarios){
      const original=players.find(p=>String(p.teamId)===String(s.teamId)&&String(p.id)===String(s.playerId));
      const replacement=players.find(p=>String(p.teamId)===String(s.teamId)&&String(p.id)===String(s.replacementId));
      const key=String(s.teamId)+':'+String(s.playerId),replacementKey=String(s.teamId)+':'+String(s.replacementId);
      if(used.has(key)||!s.confirmed||!original||!replacement||key===replacementKey||replaced.has(replacementKey)||original.role!==replacement.role||!Number.isFinite(s.workload)||s.workload<0||s.workload>=100){result.withheld.push('Verify the baseline role, same-position replacement and workload; replacement chains and duplicate scenarios are not supported.');continue;}
      used.add(key);
      const categories=original.role==='QB'?['passing']:['RB','FB'].includes(original.role)?['rushing','receiving']:['WR','TE'].includes(original.role)?['receiving']:[];
      const available=categories.filter(k=>valid(original.profiles?.[k])&&valid(replacement.profiles?.[k]));
      if(!available.length){result.withheld.push(original.name+': replacement impact unavailable; need recent recorded workload and efficiency for both players. Blocking, coverage and special-team score effects require a separate point scenario.');continue;}
      const team=result.teams[String(s.teamId)]??={passing:0,receiving:0,rushing:0,points:0};
      for(const category of available){
        const from=original.profiles[category],to=replacement.profiles[category];
        const removed=from.usage*(1-s.workload/100);
        // An efficiency difference changes output on transferred touches only.
        // Existing normal production is already in team scores and props.
        const delta=removed*(to.efficiency-from.efficiency);
        team[category]+=delta;
        const originalProp=result.props[key]??={};originalProp[category]={scale:s.workload/100,extraUsage:0,efficiency:from.efficiency};
        const replacementProp=result.props[replacementKey]??={};
        const change=replacementProp[category]??={scale:1,extraUsage:0,efficiency:to.efficiency};change.extraUsage+=removed;
        result.details.push({teamId:String(s.teamId),player:original.name,replacement:replacement.name,category,transferredUsage:removed,yardChange:delta,workload:s.workload});
      }
    }
    for(const [id,change]of Object.entries(result.teams)){
      const t=teamContext?.teams?.find(t=>String(t.id)===id);
      const rush=t?.metrics?.rushFor,pass=t?.metrics?.passFor,points=t?.metrics?.pointsFor;
      if(t?.games>=2&&[rush,pass,points].every(m=>m?.games===t.games&&Number.isFinite(m.average))&&rush.average+pass.average>0){
        // QB and receiver output cover the same passing yards. Use the larger
        // change rather than adding both perspectives of those yards.
        const passing=Math.abs(change.passing)>=Math.abs(change.receiving)?change.passing:change.receiving;
        const yards=passing+change.rushing;
        change.points=Math.max(-8,Math.min(8,yards*points.average/(rush.average+pass.average)*.5));
      }else result.withheld.push('Team '+id+': score impact waits for complete offensive yardage; player workload scenarios still apply.');
    }
    result.applied=result.details.length>0;
    result.gameId=String(game?.id);result.kickoff=game?.kickoff;
    return result;
  }
  function adjustProp(baseline,key,change){
    const category=['passYds','attempts','passTD'].includes(key)?'passing':['rushYds','carries','rushTD'].includes(key)?'rushing':['recYds','rec','recTD'].includes(key)?'receiving':null;
    const row=change?.[category];
    if(!row||!Number.isFinite(baseline))return baseline;
    if(key.endsWith('TD'))return row.scale===1?baseline:baseline*row.scale;
    return baseline*row.scale+row.extraUsage*(key.endsWith('Yds')?row.efficiency:1);
  }
  const api={evaluate,adjustProp};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.Unit501LineupModel=api;
})(typeof globalThis!=='undefined'?globalThis:this);
