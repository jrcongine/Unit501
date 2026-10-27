(function(){
 'use strict';
 const $=id=>document.getElementById(id),date=$('ncaab-date'),load=$('ncaab-load'),status=$('ncaab-status'),list=$('ncaab-games'),lab=$('ncaab-lab'),teams=$('ncaab-teams'),scope=$('ncaab-scope');
 const central=at=>new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(at))+' CT';
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(x=>[x.type,x.value]));date.value=parts.year+'-'+parts.month+'-'+parts.day;
 const node=(tag,text,cls)=>{const n=document.createElement(tag);n.textContent=String(text);if(cls)n.className=cls;return n;};
 let games=[],selected=null,context=null,serial=0;
 function render(){
  teams.replaceChildren();$('ncaab-simulation').textContent='';
  if(!selected||!context){$('ncaab-prediction').textContent='Team history unavailable.';return;}
  for(const side of [context.away,context.home]){
   const card=node('section','','nba-team-history'),r=side[scope.value];card.append(node('h4',side.name));
   card.append(node('p',r?`${r.games} games · ${r.wins}–${r.losses} · ${r.scored.toFixed(1)} scored · ${r.allowed.toFixed(1)} allowed`:'No completed games in this view.'));
   if(side.recentGames?.length){const day=value=>{const d=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(value)).map(x=>[x.type,x.value]));return Date.UTC(+d.year,+d.month-1,+d.day);};const days=Math.max(0,Math.round((day(selected.tipoff)-day(side.recentGames[0].tipoff))/86400000)-1);card.append(node('p',`${days} full day(s) off since last recorded game`));}
   const last=side.recentGames||[];if(last.length){const detail=node('details',''),title=node('summary','Last '+Math.min(5,last.length)+' results');detail.append(title);for(const g of last.slice(0,5))detail.append(node('p',`${g.scored>g.allowed?'W':'L'} · ${g.venue==='away'?'at ':g.venue==='neutral'?'neutral vs ':'vs '}${g.opponent} · ${g.scored}–${g.allowed}`));card.append(detail);}
   teams.append(card);
  }
  const p=window.Unit501NCAABModel.project(selected,context,scope.value);
  $('ncaab-prediction').textContent=p.available?`${selected.away} ${p.away.toFixed(1)} · ${selected.home} ${p.home.toFixed(1)} | Total ${p.total.toFixed(1)} (${p.awayGames}/${p.homeGames} games)` :p.reason;
 }
 async function choose(game){
  const task=++serial;selected=game;context=null;scope.value='season';$('ncaab-spread').value='';$('ncaab-total').value='';lab.classList.remove('hidden');$('ncaab-matchup').textContent=game.away+' at '+game.home;
  $('ncaab-game-info').textContent=(game.timeKnown?central(game.tipoff):'Tipoff TBD')+' · '+game.status+(game.neutral?' · Neutral site':'')+(game.status==='Final'||game.status==='Live'?` · ${game.awayScore??'—'}–${game.homeScore??'—'}`:'');
  teams.replaceChildren();$('ncaab-simulation').textContent='';$('ncaab-prediction').textContent='Team history unavailable.';
  if(!game.timeKnown){$('ncaab-context-status').textContent='Tipoff time is not confirmed. Check again when it is announced.';return;}
  if(game.stage!==2){$('ncaab-context-status').textContent='Team comparisons currently support regular-season games.';return;}
  $('ncaab-context-status').textContent='Loading team history…';
  try{const q=new URLSearchParams({date:date.value,game:game.id}),r=await fetch('/api/ncaab/context?'+q,{signal:AbortSignal.timeout(30000)}),data=await r.json();if(task!==serial)return;
   if(!r.ok||data.gameId!==game.id||data.tipoff!==game.tipoff)throw Error();context=data;$('ncaab-context-status').textContent='Completed games before this matchup · '+data.source;render();
  }catch{if(task!==serial)return;$('ncaab-context-status').textContent='Team history unavailable. Try again shortly.';}
 }
 load.addEventListener('click',async()=>{
  const task=++serial;selected=null;context=null;games=[];lab.classList.add('hidden');list.replaceChildren();load.disabled=true;status.textContent='Loading college basketball slate…';
  try{const r=await fetch('/api/ncaab/games?'+new URLSearchParams({date:date.value}),{signal:AbortSignal.timeout(30000)}),data=await r.json();if(task!==serial)return;if(!r.ok||!Array.isArray(data.games))throw Error();games=data.games;status.textContent=games.length?`${games.length} games · ${data.source}`:'No games found for this date.';
   for(const game of games){const button=node('button',`${game.away} at ${game.home} · ${game.timeKnown?central(game.tipoff):'TBD'} · ${game.status}`,'nba-game-card');button.type='button';button.addEventListener('click',()=>choose(game));list.append(button);}
  }catch{if(task===serial)status.textContent='College basketball slate unavailable. Check the date and try again.';}finally{if(task===serial)load.disabled=false;}
 });
 scope.addEventListener('change',render);
 $('ncaab-sim').addEventListener('click',()=>{
  if(!selected||!context)return;const p=window.Unit501NCAABModel.project(selected,context,scope.value);
  const optional=id=>{const value=$(id).value.trim();return value===''?null:Number(value);};
  const sim=window.Unit501NCAABModel.simulate(p,context,{spread:optional('ncaab-spread'),total:optional('ncaab-total')});
  if(!sim.available){$('ncaab-simulation').textContent=sim.reason;return;}
  const pct=n=>(n*100).toFixed(1)+'%';let out=`${selected.away} win ${pct(sim.awayWin)} · ${selected.home} win ${pct(sim.homeWin)} · tie ${pct(sim.tie)}`;
  if(sim.awayCover!==null)out+=` · away cover ${pct(sim.awayCover)} · spread push ${pct(sim.spreadPush)}`;
  if(sim.over!==null)out+=` · over ${pct(sim.over)} · total push ${pct(sim.totalPush)}`;
  $('ncaab-simulation').textContent=out;
 });
})();
