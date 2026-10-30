(function(){
 'use strict';
 const $=id=>document.getElementById(id),date=$('ncaab-date'),load=$('ncaab-load'),status=$('ncaab-status'),list=$('ncaab-games'),lab=$('ncaab-lab'),teams=$('ncaab-teams'),scope=$('ncaab-scope');
 const central=at=>new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(at))+' CT';
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(x=>[x.type,x.value]));date.value=parts.year+'-'+parts.month+'-'+parts.day;
 const node=(tag,text,cls)=>{const n=document.createElement(tag);n.textContent=String(text);if(cls)n.className=cls;return n;};
 let propRows=[],propExpiry=null,recordExpiry=null;const playerScenarios=new Map();
 let games=[],selected=null,context=null,serial=0,injuryData=null,injuryPromise=null;
 async function api(kind,game){const q=new URLSearchParams({date:date.value,game:game.id}),r=await fetch('/api/ncaab/'+kind+'?'+q,{signal:AbortSignal.timeout(kind==='player-history'?120000:30000)}),data=await r.json();if(!r.ok)throw Error(data.error||'Data source unavailable for this matchup.');if(data.gameId!==game.id||data.tipoff!==game.tipoff)throw Error('Response does not match the selected game.');return data;}
 async function loadExtras(game,task){
  $('ncaab-load-props').disabled=false;
  $('ncaab-line-history').textContent='No verified FanDuel observations yet.';
  $('ncaab-odds-status').textContent='Checking FanDuel game lines…';$('ncaab-injury-status').textContent='Checking player availability…';$('ncaab-injuries').replaceChildren();$('ncaab-props').replaceChildren();$('ncaab-props-status').textContent='Load props for the selected game.';injuryData=null;
  if(!game.timeKnown||game.status!=='Scheduled'||Date.parse(game.tipoff)<=Date.now()){injuryPromise=null;$('ncaab-odds-status').textContent='Pregame lines unavailable.';$('ncaab-injury-status').textContent='Current injury report unavailable for this game.';return;}
  api('odds',game).then(d=>{if(task!==serial)return; if(d.spread&&!$('ncaab-spread').value)$('ncaab-spread').value=d.spread.away;if(d.total&&!$('ncaab-total').value)$('ncaab-total').value=d.total.line;$('ncaab-odds-status').textContent=[d.message,d.moneyline?game.away+' '+(d.moneyline.away>0?'+':'')+d.moneyline.away+' / '+game.home+' '+(d.moneyline.home>0?'+':'')+d.moneyline.home:null,!d.spread?'Spread unavailable.':null,!d.total?'Total unavailable.':null].filter(Boolean).join(' ');$('ncaab-line-history').textContent=['spread','total'].map(kind=>{const m=window.Unit501MarketPulse.movement(kind,d.history?.[kind],game.away,game.home);return m.label+': '+m.text;}).join(' · ')+' · '+(d.tracking?.message||'')+' · First observed, not the sportsbook opening line.';render();}).catch(error=>{if(task===serial)$('ncaab-odds-status').textContent=error.message||'FanDuel lines unavailable. Enter them manually.';});
  loadInjuries(game,task);
 }
 for(const id of ['ncaab-spread','ncaab-total'])$(id).addEventListener('input',render);
 function loadInjuries(game,task){
  injuryPromise=api('injuries',game).then(d=>{if(task!==serial)return;if(!Number.isFinite(d.checkedAt)||d.checkedAt>Date.now()+60000||!Array.isArray(d.teams)||d.teams.length!==2||d.teams.some(t=>!Array.isArray(t.players)))throw Error('Invalid availability report');injuryData=d;$('ncaab-injuries').replaceChildren();$('ncaab-injury-status').textContent='ESPN game report · checked '+central(d.checkedAt);for(const team of d.teams){const card=node('section','','nba-team-history');card.append(node('h4',team.team));if(!team.players.length)card.append(node('p','No player reports returned; availability is unconfirmed.'));for(const p of team.players)card.append(node('p',p.name+' · '+p.status+(p.detail?' · '+p.detail:'')));$('ncaab-injuries').append(card);}}).catch(()=>{if(task===serial)$('ncaab-injury-status').textContent='Injury report unavailable; player availability is unconfirmed.';});
 }
 function render(){
  window.Unit501SharedUI.showMarketComparison($('ncaab-market-gap'),null);
  teams.replaceChildren();$('ncaab-simulation').textContent='';
  if(!selected||!context){$('ncaab-prediction').textContent='Team history unavailable.';return;}
  for(const side of [context.away,context.home]){
   const card=node('section','','nba-team-history'),r=side[scope.value];card.append(node('h4',side.name));
   if(side.conflicts||side.unverifiedGames)card.append(node('p','History incomplete · '+(side.unverifiedGames||0)+' unverified · '+(side.conflicts||0)+' conflicting game(s). Estimates withheld.','nba-injury-out'));
   card.append(node('p',r?`${r.games} recorded games · ${r.wins}–${r.losses} · ${r.scored.toFixed(1)} scored · ${r.allowed.toFixed(1)} allowed`:'No completed games in this view.'));
   if(!side.conflicts&&!side.unverifiedGames&&side.recentGames?.length){const day=value=>{const d=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(value)).map(x=>[x.type,x.value]));return Date.UTC(+d.year,+d.month-1,+d.day);};const days=Math.max(0,Math.round((day(selected.tipoff)-day(side.recentGames[0].tipoff))/86400000)-1);card.append(node('p',`${days} full day(s) off since last recorded game`));}
   const last=side.recentGames||[];if(last.length){const detail=node('details',''),title=node('summary','Last '+Math.min(5,last.length)+' results');detail.append(title);for(const g of last.slice(0,5))detail.append(node('p',`${g.scored>g.allowed?'W':'L'} · ${g.venue==='away'?'at ':g.venue==='neutral'?'neutral vs ':'vs '}${g.opponent} · ${g.scored}–${g.allowed}`));card.append(detail);}
   teams.append(card);
  }
  const p=window.Unit501NCAABModel.project(selected,context,scope.value);
  const value=id=>String($(id).value).trim()===''?null:Number($(id).value);
  window.Unit501SharedUI.showMarketComparison($('ncaab-market-gap'),p,{awaySpread:value('ncaab-spread'),total:value('ncaab-total')},'Entered lines');
  $('ncaab-prediction').textContent=p.available?`${selected.away} ${p.away.toFixed(1)} · ${selected.home} ${p.home.toFixed(1)} | Total ${p.total.toFixed(1)} (${p.awayGames}/${p.homeGames} games)` :p.reason;
 }
 async function choose(game){
  window.Unit501SharedUI.showMarketComparison($('ncaab-market-gap'),null);const task=++serial;propRows=[];playerScenarios.clear();clearTimeout(propExpiry);$('ncaab-prop-player').value='';selected=game;context=null;scope.value='season';$('ncaab-spread').value='';$('ncaab-total').value='';lab.classList.remove('hidden');$('ncaab-matchup').textContent=game.away+' at '+game.home;
  $('ncaab-game-info').textContent=(game.timeKnown?central(game.tipoff):'Tipoff TBD')+' · '+game.status+(game.neutral?' · Neutral site':'')+(game.status==='Final'||game.status==='Live'?` · ${game.awayScore??'—'}–${game.homeScore??'—'}`:'');
  teams.replaceChildren();$('ncaab-simulation').textContent='';$('ncaab-prediction').textContent='Team history unavailable.';loadExtras(game,task);
  if(!game.timeKnown){$('ncaab-context-status').textContent='Tipoff time is not confirmed. Check again when it is announced.';return;}
  if(game.stage!==2){$('ncaab-context-status').textContent='Team comparisons currently support regular-season games.';return;}
  $('ncaab-context-status').textContent='Loading team history…';
  try{const q=new URLSearchParams({date:date.value,game:game.id}),r=await fetch('/api/ncaab/context?'+q,{signal:AbortSignal.timeout(30000)}),data=await r.json();if(task!==serial)return;
   if(!r.ok||data.gameId!==game.id||data.tipoff!==game.tipoff)throw Error();context=data;$('ncaab-context-status').textContent='Completed games before this matchup · '+data.source;render();
  }catch{if(task!==serial)return;$('ncaab-context-status').textContent='Team history unavailable. Try again shortly.';}
 }
 load.addEventListener('click',async()=>{
  window.Unit501SharedUI.showMarketComparison($('ncaab-market-gap'),null);const task=++serial;propRows=[];playerScenarios.clear();clearTimeout(propExpiry);clearTimeout(recordExpiry);$('ncaab-props').replaceChildren();selected=null;context=null;games=[];lab.classList.add('hidden');list.replaceChildren();load.disabled=true;status.textContent='Loading college basketball slate…';
  try{const r=await fetch('/api/ncaab/games?'+new URLSearchParams({date:date.value}),{signal:AbortSignal.timeout(30000)}),data=await r.json();if(task!==serial)return;if(!r.ok||!Array.isArray(data.games))throw Error();games=data.games;status.textContent=games.length?`${games.length} games · ${data.source}`:'No games found for this date.';
   for(const game of games){const button=node('button',`${game.away} at ${game.home} · ${game.timeKnown?central(game.tipoff):'TBD'} · ${game.status}`,'ncaab-game-card');button.type='button';button.addEventListener('click',()=>choose(game));
    const record=node('small','','game-records');record.hidden=true;
    const current=Number.isFinite(data.checkedAt)&&data.checkedAt<=Date.now()+60000&&Date.now()-data.checkedAt<=3600000&&game.stage===2&&game.status==='Scheduled'&&game.timeKnown&&Date.parse(game.tipoff)>Date.now();
    const valid=value=>typeof value==='string'&&/^\d{1,3}-\d{1,3}$/.test(value);
    if(current&&(valid(game.awayRecord)||valid(game.homeRecord))){record.textContent='Season · '+game.away+' '+(valid(game.awayRecord)?game.awayRecord:'unavailable')+' · '+game.home+' '+(valid(game.homeRecord)?game.homeRecord:'unavailable');record.title='ESPN overall records · checked '+central(data.checkedAt);record.hidden=false;}
    button.append(record);list.append(button);}
   const expiry=Math.min(data.checkedAt+3600001,...games.filter(g=>g.timeKnown&&g.status==='Scheduled'&&Date.parse(g.tipoff)>Date.now()).map(g=>Date.parse(g.tipoff)));
   if(Number.isFinite(expiry)&&expiry>Date.now())recordExpiry=setTimeout(()=>{for(const card of list.children)for(const child of card.children)if(child.className==='game-records'){child.textContent='';child.hidden=true;}},expiry-Date.now());
  }catch{if(task===serial)status.textContent='College basketball slate unavailable. Check the date and try again.';}finally{if(task===serial)load.disabled=false;}
 });
 $('ncaab-load-props').addEventListener('click',async()=>{const game=selected,task=serial;if(!game)return;if(game.timeKnown&&game.status==='Scheduled'&&Date.parse(game.tipoff)>Date.now()&&injuryData&&Date.now()-injuryData.checkedAt>900000)loadInjuries(game,task);const button=$('ncaab-load-props');button.disabled=true;$('ncaab-props').replaceChildren();$('ncaab-props-status').textContent='Loading FanDuel props and recent player history…';
  try{const [quotes,history]=await Promise.all([api('props',game),api('player-history',game).catch(()=>null),injuryPromise||Promise.resolve()]);if(task!==serial)return;$('ncaab-props-status').textContent=quotes.message+(history?' · '+history.teams.reduce((n,t)=>n+(t.verification?.verified||0),0)+' player-game records checked against NCAA official statistics.':'');const rows=[];
   for(const q of quotes.props)rows.push({q,history});
   propRows=rows;const player=$('ncaab-prop-player'),previous=player.value;player.replaceChildren();const all=node('option','All players');all.value='';player.append(all);
   for(const name of [...new Set(rows.map(r=>r.q.name))].sort()){const option=node('option',name);option.value=name;player.append(option);}player.value=rows.some(r=>r.q.name===previous)?previous:'';
   renderProps();

  }catch(error){if(task===serial)$('ncaab-props-status').textContent=error.message||'Player props unavailable. Try again later.';}finally{if(task===serial)button.disabled=false;}
 });
 function renderProps(){
  clearTimeout(propExpiry);const board=$('ncaab-props');board.replaceChildren();if(!selected)return;
  const player=$('ncaab-prop-player').value,sort=$('ncaab-prop-sort').value,catalog=['player_points','player_rebounds','player_assists','player_threes'];
  const fresh=r=>Number.isFinite(r.q.updatedAt)&&r.q.updatedAt<=Date.now()+60000&&Date.now()-r.q.updatedAt<=1800000&&Date.parse(selected.tipoff)>Date.now();
  const rows=propRows.filter(r=>fresh(r)&&(!player||r.q.name===player)).map(r=>{
   const names=(injuryData?.teams||[]).flatMap(t=>t.players||[]).filter(p=>String(p.name).toLowerCase()===r.q.name.toLowerCase());
   const status=names.length===1&&/^out$/i.test(names[0].status)?'Out':null;
   const staleInjuries=injuryData&&(!Number.isFinite(injuryData.checkedAt)||injuryData.checkedAt>Date.now()+60000||Date.now()-injuryData.checkedAt>900000);
   const prediction=staleInjuries?{available:false,reason:'Refresh availability'}:window.Unit501NBAPlayerModel.project(r.history,r.q,selected,status);
   return {...r,p:window.Unit501NBAPlayerModel.withScenario?.(prediction,playerScenarios.get(r.q.name))||prediction};
  });
  rows.sort((a,b)=>{
   const order=()=>a.q.name.localeCompare(b.q.name)||catalog.indexOf(a.q.market)-catalog.indexOf(b.q.market);
   if(player||sort==='name')return order();
   if(a.p.available!==b.p.available)return a.p.available?-1:1;
   if(!a.p.available)return order();
   if(sort==='most'||sort==='least'){const field=sort==='most'?'above':'below';return b.p[field]*a.p.games-a.p[field]*b.p.games||b.p.games-a.p.games||order();}
   return Math.abs(b.p.projection-b.q.line)-Math.abs(a.p.projection-a.q.line)||order();
  });
  if(!rows.length){board.append(node('p','No current player quotes match this view. Reload props for current lines.'));return;}
  const table=node('table','','nba-form-table'),head=node('thead',''),tr=node('tr','');
  for(const label of ['Player / stat','FanDuel line','Projection','Median','Difference','Recent / workload','Above','Below','Push','Games','Movement'])tr.append(node('th',label));head.append(tr);table.append(head);const body=node('tbody','');
  for(const {q,p} of rows){const tr=node('tr','');
   const observed=window.Unit501LineWatch?.fromServer(q.history,q.line,q.updatedAt);
   const movement=observed?window.Unit501LineWatch.describe(observed):'Movement unknown';
   const pct=field=>p.available?p[field]+' ('+(100*p[field]/p.games).toFixed(1)+'%)':'—';
   const values=[q.name+' · '+q.label,q.line,p.available?p.projection.toFixed(1):p.reason||'Unavailable',p.available?p.median.toFixed(1):'—',p.available?(p.projection-q.line).toFixed(1):'—',p.available?p.recentValues.join(' · ')+(Number.isFinite(p.projectedMinutes)?' · '+p.projectedMinutes.toFixed(1)+' min':'')+(p.thin?' · small sample':''):'History incomplete or unavailable',pct('above'),pct('below'),pct('equal'),p.available?p.games:'—',movement];
   for(const [index,value] of values.entries()){
    const cell=node('td',value);
    if(index===2&&p.available){
     const label=node('label','Manual scenario '),select=node('select');
     for(const [value,text] of [['off','Normal 0%'],['boost','⚡ Star Power +10%'],['dud','⚡ Rivalry Dud −10%'],['fatigue','Fatigue −5%']]){const option=node('option',text);option.value=value;select.append(option);}
     select.value=playerScenarios.get(q.name)||'off';select.addEventListener('change',()=>{playerScenarios.set(q.name,select.value);renderProps();});label.append(select);cell.append(label);
     if(p.scenario?.applied)cell.append(node('small','Manual, uncalibrated · before scenario '+p.scenario.baseline.toFixed(1)));
    }
    tr.append(cell);
   }body.append(tr);
  }
  table.append(body);board.append(table);
  const expiries=[Date.parse(selected.tipoff),...rows.map(r=>r.q.updatedAt+1800001),...rows.map(r=>r.history?.checkedAt+1800001),injuryData?.checkedAt+900001].filter(at=>Number.isFinite(at)&&at>Date.now());
  const next=Math.min(...expiries);propExpiry=setTimeout(renderProps,Math.max(1,next-Date.now()));
 }
 $('ncaab-prop-player').addEventListener('change',renderProps);$('ncaab-prop-sort').addEventListener('change',renderProps);
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
