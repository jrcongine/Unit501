/* Explicit role/replacement scenarios relative to the recorded baseline lineup. */
(function(root){
  'use strict';
  function evaluate(players,scenarios,teamContext,game){
    const result={applied:false,teams:{},props:{},details:[],withheld:[]};
    const used=new Set(),replaced=new Set(scenarios.map(s=>String(s.teamId)+':'+String(s.playerId)));
    const valid=p=>p&&p.games>=2&&!p.latestMissing&&p.coverage?.recorded*2>=p.coverage?.total&&Number.isFinite(p.usage)&&p.usage>0&&Number.isFinite(p.efficiency);
    for(const s of scenarios){
      const original=players.find(p=>String(p.teamId)===String(s.teamId)&&String(p.id)===String(s.playerId));
      const key=String(s.teamId)+':'+String(s.playerId);
      const categories=original?.role==='QB'?['passing']:['RB','FB'].includes(original?.role)?['rushing','receiving']:['WR','TE'].includes(original?.role)?['receiving']:[];
      const allocations=s.allocations || [{replacementId:s.replacementId,shares:Object.fromEntries(categories.map(k=>[k,s.replacementShare??100]))}];
      const replacements=allocations.map(a=>({...a,player:players.find(p=>String(p.teamId)===String(s.teamId)&&String(p.id)===String(a.replacementId))}));
      if(used.has(key)||!s.confirmed||!original||!categories.length||!replacements.length||new Set(replacements.map(r=>String(r.replacementId))).size!==replacements.length||
         replacements.some(r=>!r.player||String(r.replacementId)===String(s.playerId)||replaced.has(String(s.teamId)+':'+String(r.replacementId))||r.player.role!==original.role)||
         !Number.isFinite(s.workload)||s.workload<0||s.workload>=100){result.withheld.push('Verify the baseline role, same-position replacements and workload; replacement chains and duplicate scenarios are not supported.');continue;}
      if(categories.some(k=>replacements.some(r=>!Number.isFinite(r.shares?.[k]??0)||(r.shares?.[k]??0)<0||(r.shares?.[k]??0)>100)||replacements.reduce((n,r)=>n+(r.shares?.[k]??0),0)>100+1e-8)){result.withheld.push('Replacement shares must be between 0 and 100 percent and total no more than 100 percent per workload category.');continue;}
      used.add(key);
      const team=result.teams[String(s.teamId)]??={passing:0,receiving:0,rushing:0,points:0,scoreReady:false};
      for(const category of categories){
        const from=original.profiles?.[category];
        if(!valid(from)){team.incompleteProfiles=true;result.withheld.push(original.name+': replacement impact unavailable; need recent recorded workload and efficiency for both players.');continue;}
        // Normal production is already in the baseline; change only transferred workload.
        const removed=from.usage*(1-s.workload/100);
        const usable=replacements.filter(r=>(r.shares?.[category]??0)>0&&valid(r.player.profiles?.[category]));
        if(replacements.some(r=>(r.shares?.[category]??0)>0&&!valid(r.player.profiles?.[category])))team.incompleteProfiles=true;
        const assignedShare=usable.reduce((n,r)=>n+r.shares[category],0);
        if(assignedShare<100-1e-8)team.unassignedWorkload=true;
        if(!usable.length){team.incompleteProfiles=true;result.withheld.push(original.name+': replacement impact unavailable; need recent recorded workload and efficiency for both players.');continue;}
        const originalProp=result.props[key]??={};originalProp[category]={scale:s.workload/100,extraUsage:0,efficiency:from.efficiency};
        for(const r of usable){
          const to=r.player.profiles[category],share=r.shares[category],transferred=removed*share/100;
          const delta=transferred*(to.efficiency-from.efficiency);team[category]+=delta;
          const replacementKey=String(s.teamId)+':'+String(r.replacementId);
          const replacementProp=result.props[replacementKey]??={};
          const change=replacementProp[category]??={scale:1,extraUsage:0,efficiency:to.efficiency};
          // A QB replaces the passing role; prior backup appearances are not extra possessions.
          if(category==='passing'&&!change.baselineReplaced){change.extraUsage-=to.usage;change.baselineReplaced=true;}
          change.extraUsage+=transferred;
          result.details.push({teamId:String(s.teamId),player:original.name,replacement:r.player.name,category,transferredUsage:transferred,unassignedUsage:Math.max(0,removed*(1-assignedShare/100)),replacementShare:share,yardChange:delta,workload:s.workload});
        }
      }
    }
    for(const [id,change]of Object.entries(result.teams)){
      if(change.incompleteProfiles){result.withheld.push('Team '+id+': score impact withheld because replacement workload coverage is incomplete.');continue;}
      if(change.unassignedWorkload){result.withheld.push('Team '+id+': score impact withheld because some removed workload has no assigned replacement. Player workload scenarios still apply.');continue;}
      const t=teamContext?.teams?.find(t=>String(t.id)===id);
      const rush=t?.metrics?.rushFor,pass=t?.metrics?.passFor,points=t?.metrics?.pointsFor;
      if(t?.games>=2&&[rush,pass,points].every(m=>m?.games===t.games&&Number.isFinite(m.average))&&rush.average+pass.average>0){
        // QB and receiver output cover the same passing yards. Use the larger
        // change rather than adding both perspectives of those yards.
        const passing=Math.abs(change.passing)>=Math.abs(change.receiving)?change.passing:change.receiving;
        const yards=passing+change.rushing;
        change.scoreReady=true;
        change.points=Math.max(-8,Math.min(8,yards*points.average/(rush.average+pass.average)*.5));
      }else result.withheld.push('Team '+id+': score impact waits for complete offensive yardage; player workload scenarios still apply.');
    }
    result.applied=result.details.length>0;
    result.gameId=String(game?.id);result.kickoff=game?.kickoff;
    return result;
  }
  function recommend(players,original,data,game,assess,now=Date.now()){
    const unknown=reason=>({state:'unknown',candidates:[],allocations:[],reason});
    if(!original||!Number.isFinite(game?.kickoff)||game.kickoff<=now||game.kickoff>now+7*86400000)return unknown('Replacement estimates apply to upcoming games within seven days.');
    const team=data?.teams?.find(t=>String(t.id)===String(original.teamId));
    const fresh=(r,age)=>r?.available&&Number.isFinite(r.checkedAt)&&r.checkedAt<=now&&now-r.checkedAt<=age;
    if(!data?.current||!fresh(team?.roster,3600000))return unknown('Replacement team membership needs a fresh roster.');
    const status=assess(data,game,original.teamId,original.id,now,true);
    if(!['unavailable','nonstarter'].includes(status.state))return unknown(status.state==='conflict'?'Conflicting reports: replacement estimate withheld.':'No verified absence or announced QB role change; replacement workload is unknown.');
    const categories=original.role==='QB'?['passing']:['RB','FB'].includes(original.role)?['rushing','receiving']:['WR','TE'].includes(original.role)?['receiving']:[];
    if(!categories.length)return unknown('This position lacks a supported workload model.');
    const scoped=r=>String(r?.gameId)===String(game.id)&&r.kickoff===game.kickoff;
    const starters=team.starters,announced=scoped(starters)&&Number.isFinite(starters.checkedAt)&&starters.checkedAt<=now&&now-starters.checkedAt<=900000?
      (starters.rows||[]).filter(r=>r.position===original.position&&String(r.id)!==String(original.id)&&Number.isFinite(Date.parse(r.publishedAt))&&Date.parse(r.publishedAt)<=now&&now-Date.parse(r.publishedAt)<=7*86400000):[];
    const depth=fresh(team.depth,3600000)&&scoped(team.depth)?team.depth.rows||[]:[];
    const slots=depth.filter(r=>String(r.id)===String(original.id)&&r.position===original.position);
    if(announced.length>1||(!announced.length&&slots.length!==1))return unknown('A unique replacement order or reviewed starter announcement is unavailable.');
    if(!announced.length&&!slots[0].slot&&depth.filter(r=>r.position===slots[0].position&&r.rank===slots[0].rank).length>1)return unknown('Multiple depth-chart positions share this label; the replacement slot is unresolved.');
    if(!announced.length&&(team.depth.unresolved||[]).some(r=>r.position===slots[0].position&&(!slots[0].slot||r.slot===slots[0].slot)&&r.rank>slots[0].rank))return unknown('A lower-depth player in this replacement slot could not be uniquely matched to the roster; workload split withheld.');
    let ordered=announced.length===1?announced:depth.filter(r=>r.position===slots[0].position&&(!slots[0].slot||r.slot===slots[0].slot)&&r.rank>slots[0].rank).sort((a,b)=>a.rank-b.rank);
    if(original.role==='QB'&&!announced.length){const eligible=ordered.filter(r=>!assess(data,game,original.teamId,r.id,now,true).blocked);ordered=eligible.slice(0,1);}
    if(ordered.some(r=>!assess(data,game,original.teamId,r.id,now,true).blocked&&!players.some(p=>String(p.teamId)===String(original.teamId)&&String(p.id)===String(r.id)&&p.role===original.role)))return unknown('An eligible replacement lacks a matching production profile; workload split withheld.');
    const ids=[...new Set(ordered.map(r=>String(r.id)))];
    const candidates=ids.map(id=>players.find(p=>String(p.teamId)===String(original.teamId)&&String(p.id)===id&&p.role===original.role))
      .filter(p=>p&&team.roster.rows.some(r=>String(r.id)===String(p.id))&&!assess(data,game,p.teamId,p.id,now,true).blocked)
      .map(p=>({id:String(p.id),name:p.name,roleState:announced.length===1?'confirmed':'estimated',workloadState:'unknown',usage:{},source:announced.length===1?announced[0].url:team.depth.url,profiles:p.profiles||{}}));
    if(!candidates.length)return unknown('No eligible replacement matched the current roster and availability checks.');
    const valid=p=>p&&p.games>=2&&!p.latestMissing&&p.coverage?.recorded*2>=p.coverage?.total&&Number.isFinite(p.usage)&&p.usage>0&&Number.isFinite(p.efficiency);
    const allocations=candidates.map(p=>({replacementId:p.id,shares:{}}));
    for(const category of categories){
      if(!valid(original.profiles?.[category])||candidates.some(p=>!valid(p.profiles[category])))continue;
      const total=candidates.reduce((n,p)=>n+p.profiles[category].usage,0);
      candidates.forEach((p,i)=>{const share=p.profiles[category].usage/total*100;allocations[i].shares[category]=share;p.usage[category]={baseline:p.profiles[category].usage,extra:original.profiles[category].usage*share/100,total:original.role==='QB'?original.profiles[category].usage*share/100:p.profiles[category].usage+original.profiles[category].usage*share/100,share};});
    }
    for(const p of candidates){if(original.role==='QB'&&p.usage.passing)p.usage.passing.extra=p.usage.passing.total-p.usage.passing.baseline;p.workloadState=Object.keys(p.usage).length?'estimated':'unknown';}
    return {state:candidates.some(p=>p.workloadState==='estimated')?'estimated':'unknown',candidates,allocations:allocations.filter(a=>Object.keys(a.shares).length),
      reason:'Estimated split uses recent recorded usage among eligible lower-depth players, or the announced starter. It assumes the absent player’s entire baseline workload is reassigned. Depth order does not establish future touches; missing candidate usage leaves that category unknown. Review before applying; previous games may already reflect the absence.'};
  }
  function adjustProp(baseline,key,change){
    const category=['passYds','attempts','passTD'].includes(key)?'passing':['rushYds','carries','rushTD'].includes(key)?'rushing':['recYds','rec','recTD'].includes(key)?'receiving':null;
    const row=change?.[category];
    if(!row||!Number.isFinite(baseline))return baseline;
    if(key.endsWith('TD'))return row.scale===1?baseline:baseline*row.scale;
    return baseline*row.scale+row.extraUsage*(key.endsWith('Yds')?row.efficiency:1);
  }
  const api={evaluate,adjustProp,recommend};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.Unit501LineupModel=api;
})(typeof globalThis!=='undefined'?globalThis:this);
