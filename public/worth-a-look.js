(function(root){
 'use strict';
 const DAY=86400000,HALF_HOUR=1800000;
 const key=(league,row)=>JSON.stringify([league,row.away,row.home,row.kickoff,row.gameId??null]);
 const signed=n=>n>0?'+'+n:String(n);
 function marginReason(before,current){
  for(const n of [3,-3,7,-7]){
   const outcome=line=>line===n?'push':line>n?'cover':'loss';
   if(outcome(before)!==outcome(current))
    return 'A '+Math.abs(n)+'-point '+(n>0?'loss':'win')+' by the away team: '+outcome(before)+' → '+outcome(current)+'.';
  }
  return '';
 }
 function compare(league,rows,games,seen,now){
  const picks=[],updates={};
  for(const r of rows){
   if(!Number.isFinite(r.at)||r.at>now||now-r.at>=HALF_HOUR||!Number.isFinite(r.line)||!Number.isInteger(r.line*2)||r.kickoff<=now)continue;
   const matches=games.filter(g=>g.scheduled&&g.away===r.away&&g.home===r.home&&g.kickoff===r.kickoff&&
     (r.gameId==null||String(r.gameId)===String(g.id)));
   if(matches.length!==1)continue;
   const id=key(league,r),last=seen[id];
   if(last&&r.at<last.at)continue;
   updates[id]={line:r.line,at:r.at,kickoff:r.kickoff};
   const personal=last&&Number.isFinite(last.line)&&now-last.at<DAY;
   const before=personal?last.line:r.previous;
   if(!Number.isFinite(before)||before===r.line)continue;
   const delta=Math.abs(r.line-before);
   const keyMove=['1','2'].includes(league)&&[-7,-3,3,7].some(n=>Math.min(r.line,before)<=n&&Math.max(r.line,before)>=n);
   if(!keyMove&&delta<1)continue;
   picks.push({r,card:matches[0].card,before,personal:Boolean(personal),keyMove,delta});
  }
  picks.sort((a,b)=>Number(b.keyMove)-Number(a.keyMove)||b.delta-a.delta||b.r.at-a.r.at||a.r.kickoff-b.r.kickoff);
  return {picks,updates};
 }
 if(typeof module!=='undefined'&&module.exports){module.exports={compare,marginReason};return;}
 const storageKey='unit501-slate-spreads-v1';let version=0,timer;
 const panel=()=>document.getElementById('worth-a-look');
 function clear(){version++;clearTimeout(timer);if(panel())panel().hidden=true;}
 async function load(league,games){
  clear();const task=version;
  if(!games.length||!panel())return;
  try{
   const response=await fetch('/api/slate-spreads?league='+encodeURIComponent(league),{signal:AbortSignal.timeout(8000)});
   if(!response.ok||task!==version)return;
   const data=await response.json();if(task!==version||!Array.isArray(data.rows))return;
   let seen={};try{seen=JSON.parse(localStorage.getItem(storageKey))||{};}catch{}
   const time=Date.now(),{picks,updates}=compare(league,data.rows,games,seen,time);
   try{
    const keep=Object.entries({...seen,...updates}).filter(([,x])=>x&&x.kickoff>time&&x.at>time-DAY).sort((a,b)=>b[1].at-a[1].at).slice(0,200);
    localStorage.setItem(storageKey,JSON.stringify(Object.fromEntries(keep)));
   }catch{}
   function render(){
    if(task!==version)return;
    const now=Date.now(),active=picks.filter(p=>p.card?.isConnected&&p.r.kickoff>now&&p.r.at+HALF_HOUR>now).slice(0,3);
    const list=document.getElementById('worth-games');list.replaceChildren();panel().hidden=!active.length;
    for(const {r,card,before,personal,keyMove} of active){
     const button=document.createElement('button');button.type='button';
     const title=document.createElement('strong');title.textContent=r.away+' at '+r.home;
     const detail=document.createElement('span');detail.textContent='FanDuel · '+r.away+' '+signed(before)+' → '+signed(r.line)+(personal?' since your previous slate check':' · recorded line move');
     button.append(title,detail);
     if(keyMove){const reason=document.createElement('span');reason.textContent=marginReason(before,r.line);button.append(reason);}
     button.addEventListener('click',()=>{card.click();const lab=document.querySelector('#lab, #nba-lab, #ncaab-lab');lab?.scrollIntoView({block:'start'});});list.append(button);
    }
    if(active.length)timer=setTimeout(render,Math.max(1,Math.min(...active.map(p=>Math.min(p.r.kickoff,p.r.at+HALF_HOUR)))-now));
   }
   render();
  }catch{/* Optional slate summary. Normal game selection stays available. */}
 }
 root.Unit501Worth={clear,load};
})(globalThis);
