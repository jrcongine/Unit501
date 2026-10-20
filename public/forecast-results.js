/* Match archived targets to exact final games; missing player stats stay unknown. */
(function(root){
 'use strict';
 function validPayload(p){return p&&Array.isArray(p.response)&&!(p.errors&&Object.keys(p.errors).length)&&!(p.paging?.total>1);}
 function match(snapshot,games,boxes,now=Date.now()){
  const out=JSON.parse(JSON.stringify(snapshot));
  if(!Number.isFinite(now)||!Number.isFinite(out.game?.kickoff)||now<=out.game.kickoff||!validPayload(games))return {snapshot:out,matched:0};
  const found=games.response.filter(g=>String(g.game?.id)===String(out.game.id));
  if(found.length!==1)return {snapshot:out,matched:0};
  const g=found[0];
  if(String(g.league?.id)!==String(out.game.league)||String(g.league?.season)!==String(out.game.season)||
     String(g.teams?.away?.id)!==String(out.game.awayId)||String(g.teams?.home?.id)!==String(out.game.homeId)||
     Number(g.game?.date?.timestamp)*1000!==out.game.kickoff||!['FT','AOT','FINAL'].includes(g.game?.status?.short))return {snapshot:out,matched:0};
  out.resultEvidence={checkedAt:now,game:JSON.parse(JSON.stringify(g))};
  const stats=typeof module!=='undefined'&&module.exports?require('./player-stats'):root.Unit501PlayerStats;
  const norm=v=>String(v||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  let matched=0;
  for(const r of out.records||[]){
   if(String(r.gameId)!==String(out.game.id)||String(r.league)!==String(out.game.league)||String(r.season)!==String(out.game.season)||r.kickoff!==out.game.kickoff||!(r.forecastAt<r.kickoff))continue;
   const side=String(r.teamId)===String(out.game.awayId)?'away':String(r.teamId)===String(out.game.homeId)?'home':null;
   if(!side)continue;
   let value=null;delete r.resultStat;
   if(r.kind==='score'&&r.market==='points')value=g.scores?.[side]?.total;
   else if(r.kind==='prop'&&validPayload(boxes)&&stats){
    const teams=boxes.response.filter(t=>String(t.team?.id)===String(r.teamId));
    const def=stats.definitions.find(d=>d.key===r.market);
    if(teams.length===1&&def){
     const players=(teams[0].groups||[]).filter(x=>norm(x.name)===def.group).flatMap(x=>x.players||[]).filter(p=>String(p.player?.id)===String(r.playerId));
     if(players.length===1){
      const fields=(players[0].statistics||[]).filter(x=>def.keys.includes(norm(x.name)));
      if(fields.length===1){value=stats.extract(fields,def.group,def.keys);r.resultStat=JSON.parse(JSON.stringify(fields[0]));}
     }
    }
   }
   if(!Number.isFinite(value)||(!(r.market||'').endsWith('Yds')&&value<0))value=null;
   r.actual=value;r.resultKnownAt=value===null?null:now;
   r.resultSource=r.kind==='prop'?'/api/player-stats?game='+encodeURIComponent(r.gameId):'/api/games';
   r.resultGameId=String(r.gameId);
   if(value!==null)matched++;
  }
  return {snapshot:out,matched};
 }
 function automaticDue(s,now){
  if(!Number.isFinite(s.game?.kickoff)||s.game.kickoff>=now||
     !(s.records||[]).some(r=>!Number.isFinite(r.actual)))return false;
  const last=s.resultRefreshAttemptAt;
  // Persist retry spacing with the archive so reloading the tab cannot reset it.
  return !Number.isFinite(last)||last>now||now-last>=3600000;
 }
 function autoRefreshDue(archive,lastAttempt,now=Date.now()){
  if(!Number.isFinite(now)||now-lastAttempt<300000)return false;
  return (archive.snapshots||[]).some(s=>automaticDue(s,now));
 }
 async function refresh(storage,request,now=Date.now,{automatic=false}={}){
  const archiver=typeof module!=='undefined'&&module.exports?require('./forecast-archive'):root.Unit501ForecastArchive;
  const archive=archiver.read(storage);
  const cachedGames=new Map(),cachedBoxes=new Map();let matched=0,failed=0;
  for(let i=0;i<archive.snapshots.length;i++){
   const s=archive.snapshots[i];if(!Number.isFinite(s.game?.kickoff)||s.game.kickoff>=now())continue;
   if(automatic&&!automaticDue(s,now()))continue;
   s.resultRefreshAttemptAt=now();
   try{
    const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(s.game.kickoff).map(p=>[p.type,p.value]));
    const query=new URLSearchParams({date:`${parts.year}-${parts.month}-${parts.day}`,league:s.game.league,season:s.game.season});
    const url='/api/games?'+query;
    if(!cachedGames.has(url))cachedGames.set(url,request(url));
    const games=await cachedGames.get(url);
    if(!validPayload(games))throw Error('Invalid final-game response');
    let boxes=null;
    const finals=validPayload(games)?games.response.filter(g=>String(g.game?.id)===String(s.game.id)&&['FT','AOT','FINAL'].includes(g.game?.status?.short)):[];
    if((s.records||[]).some(r=>r.kind==='prop'&&(!automatic||!Number.isFinite(r.actual)))&&finals.length===1){
     const boxUrl='/api/player-stats?game='+encodeURIComponent(s.game.id);
     if(!cachedBoxes.has(boxUrl))cachedBoxes.set(boxUrl,request(boxUrl));
     boxes=await cachedBoxes.get(boxUrl);
     if(!validPayload(boxes))throw Error('Invalid box-score response');
    }
    const result=match(s,games,boxes,now());if(automatic){
     // Keep settled records and their original evidence when another record is missing.
     result.snapshot.records=result.snapshot.records.map((r,index)=>Number.isFinite(s.records[index].actual)?s.records[index]:r);
     result.matched=result.snapshot.records.filter((r,index)=>!Number.isFinite(s.records[index].actual)&&Number.isFinite(r.actual)).length;
    }
    archive.snapshots[i]=result.snapshot;matched+=result.matched;
   }catch{failed++;}
  }
  // Re-read after network awaits so forecasts saved during refresh survive.
  const latest=archiver.read(storage);
  const identity=s=>JSON.stringify([s.game.league,s.game.season,s.game.id,s.kind||'score',s.records?.[0]?.teamId,s.records?.[0]?.playerId,s.records?.[0]?.market,s.forecastAt,s.selection?.market||'forecast'].map(String));
  const updates=new Map(archive.snapshots.map(s=>[identity(s),s]));
  latest.snapshots=latest.snapshots.map(s=>updates.get(identity(s))||s);
  storage.setItem(archiver.key,JSON.stringify(latest));
  if(root.document&&typeof root.Event==='function')root.document.dispatchEvent(new root.Event('unit501:archive-updated'));
  return {matched,failed};
 }
 const api={match,refresh,autoRefreshDue};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.Unit501ForecastResults=api;
})(typeof globalThis!=='undefined'?globalThis:this);
