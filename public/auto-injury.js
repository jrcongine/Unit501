/* Experimental, conservative injury scenarios from verified game-scoped reports.
   These are uncalibrated sensitivity assumptions, not measured player values. */
(function(root){
 'use strict';
 const weights={
  CB:['defense',0.5],S:['defense',0.5],FS:['defense',0.5],SS:['defense',0.5],
  DE:['defense',0.5],EDGE:['defense',0.5],OLB:['defense',0.35],ILB:['defense',0.35],LB:['defense',0.35],
  DT:['defense',0.3],NT:['defense',0.3],
  T:['offense',0.35],OT:['offense',0.35],G:['offense',0.3],OG:['offense',0.3],C:['offense',0.3],
  WR:['offense',0.35],RB:['offense',0.25],FB:['offense',0.15],TE:['offense',0.2]
 };
 const position = value => {const p=String(value||'').trim().toUpperCase();return ({LT:'T',RT:'T',OT:'T',LG:'G',RG:'G',OG:'G',LDE:'DE',RDE:'DE',LDT:'DT',RDT:'DT'})[p]||p;};
 const roleMatches=(chart,provider)=>{const c=position(chart),p=position(provider);return c===p||(c==='DL'&&['DE','DT','NT'].includes(p))||(c==='DB'&&['CB','S','FS','SS'].includes(p));};
 const empty=()=>({awayOffense:0,awayDefense:0,homeOffense:0,homeDefense:0});
 const fresh=(record,age,now)=>record?.available===true&&Number.isFinite(record.checkedAt)&&record.checkedAt<=now&&now-record.checkedAt<=age;
 const matchGame=(r,game)=>r&&String(r.gameId)===String(game.id)&&r.kickoff===game.kickoff&&
   (!r.league||String(r.league)===String(game.league))&&(!r.season||String(r.season)===String(game.season));
 const status=v=>String(v||'').trim().toLowerCase();
 // Exact full-name agreement only: do not fabricate a provider player ID or
 // broaden nickname/suffix matching when the provider roster is incomplete.
 const nameKey=v=>String(v||'').trim().toLowerCase().replace(/[.’']/g,'').replace(/\s+/g,' ');
 function missingRosterRole(t,player,game,now){
  const key=nameKey(player.name),pos=position(player.position);
  if(!key||String(game.league)!=='1'||!weights[pos]||!fresh(t.depth,3600000,now)||!matchGame(t.depth,game))return null;
  const same=r=>nameKey(r.name)===key;
  const collisionKey=v=>nameKey(v).replace(/\s+(jr|sr|ii|iii|iv|v)$/,'').replace(/[^a-z0-9]/g,'');
  const collision=r=>collisionKey(r.name)===collisionKey(player.name);
  // Any existing provider identity or resolved report must use the normal path.
  if((t.roster.rows||[]).some(collision)||(t.official.rows||[]).some(collision)||(t.injuries?.rows||[]).some(collision))return null;
  const reports=(t.official.unresolved||[]).filter(same);
  if(reports.some(r=>status(r.status)!=='out'||position(r.position)!==pos))return null;
  const rows=[...(t.depth.rows||[]),...(t.depth.unresolved||[])];
  if(rows.some(r=>collision(r)&&!same(r)))return null;
  const matches=rows.filter(same);
  if(matches.length!==1)return null;
  const row=matches[0];
  if(row.id||row.unresolved||row.names||row.reason!=='No matching player identity in the provider roster.'||!roleMatches(row.position,pos))return null;
  if(!row.slot||rows.some(r=>r!==row&&r.slot===row.slot&&r.rank===row.rank))return null;
  if(row.rank!==1&&!(pos==='RB'&&row.rank===2))return null;
  return {pos,reserve:row.rank===2};
 }
 function evaluate(data,game,lineup,now=Date.now(),context=null){
  const injury=empty(),applied=[],withheld=[];
  const quarterback={away:0,home:0};
  const state={injury,quarterback,applied,withheld,ready:false,
   message:'Automatic injury scoring unavailable. Baseline retained; no absence is assumed healthy.'};
  if(!game||!['1','2'].includes(String(game.league))||!Number.isFinite(now)||!Number.isFinite(game.kickoff)||game.kickoff<=now||
    game.kickoff>now+7*86400000){state.message='Automatic scenarios currently support upcoming NFL and college games within seven days only.';return state;}
  if(!data?.current||!Array.isArray(data.teams)){state.message='Live roster and official injury feeds have not loaded. Zero means unknown, not healthy.';return state;}
  const teams=[[String(game.awayId),'away'],[String(game.homeId),'home']].map(([teamId,side])=>({
   teamId,side,label:side==='away'?game.a||'Away':game.h||'Home',
   team:data.teams.find(t=>String(t.id)===teamId)
  }));
  for(const {label,team:t} of teams){
   if(!t||!fresh(t.roster,3600000,now)||!fresh(t.official,900000,now)||!matchGame(t.official,game))
    withheld.push(label+': current matched roster and official game report required; no point estimate.');
   if(!t||(!(fresh(t.depth,3600000,now)&&matchGame(t.depth,game)||fresh(t.injuryUsage,3600000,now)&&matchGame(t.injuryUsage,game))&&!(fresh(t.quarterback,3600000,now)&&matchGame(t.quarterback,game)&&t.quarterback.rows?.length>0)))
    withheld.push(label+': player-role data unavailable, expired, or for a different matchup; no point estimate.');
  }
  if(withheld.length){
   state.message='Automatic injury coverage incomplete for at least one team. No automatic points for either team; keep baseline until both official game reports and player-role data are fresh.';
   return state;
  }
  for(const {teamId,side,label,team:t} of teams){
   const roster=new Map((t.roster.rows||[]).filter(r=>r?.id).map(r=>[String(r.id),r]));
   // IR players are often absent from the weekly game-status report. Only a fresh
   // provider roster's explicit injured-reserve group can add these candidates.
   // Never treat an empty weekly report as proof of health.
   const officialOuts=(t.official.rows||[]).filter(r=>status(r.status)==='out'&&String(r.teamId)===teamId);
   const reserveOuts=String(game.league)==='1'?(t.roster.rows||[])
     .filter(r=>r.id&&/\binjured reserve\b/i.test(r.group||''))
     .map(r=>({...r,teamId,status:'Injured reserve',rosterIR:true})):[];
   const outs=[...officialOuts,...reserveOuts];
   const seen=new Set();
   for(const player of outs){
    const id=String(player.id);
    if(seen.has(id))continue;
    seen.add(id);
    const name=player.name||roster.get(id)?.name||'Player '+id;
    const base=roster.get(id);
    if(!base){withheld.push(label+': '+name+' not confirmed on this roster; no estimate.');continue;}
    const ownership=data.rosterOwnership;
    if(ownership?.available&&Number.isFinite(ownership.checkedAt)&&ownership.checkedAt<=now&&now-ownership.checkedAt<=3600000&&
       (ownership.conflicts||[]).some(r=>String(r.id)===id&&(r.teamIds||[]).map(String).includes(teamId))){
      withheld.push(label+': '+name+' has conflicting team ownership; no estimate.');continue;
    }
    // Do not contradict a different fresh status or override uncertain game statuses.
    const statuses=(t.official.rows||[]).filter(r=>String(r.id)===id&&String(r.teamId)===teamId).map(r=>status(r.status));
    const other=(fresh(t.injuries,900000,now)?t.injuries.rows||[]:[])
      .filter(r=>String(r.id)===id&&(!r.teamId||String(r.teamId)===teamId));
    const alternatives=other.filter(r=>r.date&&Number.isFinite(Date.parse(r.date))&&Date.parse(r.date)<=now&&now-Date.parse(r.date)<=7*86400000&&(!Number.isFinite(t.official.publishedAt)||Date.parse(r.date)>=t.official.publishedAt)&&
      !['out','sidelined','inactive','injured reserve','ir'].includes(status(r.status))&&
      // A dated, generic conditional report older than a day cannot overturn
      // the current matched game's definitive Out report. Keep explicit active,
      // same-game, recent, or demonstrably newer reports as conflicts.
      !(['questionable','doubtful'].includes(status(r.status))&&!r.gameId&&
        now-Date.parse(r.date)>86400000&&
        (!Number.isFinite(t.official.publishedAt)||Date.parse(r.date)<t.official.publishedAt)));
    if(statuses.some(s=>s!=='out')||alternatives.length){
     const details='official game report: '+statuses.map(s=>s||'blank').join(', ')+(alternatives.length?'; provider: '+alternatives.map(r=>(r.status||'Unknown')+' ('+r.date+')').join(', '):'');
     withheld.push(label+': '+name+' has conflicting or conditional reports; '+details+'; no estimate.');continue;
    }
    const pos=position(base.position);
    if(pos==='QB'){
     const report=t.quarterback;
     const candidates=fresh(report,3600000,now)&&matchGame(report,game)?(report.rows||[]).filter(r=>String(r.playerId)===id):[];
     const r=candidates.length===1?candidates[0]:null;
     const replacementStatus=r?(t.official.rows||[]).filter(x=>String(x.id)===String(r.replacementId)).map(x=>status(x.status)):[];
     const replacementConflict=r&&data.rosterOwnership?.available&&(data.rosterOwnership.conflicts||[]).some(x=>String(x.id)===String(r.replacementId));
     if(replacementConflict||replacementStatus.some(s=>s&&!['available','active'].includes(s))){withheld.push(label+': backup status changed; no QB adjustment.');continue;}
     const stats=context?.before===game.kickoff&&String(context?.season)===String(game.season)?context.teams?.find(x=>String(x.id)===teamId):null;
     const metrics=['pointsFor','passFor','rushFor'].map(k=>stats?.metrics?.[k]);
     const overlap=lineup?.applied&&lineup.gameId===String(game.id)&&lineup.kickoff===game.kickoff&&
       Object.entries(lineup.props||{}).some(([key,value])=>key.startsWith(teamId+':')&&(value.passing||value.receiving));
     if(overlap){withheld.push(label+': QB passing change already included in lineup scenario.');continue;}
     if(!r||!Number.isFinite(r.yardChange)||Math.abs(r.yardChange)>100||!roster.has(String(r.replacementId))||r.backupAttempts<20||r.starterAttempts<40||
       !(stats?.games>=2)||!metrics.every(m=>m?.games===stats.games&&Number.isFinite(m.average)&&m.average>=0)||metrics[1].average+metrics[2].average<=0){
      withheld.push(label+': '+name+' (QB) requires confirmed replacement or a unique backup estimate with passing-workload evidence; no automatic points.');continue;
     }
     const points=Math.round(Math.max(-4,Math.min(4,r.yardChange*metrics[0].average/(metrics[1].average+metrics[2].average)*.5))*100)/100;
     quarterback[side]=points;
     applied.push({teamId,side,playerId:id,name,position:'QB',category:'quarterback',points,replacement:r.replacement,role:r.role,evidence:r.source});
     continue;
    }
    const depthRows=String(game.league)==='1'&&fresh(t.depth,3600000,now)&&matchGame(t.depth,game)?t.depth.rows||[]:[];
    const slots=depthRows.filter(r=>String(r.id)===id&&roleMatches(r.position,pos)&&r.rank===1);
    const usageRows=fresh(t.injuryUsage,3600000,now)&&matchGame(t.injuryUsage,game)?t.injuryUsage.rows||[]:[];
    const usage=usageRows.filter(r=>String(r.id)===id&&position(r.position)===pos&&['RB','WR','TE'].includes(pos));
    // An NFL RB2 has a documented depth role even when the recent workload
    // threshold is not met. Use a smaller explicit sensitivity, not starter value.
    const rbDepth=pos==='RB'?depthRows.filter(r=>String(r.id)===id&&position(r.position)==='RB'):[];
    const rb2=rbDepth.length===1&&rbDepth[0].rank===2&&
      depthRows.filter(r=>position(r.position)==='RB'&&r.slot===rbDepth[0].slot&&r.rank===2).length===1;
    if(slots.length>1||!(slots.length===1||usage.length===1||rb2)){withheld.push(label+': '+name+' (OUT) has no unique starter, RB2, or recent regular workload evidence; no estimate.');continue;}
    const reserve=slots.length===0&&usage.length!==1&&rb2;
    const role=slots.length===1?'listed first-string':reserve?'listed RB2; 0.10-point depth assumption':'recent regular contributor';
    const weight=weights[pos];
    if(!weight){withheld.push(label+': '+name+' (OUT, '+pos+') has no supported positional sensitivity assumption.');continue;}
    const lineupProps=lineup?.gameId===String(game.id)&&lineup?.kickoff===game.kickoff?
      lineup.props?.[teamId+':'+id]:null;
    if(lineupProps&&Object.values(lineupProps).some(change=>change?.scale<1)){
      withheld.push(label+': '+name+' already has a lineup scenario; automatic estimate not added.');continue;
    }
    const field=side+(weight[0]==='offense'?'Offense':'Defense');
    const available=Math.max(0,2-injury[field]);
    const points=Math.round(Math.min(reserve?0.10:weight[1],available)*100)/100;
    if(points<=0){withheld.push(label+': positional sensitivity capped at 2 points for '+weight[0]+'.');continue;}
    injury[field]+=points;
    applied.push({teamId,side,playerId:id,name,position:pos,category:weight[0],points,role,
      status:player.rosterIR?'Injured reserve':'Out',evidence:player.rosterIR?null:t.official.url||null});
   }
   const handledNames=new Set();
   for(const p of t.official.unresolved||[])if(status(p.status)==='out'){
    const key=nameKey(p.name);if(handledNames.has(key))continue;handledNames.add(key);
    const role=missingRosterRole(t,p,game,now);
    if(!role){withheld.push(label+': '+p.name+' (OUT) — provider roster identity missing; impact not estimated.');continue;}
    const [category,weight]=weights[role.pos],field=side+(category==='offense'?'Offense':'Defense');
    const points=Math.round(Math.min(role.reserve?0.10:weight,Math.max(0,2-injury[field]))*100)/100;
    if(points<=0){withheld.push(label+': positional sensitivity capped at 2 points for '+category+'.');continue;}
    injury[field]+=points;
    applied.push({teamId,side,playerId:null,name:p.name,position:role.pos,category,points,status:'Out',
     role:(role.reserve?'listed RB2; 0.10-point depth assumption':'listed first-string')+'; official name match, provider ID unavailable',
     identitySource:'official-report-and-team-depth',evidence:t.official.url||null,depthEvidence:t.depth.url||null});
   }
   if(t.official.unmatched||t.official.unresolved?.length)withheld.push(label+': provider identities remain unresolved; supported official-name depth matches are shown separately without inferred player IDs.');
   if(!applied.some(p=>p.teamId===teamId))withheld.push(label+': no supported injury adjustment; this does not establish full health.');
  }
  state.ready=true;
  state.message='Experimental positional injury sensitivity: fresh, matched official Out reports or explicit injured-reserve entries from current NFL provider rosters, with starter, RB2 depth, or recent workload evidence; capped at 2 points per team and side. '+
    'Weights are hand-set assumptions, not validated player values. An absence may already be reflected in season averages; do not use this as a proven betting edge.';
  return state;
 }
 const api={evaluate};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 else root.Unit501AutoInjury=api;
})(typeof globalThis!=='undefined'?globalThis:this);
