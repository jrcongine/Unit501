(()=>{
 'use strict';
 const panel=document.createElement('section');panel.className='card hidden';
 document.getElementById('player-lab').before(panel);
 let version=0,timer;
 const node=(tag,text)=>{const n=document.createElement(tag);n.textContent=text;return n;};
 function reset(){clearTimeout(timer);version++;panel.replaceChildren();panel.classList.toggle('hidden',!selected||selected.league!=='1');if(!selected||selected.league!=='1')return;
  panel.append(node('h2','NFL player production ratings'),node('p','0–99 experimental production ratings, compared with same-position NFL peers. Season production and recent form update the rating. These are not Madden talent grades or betting probabilities. Blocking and detailed coverage are unrated. Ratings do not yet change team scores or automatic injury valuation; props use the separate season/form model.'));
  const button=node('button','Build NFL player ratings');button.type='button';
  const status=node('p','This checks rosters for all 32 teams and completed season player box scores before this matchup. The first build may take several minutes and consumes provider requests; later builds reuse cached data.');status.setAttribute('role','status');
  const results=node('div','');panel.append(button,status,results);
  button.onclick=async()=>{const task=++version,game=selected;button.disabled=true;
   const q=new URLSearchParams({season:game.season,before:game.kickoff});let polls=0;
   async function poll(){try{const r=await fetch('/api/player-ratings?'+q);const d=await r.json();if(task!==version||selected!==game)return;
    if(!r.ok||d.error||d.state==='error')throw new Error(d.error||d.message||'Ratings unavailable.');
    if(d.state!=='ready'){status.textContent=d.total?`Building league player ratings: ${d.completed}/${d.total} roster and game reports checked.`:d.message||'Finding NFL season history…';if(++polls>=1200)throw new Error('Still building. Select the matchup again to check progress.');timer=setTimeout(poll,3000);return;}
    status.textContent='League build complete. Sample labels use the fewest recorded games among rated metrics: Limited (2–4), Developing (5–8), Larger (9+). These describe data quantity, not validated prediction confidence. Ratings use recorded box-score production, not participation or verified starting roles. Missing metrics are omitted; a low score does not establish low talent.';
    for(const [id,name]of [[game.awayId,game.a],[game.homeId,game.h]]){
     results.append(node('h3',name));const table=node('table','');table.style.width='100%';
     const head=node('tr','');for(const text of ['Player','Position','Production','Trend','Sample'])head.append(node('th',text));table.append(head);
     const players=d.data.players.filter(p=>p.teamId===id).sort((a,b)=>(b.rating??-1)-(a.rating??-1)||a.name.localeCompare(b.name));
     for(const p of players){const tr=node('tr','');tr.title=p.reason;
      const count=p.coverage.length?Math.min(...p.coverage.map(c=>c.count)):p.games;
      const sample=count<5?'Limited':count<9?'Developing':'Larger';
      const range=count===p.games?`${count}`:`${count}–${p.games}`;
      for(const text of [p.name,p.position,p.rating===null?'Unrated':`${p.rating}/99`,p.rating===null?'—':p.trend,p.rating===null?p.reason:`${sample} • ${range} recorded games`])tr.append(node('td',text));
      table.append(tr);
     }const scroll=node('div','');scroll.style.overflowX='auto';scroll.append(table);results.append(scroll);
    }button.disabled=false;
   }catch(e){if(task===version){status.textContent=e.message+' Select the matchup again after a minute to retry.';button.disabled=false;}}}
   poll();
  };
 }
 document.addEventListener('unit501:selection-changed',reset);
})();
