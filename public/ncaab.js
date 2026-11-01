(function(){
 'use strict';
 const $=id=>document.getElementById(id),date=$('ncaab-date'),load=$('ncaab-load'),status=$('ncaab-status'),list=$('ncaab-games'),lab=$('ncaab-lab'),teams=$('ncaab-teams'),scope=$('ncaab-scope');
 const central=at=>new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(at))+' CT';
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(x=>[x.type,x.value]));date.value=parts.year+'-'+parts.month+'-'+parts.day;
 const node=(tag,text,cls)=>{const n=document.createElement(tag);n.textContent=String(text);if(cls)n.className=cls;return n;};
 let comparisonHistory=null,propRows=[],propExpiry=null,recordExpiry=null;const playerScenarios=new Map(),injuryScenarios=new Map();
 let contextTimer=null,contextRequest=0,teamPlayerHistory=null;
 let games=[],selected=null,context=null,serial=0,injuryData=null,injuryPromise=null,injuryTimer=null,injuryRequest=0,injuryLoading=false;
 let lineQuotes=null,lineExpiry=null,lineRequest=0,lineLoading=false,lineError=null;const manualLines=new Set();const historyComparison=window.Unit501BasketballHistoryComparison?.create('ncaab-history-comparison',true);
 async function api(kind,game){const q=new URLSearchParams({date:date.value,game:game.id}),r=await fetch('/api/ncaab/'+kind+'?'+q,{signal:AbortSignal.timeout(kind==='player-history'?120000:30000)}),data=await r.json();if(!r.ok)throw Error(data.error||'Data source unavailable for this matchup.');if(data.gameId!==game.id||data.tipoff!==game.tipoff)throw Error('Response does not match the selected game.');return data;}
 async function loadExtras(game,task){
  clearTimeout(injuryTimer);injuryRequest++;injuryLoading=false;
  $('ncaab-load-props').disabled=false;
  $('ncaab-line-history').textContent='No verified FanDuel observations yet.';
  $('ncaab-odds-status').textContent='Checking FanDuel game lines…';$('ncaab-injury-status').textContent='Checking player availability…';$('ncaab-injuries').replaceChildren();$('ncaab-props').replaceChildren();$('ncaab-props-status').textContent='Load props for the selected game.';injuryData=null;teamPlayerHistory=null;
  if(!game.timeKnown||game.status!=='Scheduled'||Date.parse(game.tipoff)<=Date.now()){injuryPromise=null;$('ncaab-refresh-lines').disabled=true;$('ncaab-odds-status').textContent='Pregame lines unavailable.';$('ncaab-injury-status').textContent='Current injury report unavailable for this game.';return;}
  loadLines(game,task);
  loadInjuries(game,task);
 }
 function resetLines(){clearTimeout(lineExpiry);lineQuotes=null;lineLoading=false;lineError=null;lineRequest++;manualLines.clear();$('ncaab-refresh-lines').disabled=false;}
 function validLine(kind,q){
  if(!selected?.timeKnown||selected.status!=='Scheduled'||Date.parse(selected.tipoff)<=Date.now()||!q||!Number.isFinite(q.updatedAt)||q.updatedAt>Date.now()+60000||Date.now()-q.updatedAt>1800000)return false;
  if(kind==='spread')return Number.isFinite(q.away)&&Number.isFinite(q.home)&&Math.abs(q.away+q.home)<1e-9;
  if(kind==='total')return Number.isFinite(q.line)&&q.line>0;
  return [q.away,q.home].every(n=>Number.isInteger(n)&&Math.abs(n)>=100);
 }
 function syncLines(){
  clearTimeout(lineExpiry);const fresh=Object.fromEntries(['spread','total','moneyline'].map(k=>[k,validLine(k,lineQuotes?.[k])?lineQuotes[k]:null]));
  for(const kind of ['spread','total'])if(!manualLines.has(kind))$('ncaab-'+kind).value=fresh[kind]?(kind==='spread'?fresh[kind].away:fresh[kind].line):'';
  const message=lineLoading?'Checking FanDuel game lines…':lineError||[Object.values(fresh).some(Boolean)?'FanDuel · current quotes':'No fresh FanDuel game lines. Refresh lines or enter them manually.',fresh.moneyline?selected.away+' '+(fresh.moneyline.away>0?'+':'')+fresh.moneyline.away+' / '+selected.home+' '+(fresh.moneyline.home>0?'+':'')+fresh.moneyline.home:null,!fresh.spread?'Spread unavailable.':null,!fresh.total?'Total unavailable.':null].filter(Boolean).join(' ');
  $('ncaab-odds-status').textContent=message;
  const movement=['spread','total'].filter(k=>fresh[k]).map(kind=>{const m=window.Unit501MarketPulse.movement(kind,lineQuotes?.history?.[kind],selected.away,selected.home);return m.label+': '+m.text;});
  $('ncaab-line-history').textContent=movement.length?movement.join(' · ')+' · '+(lineQuotes?.tracking?.message||'')+' · First observed, not the sportsbook opening line.':'No verified FanDuel observations yet for current lines.';
  const stamps=Object.values(fresh).filter(Boolean).map(q=>q.updatedAt);
  if(stamps.length){$('ncaab-odds-status').textContent+=' · Oldest quote '+central(Math.min(...stamps));const deadline=Math.min(Date.parse(selected.tipoff),...stamps.map(t=>t+1800001));lineExpiry=setTimeout(render,Math.max(1,deadline-Date.now()));}
  const active=['spread','total'].filter(k=>String($('ncaab-'+k).value).trim()!=='');
  return active.length&&active.every(k=>!manualLines.has(k)&&fresh[k])?'FanDuel':active.some(k=>!manualLines.has(k)&&fresh[k])?'FanDuel + entered lines':'Entered lines';
 }
 async function loadLines(game,task){
  const request=++lineRequest;lineQuotes=null;lineError=null;lineLoading=true;$('ncaab-refresh-lines').disabled=true;render();
  try{const d=await api('odds',game);if(task!==serial||request!==lineRequest)return;if(d.bookmaker!=='FanDuel')throw Error('FanDuel source could not be verified.');lineQuotes=d;}
  catch(error){if(task!==serial||request!==lineRequest)return;lineError=error.message||'FanDuel lines unavailable. Enter them manually.';}
  finally{if(task===serial&&request===lineRequest){lineLoading=false;$('ncaab-refresh-lines').disabled=false;render();}}
 }
 $('ncaab-refresh-lines').addEventListener('click',()=>{if(selected?.timeKnown&&selected.status==='Scheduled'&&Date.parse(selected.tipoff)>Date.now())return loadLines(selected,serial);});
 for(const kind of ['spread','total'])$('ncaab-'+kind).addEventListener('input',()=>{manualLines.add(kind);render();});
 function loadInjuries(game,task){
  if(injuryLoading)return injuryPromise;
  clearTimeout(injuryTimer);const token=++injuryRequest;injuryLoading=true;
  const current=()=>task===serial&&token===injuryRequest&&selected===game;
  injuryPromise=api('injuries',game).then(d=>{
   if(!current())return;
   if(!Number.isFinite(d.checkedAt)||d.checkedAt>Date.now()+60000||Date.now()-d.checkedAt>900000||!Array.isArray(d.teams)||d.teams.length!==2||d.teams.some(t=>!Array.isArray(t.players)||t.players.some(p=>typeof p.name!=='string'||!p.name.trim()||typeof p.status!=='string'||!p.status.trim())))throw Error('Invalid availability report');
   injuryData=d;render();
   if(d.teams.some(t=>t.players?.some(p=>/^out$/i.test(p.status))))api('player-history',game).then(h=>{if(current()){teamPlayerHistory=h;render();}}).catch(()=>{if(current()){teamPlayerHistory=null;render();}});
   $('ncaab-injuries').replaceChildren();$('ncaab-injury-status').textContent=(d.source||'ESPN game report')+' · checked '+central(d.checkedAt);
   for(const team of d.teams){const card=node('section','','nba-team-history');card.append(node('h4',team.team));
    if(team.available===false)card.append(node('p',team.message||'Team injury report unavailable; player availability is unconfirmed.','nba-injury-out'));
    if(!team.players.length)card.append(node('p','No player reports returned; availability is unconfirmed.'));
    for(const p of team.players)card.append(node('p',p.name+' · '+p.status+(p.detail?' · '+p.detail:'')));$('ncaab-injuries').append(card);
   }
  }).catch(()=>{if(current())$('ncaab-injury-status').textContent='Injury report unavailable; any displayed report is from the earlier check. Player availability is unconfirmed.';}).finally(()=>{
   if(!current())return;injuryLoading=false;renderProps();render();
   const tipoff=Date.parse(game.tipoff),expiry=injuryData?.checkedAt+900001;
   const delay=Math.min(tipoff-Date.now(),Number.isFinite(expiry)&&expiry>Date.now()?expiry-Date.now():60000);
   if(delay>0)injuryTimer=setTimeout(()=>{
    if(!current())return;
    $('ncaab-injury-status').textContent='Earlier injury report expired; player availability is unconfirmed.';renderProps();render();
    if(Date.parse(game.tipoff)>Date.now()){
     if(document.hidden){const retry=()=>{if(!current()||Date.parse(game.tipoff)<=Date.now())return;if(document.hidden)injuryTimer=setTimeout(retry,60000);else loadInjuries(game,task);};injuryTimer=setTimeout(retry,60000);}
     else loadInjuries(game,task);
    }
   },delay);
  });
  return injuryPromise;
 }

 function teamProjection(){return window.Unit501BasketballInjuryModel.apply(window.Unit501NCAABModel.project(selected,context,scope.value),selected,context,teamPlayerHistory,injuryData,scope.value,Date.now(),true);}
 function render(){
  window.Unit501SharedUI.resultTiles('ncaab',null);
  const lineSource=syncLines();
  window.Unit501SharedUI.showMarketComparison($('ncaab-market-gap'),null);
  teams.replaceChildren();$('ncaab-simulation').textContent='';
  if(!selected||!context){$('ncaab-prediction').textContent='Team history unavailable.';return;}
  if(!window.Unit501SharedUI.historyFreshness(context.checkedAt).fresh){$('ncaab-prediction').textContent='Team history is stale or its update time is unverified. Refresh team history.';$('ncaab-context-status').textContent=$('ncaab-prediction').textContent;return;}
  for(const side of [context.away,context.home]){
   const card=node('section','','nba-team-history'),r=side[scope.value];card.append(node('h4',side.name));
   if(side.conflicts||side.unverifiedGames)card.append(node('p','History incomplete · '+(side.unverifiedGames||0)+' unverified · '+(side.conflicts||0)+' conflicting game(s). Estimates withheld.','nba-injury-out'));
   card.append(node('p',r?`${r.games} recorded games · ${r.wins}–${r.losses} · ${r.scored.toFixed(1)} scored · ${r.allowed.toFixed(1)} allowed`:'No completed games in this view.'));
   if(!side.conflicts&&!side.unverifiedGames&&side.recentGames?.length){const day=value=>{const d=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(value)).map(x=>[x.type,x.value]));return Date.UTC(+d.year,+d.month-1,+d.day);};const days=Math.max(0,Math.round((day(selected.tipoff)-day(side.recentGames[0].tipoff))/86400000)-1);card.append(node('p',`${days} full day(s) off since last recorded game`));}
   const last=side.recentGames||[];if(last.length){const detail=node('details',''),title=node('summary','Last '+Math.min(5,last.length)+' results');detail.append(title);for(const g of last.slice(0,5))detail.append(node('p',`${g.scored>g.allowed?'W':'L'} · ${g.venue==='away'?'at ':g.venue==='neutral'?'neutral vs ':'vs '}${g.opponent} · ${g.scored}–${g.allowed}`));card.append(detail);}
   teams.append(card);
  }
  const p=teamProjection();
  const value=id=>String($(id).value).trim()===''?null:Number($(id).value);
  window.Unit501SharedUI.showMarketComparison($('ncaab-market-gap'),p,{awaySpread:value('ncaab-spread'),total:value('ncaab-total')},lineSource);
  $('ncaab-prediction').textContent=p.available?`${selected.away} ${p.away.toFixed(1)} · ${selected.home} ${p.home.toFixed(1)} | Total ${p.total.toFixed(1)} (${p.awayGames}/${p.homeGames} games)` :p.reason;
  window.Unit501SharedUI.resultTiles('ncaab',p);
  if(p.available)$('ncaab-prediction').textContent+=' · '+window.Unit501BasketballInjuryModel.describe(p);
 }
 async function choose(game){
  window.Unit501Hook?.select(game.timeKnown&&game.status==='Scheduled'?{league:'ncaab',game:game.id,away:game.away,home:game.home,kickoff:Date.parse(game.tipoff)}:null);
  resetLines();
  window.Unit501SharedUI.showMarketComparison($('ncaab-market-gap'),null);const task=++serial;propRows=[];comparisonHistory=null;historyComparison?.update(null,null);playerScenarios.clear();injuryScenarios.clear();clearTimeout(propExpiry);$('ncaab-prop-player').value='';selected=game;context=null;scope.value='season';$('ncaab-spread').value='';$('ncaab-total').value='';lab.classList.remove('hidden');$('ncaab-player-lab').classList.remove('hidden');window.Unit501SharedUI.resultTiles('ncaab',null);$('ncaab-matchup').textContent=game.away+' at '+game.home;
  $('ncaab-game-info').textContent=(game.timeKnown?central(game.tipoff):'Tipoff TBD')+' · '+game.status+(game.neutral?' · Neutral site':'')+(game.status==='Final'||game.status==='Live'?` · ${game.awayScore??'—'}–${game.homeScore??'—'}`:'');
  teams.replaceChildren();$('ncaab-simulation').textContent='';$('ncaab-prediction').textContent='Team history unavailable.';loadExtras(game,task);
  return loadContext(game,task);
 }
 async function loadContext(game,task=serial){
  const token=++contextRequest;clearTimeout(contextTimer);context=null;render();
  if(!game.timeKnown){$('ncaab-context-status').textContent='Tipoff time is not confirmed. Check again when it is announced.';return;}
  if(game.stage!==2){$('ncaab-context-status').textContent='Team comparisons currently support regular-season games.';return;}
  $('ncaab-context-status').textContent='Loading team history…';
  try{const q=new URLSearchParams({date:date.value,game:game.id}),r=await fetch('/api/ncaab/context?'+q,{signal:AbortSignal.timeout(30000)}),data=await r.json();if(task!==serial||token!==contextRequest)return;
   if(!r.ok||data.gameId!==game.id||data.tipoff!==game.tipoff)throw Error();context=data;const freshness=window.Unit501SharedUI.historyFreshness(data.checkedAt);
   $('ncaab-context-status').textContent='Completed games before this matchup · '+data.source+(freshness.fresh?' · Checked '+central(freshness.at):'');render();
   if(freshness.fresh){const expiry=Math.min(freshness.expiresAt,Date.parse(game.tipoff)>Date.now()?Date.parse(game.tipoff):Infinity);contextTimer=setTimeout(()=>{if(task===serial&&token===contextRequest)render();},Math.max(1,expiry-Date.now()));}
  }catch{if(task!==serial||token!==contextRequest)return;$('ncaab-context-status').textContent='Team history unavailable. Try again shortly.';}
 }
 $('ncaab-refresh-context').addEventListener('click',()=>{if(selected)return loadContext(selected);});
 load.addEventListener('click',async()=>{
  window.Unit501Hook?.select(null);
  window.Unit501Worth?.clear();
  resetLines();
  window.Unit501SharedUI.showMarketComparison($('ncaab-market-gap'),null);const task=++serial;propRows=[];comparisonHistory=null;historyComparison?.update(null,null);playerScenarios.clear();injuryScenarios.clear();clearTimeout(propExpiry);clearTimeout(recordExpiry);$('ncaab-props').replaceChildren();selected=null;context=null;games=[];lab.classList.add('hidden');$('ncaab-player-lab').classList.add('hidden');window.Unit501SharedUI.resultTiles('ncaab',null);list.replaceChildren();load.disabled=true;status.textContent='Loading college basketball slate…';
  try{const r=await fetch('/api/ncaab/games?'+new URLSearchParams({date:date.value}),{signal:AbortSignal.timeout(30000)}),data=await r.json();if(task!==serial)return;if(!r.ok||!Array.isArray(data.games))throw Error();games=data.games;status.textContent=games.length?`${games.length} games · ${data.source}`:'No games found for this date.';
   for(const game of games){const button=node('button','','ncaab-game-card');button.type='button';button.append(window.Unit501SharedUI.matchupHeading(game.away,game.home,game.awayLogo,game.homeLogo,document),node('p',`${game.timeKnown?central(game.tipoff):'Tipoff TBD'} · ${game.status}`));const action=node('span','Open Game Lab →','open-game');button.append(action);button.setAttribute('aria-pressed','false');button.addEventListener('click',()=>{for(const card of list.children)card.setAttribute('aria-pressed',card===button?'true':'false');return choose(game);});
    const record=node('small','','game-records');record.hidden=true;
    const current=Number.isFinite(data.checkedAt)&&data.checkedAt<=Date.now()+60000&&Date.now()-data.checkedAt<=3600000&&game.stage===2&&game.status==='Scheduled'&&game.timeKnown&&Date.parse(game.tipoff)>Date.now();
    const valid=value=>typeof value==='string'&&/^\d{1,3}-\d{1,3}$/.test(value);
    if(current&&(valid(game.awayRecord)||valid(game.homeRecord))){record.textContent='Season · '+game.away+' '+(valid(game.awayRecord)?game.awayRecord:'unavailable')+' · '+game.home+' '+(valid(game.homeRecord)?game.homeRecord:'unavailable');record.title='ESPN overall records · checked '+central(data.checkedAt);record.hidden=false;}
    button.append(record);list.append(button);}
   window.Unit501Worth?.load('ncaab',games.map((g,i)=>({away:g.away,home:g.home,id:g.id,kickoff:Date.parse(g.tipoff),scheduled:g.timeKnown&&g.status==='Scheduled',card:list.children[i]})));
   const expiry=Math.min(data.checkedAt+3600001,...games.filter(g=>g.timeKnown&&g.status==='Scheduled'&&Date.parse(g.tipoff)>Date.now()).map(g=>Date.parse(g.tipoff)));
   if(Number.isFinite(expiry)&&expiry>Date.now())recordExpiry=setTimeout(()=>{for(const card of list.children)for(const child of card.children)if(child.className==='game-records'){child.textContent='';child.hidden=true;}},expiry-Date.now());
  }catch{if(task===serial)status.textContent='College basketball slate unavailable. Check the date and try again.';}finally{if(task===serial)load.disabled=false;}
 });
 date.addEventListener('change',()=>load.click());
 $('ncaab-load-props').addEventListener('click',async()=>{const game=selected,task=serial;if(!game)return;if(game.timeKnown&&game.status==='Scheduled'&&Date.parse(game.tipoff)>Date.now()&&(!injuryData||Date.now()-injuryData.checkedAt>900000))loadInjuries(game,task);const button=$('ncaab-load-props');button.disabled=true;$('ncaab-props').replaceChildren();$('ncaab-props-status').textContent='Loading FanDuel props and recent player history…';
  try{const [quotes,history]=await Promise.all([api('props',game).then(q=>{if(!Array.isArray(q.props))throw Error('Player lines unavailable: invalid provider response.');return q;}).catch(error=>({props:[],message:error.message||'Player lines unavailable.'})),api('player-history',game).then(h=>Array.isArray(h.teams)&&h.teams.length===2&&h.teams.every(t=>typeof t.available==='boolean'&&Array.isArray(t.players))?h:null).catch(()=>null),injuryPromise||Promise.resolve()]);if(task!==serial)return;$('ncaab-props-status').textContent=quotes.message+(quotes.audit?' '+quotes.audit.quotesReceived+' quote candidates received; '+quotes.audit.accepted+' accepted; '+quotes.audit.rejected+' rejected ('+Object.entries(quotes.audit.reasons).map(([k,v])=>k+': '+v).join(', ')+').':'')+(history?' · '+history.teams.reduce((n,t)=>n+(t.verification?.verified||0),0)+' player-game records checked against NCAA official statistics.':'');const rows=[];
   for(const q of window.Unit501NBAPlayerModel.catalogRows(quotes.props,history,game))rows.push({q,history});
   comparisonHistory=history;propRows=rows;const player=$('ncaab-prop-player'),previous=player.value;player.replaceChildren();const all=node('option','All players');all.value='';player.append(all);
   for(const name of [...new Set(rows.map(r=>r.q.name))].sort()){const option=node('option',name);option.value=name;player.append(option);}player.value=rows.some(r=>r.q.name===previous)?previous:'';
   renderProps();

  }catch(error){if(task===serial)$('ncaab-props-status').textContent=error.message||'Player props unavailable. Try again later.';}finally{if(task===serial)button.disabled=false;}
 });
 function renderProps(){
  historyComparison?.update(comparisonHistory,selected);clearTimeout(propExpiry);const board=$('ncaab-props');board.replaceChildren();if(!selected)return;
  const player=$('ncaab-prop-player').value,sort=$('ncaab-prop-sort').value,catalog=['player_points','player_rebounds','player_assists','player_threes'];
  const fresh=r=>Number.isFinite(r.q.updatedAt)&&r.q.updatedAt<=Date.now()+60000&&Date.now()-r.q.updatedAt<=1800000&&Date.parse(selected.tipoff)>Date.now();
  const rows=propRows.filter(r=>fresh(r)&&(!player||r.q.name===player)).map(r=>{
   const status=window.Unit501NBAPlayerModel.injuryStatus(injuryData,r.q,selected,Date.now(),false);
   const staleInjuries=injuryData&&(!Number.isFinite(injuryData.checkedAt)||injuryData.checkedAt>Date.now()+60000||Date.now()-injuryData.checkedAt>900000);
   const splits=window.Unit501NBARotationContext?.compare(r.history,r.q,injuryData,selected,Date.now(),{official:false})||[];
   let scenario=injuryScenarios.get(r.q.name);
   if(scenario&&(status==='Out'||!(window.Unit501NBARotationContext?.compare(r.history,scenario.quote,injuryData,selected,Date.now(),{official:false})||[]).some(s=>JSON.stringify(s)===scenario.evidence))){injuryScenarios.delete(r.q.name);scenario=null;}
   const prediction=staleInjuries?{available:false,reason:'Refresh availability'}:window.Unit501NBAPlayerModel.project(r.history,r.q,selected,status,Date.now(),{regulationMinutes:40,minutes:scenario?.minutes,allowUnpriced:true});
   return {...r,status,splits,scenario,p:window.Unit501NBAPlayerModel.withScenario?.(prediction,playerScenarios.get(r.q.name))||prediction};
  });
  rows.sort((a,b)=>{
   const order=()=>a.q.name.localeCompare(b.q.name)||catalog.indexOf(a.q.market)-catalog.indexOf(b.q.market);
   if(player||sort==='name')return order();
   if(a.p.available!==b.p.available)return a.p.available?-1:1;
   if(!a.p.available)return order();
   if(a.q.unpriced!==b.q.unpriced)return a.q.unpriced?1:-1;
   if(a.q.unpriced)return order();
   if(sort==='most'||sort==='least'){const field=sort==='most'?'above':'below';return b.p[field]*a.p.games-a.p[field]*b.p.games||b.p.games-a.p.games||order();}
   return Math.abs(b.p.projection-b.q.line)-Math.abs(a.p.projection-a.q.line)||order();
  });
  board.setAttribute('data-displayed-lines',String(rows.filter(r=>Number.isFinite(r.q.line)).length));board.append(node('p',rows.filter(r=>Number.isFinite(r.q.line)).length+' betting lines · '+rows.length+' player/stat rows displayed; history-only rows have no betting line.'));
  if(!rows.length){board.append(node('p','No current player quotes match this view. Reload props for current lines.'));return;}
  const table=node('table','','nba-form-table'),head=node('thead',''),tr=node('tr','');
  for(const label of ['Player / stat','FanDuel line','Projection','Last vs opponent','Median','Difference','Recent / workload','Above','Below','Push','Games','Movement'])tr.append(node('th',label));head.append(tr);table.append(head);const body=node('tbody','');
  for(const {q,p,status,splits,scenario,history} of rows){const tr=node('tr','');
   const observed=window.Unit501LineWatch?.fromServer(q.history,q.line,q.updatedAt);
   const movement=q.unpriced?'No betting line':observed?window.Unit501LineWatch.describe(observed):'Movement unknown';
   const pct=field=>p.available&&Number.isFinite(q.line)?p[field]+' ('+(100*p[field]/p.games).toFixed(1)+'%)':'—';
   const values=[q.name+' · '+q.label+' · '+(status||'Availability unconfirmed'),q.line??'Line unavailable',p.available?p.projection.toFixed(1):p.reason||'Unavailable',window.Unit501LastOpponent.basketball(history,q,selected),p.available?p.median.toFixed(1):'—',p.available&&Number.isFinite(q.line)?(p.projection-q.line).toFixed(1):'—',p.available?p.recentValues.join(' · ')+(Number.isFinite(p.projectedMinutes)?' · '+p.projectedMinutes.toFixed(1)+' projected min':' · minutes unavailable')+(p.thin?' · small sample':''):'History incomplete or unavailable',pct('above'),pct('below'),pct('equal'),p.available?p.games:'—',movement];
   for(const [index,value] of values.entries()){
    const cell=node('td',value);
    if(index===3)cell.className='last-opponent-stat';
        if(index===0){const change=window.Unit501NBAPlayerModel.minuteChangeText?.(p);if(change)cell.append(node('strong',change,'nba-minutes-trend'));}
    if(index===2&&p.available){
     cell.append(node('small',window.Unit501NBAPlayerModel.availabilityNote(status)));
     for(const split of splits){
      cell.append(node('small',`${split.name} didn't play: ${split.without.value.toFixed(1)} in ${split.without.games} games (${split.without.minutes.toFixed(1)} min) · played: ${split.with.value.toFixed(1)} in ${split.with.games} (${split.with.minutes.toFixed(1)} min). Past games only; DNP reasons may differ.`));
      if(p.projectedMinutes!==null&&split.without.minutes>=1&&split.without.minutes<=40){
       const button=node('button',`Try ${split.without.minutes.toFixed(1)} minutes without ${split.name}`);button.type='button';
       button.addEventListener('click',()=>{
        const row=propRows.find(r=>r.q===q),current=window.Unit501NBARotationContext?.compare(row?.history,q,injuryData,selected,Date.now(),{official:false})||[];
        if(current.some(s=>JSON.stringify(s)===JSON.stringify(split)))injuryScenarios.set(q.name,{minutes:split.without.minutes,evidence:JSON.stringify(split),quote:q});renderProps();
       });cell.append(button);
      }
     }
     if(scenario){
      cell.append(node('small','Teammate absence minutes scenario · uses overall stat rate; not a confirmed rotation.'));
      const reset=node('button','Reset minutes');reset.type='button';reset.addEventListener('click',()=>{injuryScenarios.delete(q.name);renderProps();});cell.append(reset);
     }
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
  if(!selected||!context)return;render();if(!window.Unit501SharedUI.historyFreshness(context.checkedAt).fresh)return;syncLines();const p=teamProjection();
  const optional=id=>{const value=$(id).value.trim();return value===''?null:Number(value);};
  const sim=window.Unit501NCAABModel.simulate(p,context,{spread:optional('ncaab-spread'),total:optional('ncaab-total')});
  window.Unit501SharedUI.resultTiles('ncaab',p,sim.available?{cover:sim.awayCover,over:sim.over,win:sim.awayWin}:{});
  if(!sim.available){$('ncaab-simulation').textContent=sim.reason;return;}
  const pct=n=>(n*100).toFixed(1)+'%';let out=`${selected.away} win ${pct(sim.awayWin)} · ${selected.home} win ${pct(sim.homeWin)} · tie ${pct(sim.tie)}`;
  if(sim.awayCover!==null)out+=` · away cover ${pct(sim.awayCover)} · spread push ${pct(sim.spreadPush)}`;
  if(sim.over!==null)out+=` · over ${pct(sim.over)} · total push ${pct(sim.totalPush)}`;
  $('ncaab-simulation').textContent='Experimental simulation · not calibrated: '+out;
 });
})();
