// Compare explicit reports for the same game, team and player on this device.
(function(root){
 'use strict';
 const clean=v=>String(v??'').trim().toLowerCase().replace(/\s+/g,' ');
 const statuses=new Map(['Out','Doubtful','Questionable','Probable','Available','Active','Game Time Decision','Injured Reserve','Out - (1st Half)'].map(s=>[clean(s),s]));
 function compare(previous,players,at){
  if(previous&&(!Array.isArray(previous.rows)||!Array.isArray(previous.changes)||!Number.isFinite(previous.at)||
    previous.rows.some(row=>!Array.isArray(row)||row.length!==2||!row[1]?.name)||previous.changes.some(c=>!c?.name||!Number.isFinite(c.at))))previous=null;
  const entries=new Map(),duplicates=new Set();
  for(const p of players){
   const name=String(p.name||'').trim(),id=p.id!=null?'id:'+p.id:'name:'+clean(name);
   if(!name)continue;
   if(entries.has(id))duplicates.add(id);
   entries.set(id,{name,status:statuses.get(clean(p.status))});
  }
  const rows=[...entries].filter(([id,p])=>!duplicates.has(id)&&p.status);
  if(previous&&at<=previous.at)return at===previous.at?previous:null;
  const old=new Map(previous?.rows||[]),changes=[];
  for(const [id,p] of rows){
   const before=old.get(id);if(!before||clean(before.name)!==clean(p.name)||before.status===p.status)continue;
   changes.push({id,name:p.name,from:before.status,to:p.status});
  }
  // Keep a change visible through routine refreshes only while the latest
  // report explicitly lists the same current designation.
  for(const change of previous?.changes||[]){
   if(!changes.some(x=>x.id===change.id)&&rows.some(([id,p])=>id===change.id&&p.status===change.to&&clean(p.name)===clean(change.name))&&at-change.at<86400000)changes.push(change);
  }
  return {at,rows,changes:changes.map(c=>({...c,at:c.at??at}))};
 }
 function observations(league,g,report,now){
  if(!g||!report||!Array.isArray(report.teams))return [];
  const football=['1','2'].includes(String(league)),kickoff=football?g.kickoff:Date.parse(g.tipoff);
  if(!Number.isFinite(kickoff)||kickoff<=now||football&&!report.current||!football&&(String(report.gameId)!==String(g.id)||Date.parse(report.tipoff)!==kickoff))return [];
  const observations=[];
  for(const side of ['away','home']){
   const id=String(g[side+'Id']),label=g[side]||g[side==='away'?'a':'h'];
   const matches=report.teams.filter(t=>football?String(t.id)===id:clean(t.name||t.team)===clean(label)&&(t.teamId==null||String(t.teamId)===id));
   if(matches.length!==1)continue;
   const t=matches[0],src=football?t.official:t,at=football?src?.checkedAt:league==='nba'?report.reportAt:report.checkedAt;
   const ttl=league==='nba'?7200000:900000,players=football?src?.rows:src?.players;
   if(src?.available!==true||!Array.isArray(players)||!Number.isFinite(at)||at>now||at+ttl<=now)continue;
   if(football&&(String(src.gameId)!==String(g.id)||src.kickoff!==kickoff||(src.league&&String(src.league)!==String(league))||(src.season&&String(src.season)!==String(g.season))))continue;
   const source=football?(src.source||'official'):league==='nba'?'official NBA':(t.source||'ESPN');
   const key=JSON.stringify([league,g.provider||'',g.id,kickoff,g.awayId,g.homeId,id,source].map(String));
   observations.push({key,at,kickoff,expires:Math.min(kickoff,at+ttl),players:football?players.filter(p=>p.id!=null&&String(p.teamId)===id):players});
  }
  return observations;
 }
 if(typeof module!=='undefined'&&module.exports){module.exports={compare,observations};return;}
 const panel=document.getElementById('injury-changes');
 if(!panel)return;
 const storageKey='unit501-injury-changes-v1';
 let timer,visible=false;
 function clear(){clearTimeout(timer);visible=false;panel.hidden=true;panel.replaceChildren();}
 function show(league,game,report){
  clear();const now=Date.now();let saved;
  try{saved=JSON.parse(localStorage.getItem(storageKey)||'{}');if(!saved||typeof saved!=='object')return false;}catch{return false;}
  const changes=[];let expires=Infinity,dirty=false;
  for(const obs of observations(league,game,report,now)){
   const previous=saved[obs.key],current=compare(previous,obs.players,obs.at);
   if(!current)continue;
   if(current!==previous){saved[obs.key]={...current,kickoff:obs.kickoff};dirty=true;}
   for(const c of current.changes)if(c.at+86400000>now){changes.push(c);expires=Math.min(expires,obs.expires,c.at+86400000);}
  }
  if(dirty)try{localStorage.setItem(storageKey,JSON.stringify(Object.fromEntries(Object.entries(saved).filter(([,v])=>v?.kickoff>now).sort((a,b)=>b[1].at-a[1].at).slice(0,100))));}catch{}
  if(!changes.length)return false;
  changes.sort((a,b)=>b.at-a.at||a.name.localeCompare(b.name));
  const title=document.createElement('strong');title.textContent='Injury report changed';panel.append(title);
  for(const c of changes.slice(0,3)){const line=document.createElement('div');line.textContent=c.name+' · '+c.from+' → '+c.to;panel.append(line);}
  const note=document.createElement('small');note.textContent='Current impact on the score is unverified.';panel.append(note);
  panel.hidden=false;visible=true;timer=setTimeout(clear,Math.max(1,expires-now));return true;
 }
 function impact(game,base,result){
  if(!visible||!base?.available||!result?.available)return;
  const diff=side=>Math.round((result[side]-base[side])*100)/100;
  const away=diff('away'),home=diff('home');if(![away,home].every(Number.isFinite))return;
  const signed=n=>(n>0?'+':'')+String(n);
  panel.lastElementChild.textContent=away||home?'Current combined injury adjustment: '+(game.away||game.a)+' '+signed(away)+' pts · '+(game.home||game.h)+' '+signed(home)+' pts.':'Current model applies no score change.';
 }
 root.Unit501InjuryChanges={show,impact,clear};
})(globalThis);
