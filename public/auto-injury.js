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
 const empty=()=>({awayOffense:0,awayDefense:0,homeOffense:0,homeDefense:0});
 const fresh=(record,age,now)=>record?.available===true&&Number.isFinite(record.checkedAt)&&record.checkedAt<=now&&now-record.checkedAt<=age;
 const matchGame=(r,game)=>r&&String(r.gameId)===String(game.id)&&r.kickoff===game.kickoff&&
   (!r.league||String(r.league)===String(game.league))&&(!r.season||String(r.season)===String(game.season));
 const status=v=>String(v||'').trim().toLowerCase();
 function evaluate(data,game,lineup,now=Date.now()){
  const injury=empty(),applied=[],withheld=[];
  const state={injury,applied,withheld,ready:false,
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
   if(!t||!fresh(String(game.league)==='2'?t.injuryUsage:t.depth,3600000,now)||!matchGame(String(game.league)==='2'?t.injuryUsage:t.depth,game))
    withheld.push(label+': player-role data unavailable, expired, or for a different matchup; no point estimate.');
  }
  if(withheld.length){
   state.message='Automatic injury coverage incomplete for at least one team. No automatic points for either team; keep baseline until both official game reports and player-role data are fresh.';
   return state;
  }
  for(const {teamId,side,label,team:t} of teams){
   const roster=new Map((t.roster.rows||[]).filter(r=>r?.id).map(r=>[String(r.id),r]));
   const outs=(t.official.rows||[]).filter(r=>status(r.status)==='out'&&String(r.teamId)===teamId);
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
    const alternative=other.some(r=>r.date&&Number.isFinite(Date.parse(r.date))&&Date.parse(r.date)<=now&&now-Date.parse(r.date)<=7*86400000&&(!Number.isFinite(t.official.publishedAt)||Date.parse(r.date)>=t.official.publishedAt)&&
      !['out','sidelined','inactive','injured reserve','ir'].includes(status(r.status)));
    if(statuses.some(s=>s!=='out')||alternative){withheld.push(label+': '+name+' has conflicting or conditional reports; no estimate.');continue;}
    const roleRows=String(game.league)==='2'?(t.injuryUsage.rows||[]).map(r=>({...r,rank:1})):(t.depth.rows||[]);
    const slots=roleRows.filter(r=>String(r.id)===id&&String(r.position).toUpperCase()===String(base.position).toUpperCase()&&r.rank===1);
    if(slots.length!==1){withheld.push(label+': '+name+' has no verified starter or recent regular workload; no estimate.');continue;}
    const pos=String(base.position||'').toUpperCase();
    if(pos==='QB'){withheld.push(label+': '+name+' (QB) requires confirmed replacement and passing-workload evidence; no automatic points.');continue;}
    const weight=weights[pos];
    if(!weight){withheld.push(label+': '+name+' ('+pos+') has no supported positional sensitivity assumption.');continue;}
    const lineupProps=lineup?.gameId===String(game.id)&&lineup?.kickoff===game.kickoff?
      lineup.props?.[teamId+':'+id]:null;
    if(lineupProps&&Object.values(lineupProps).some(change=>change?.scale<1)){
      withheld.push(label+': '+name+' already has a lineup scenario; automatic estimate not added.');continue;
    }
    const field=side+(weight[0]==='offense'?'Offense':'Defense');
    const available=Math.max(0,2-injury[field]);
    const points=Math.round(Math.min(weight[1],available)*100)/100;
    if(points<=0){withheld.push(label+': positional sensitivity capped at 2 points for '+weight[0]+'.');continue;}
    injury[field]+=points;
    applied.push({teamId,side,playerId:id,name,position:pos,category:weight[0],points,
      evidence:t.official.url||null});
   }
   if(t.official.unmatched||t.official.unresolved?.length)withheld.push(label+': unmatched official reports need review; no inferred player IDs.');
   if(!outs.length)withheld.push(label+': no confirmed matched top-depth Out entries; this does not establish full health.');
  }
  state.ready=true;
  state.message='Experimental positional injury sensitivity: only fresh, matched official Out reports with starter or recent college workload evidence; capped at 2 points per team and side. '+
    'Weights are hand-set assumptions, not validated player values. An absence may already be reflected in season averages; do not use this as a proven betting edge.';
  return state;
 }
 const api={evaluate};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 else root.Unit501AutoInjury=api;
})(typeof globalThis!=='undefined'?globalThis:this);
