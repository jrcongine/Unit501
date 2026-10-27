/* NBA player lines, recent-game projection baselines and official availability. */
(function(root){
 'use strict';
 const $=id=>document.getElementById(id),ui=root.Unit501SharedUI;
 const gameBoard=$('nba-game-odds'),propBoard=$('nba-prop-lines'),gameStatus=$('nba-odds-status'),propStatus=$('nba-props-status');
 const refresh=$('nba-refresh-odds'),loadProps=$('nba-load-props'),market=$('nba-prop-market'),search=$('nba-prop-search');
 const sort=$('nba-prop-sort'),historyStatus=$('nba-player-history-status');
 const compare=$('nba-compare-odds'),compareStatus=$('nba-comparison-status'),compareBoard=$('nba-book-comparison');
 if(!gameBoard||!propBoard||!ui)return;
 let selected=null,date='',sequence=0,gameTask=0,propTask=0,quotes=null,props=null,timer=null;
 let comparisonTask=0,comparison=null,injuries=null,history=null,historyTask=0;
 const minuteOverrides=new Map();
 const normalizedName=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
 const node=(tag,text='',cls='')=>{const n=document.createElement(tag);n.textContent=String(text);if(cls)n.className=cls;return n;};
 const signed=n=>Number.isFinite(n)?(n>0?'+':'')+n:'—';
 const historyText=(h,line,at)=>{
  const observed=root.Unit501LineWatch?.fromServer(h,line,at);
  return observed?root.Unit501LineWatch.describe(observed)+' · '+root.Unit501LineWatch.detail(observed):'Line history unavailable';
 };
 const fresh=at=>Number.isFinite(at)&&at<=Date.now()+60000&&Date.now()-at<=1800000&&selected&&Date.parse(selected.tipoff)>Date.now();
 function card(title,lines,at){const c=node('section','', 'nba-quote-card');c.append(node('h4',title));for(const line of lines)c.append(node('p',line));if(at)c.append(node('small','Source update: '+ui.timeCentral(new Date(at).toISOString())));gameBoard.append(c);}
 function renderGames(){
  gameBoard.replaceChildren();
  if(typeof document.dispatchEvent==='function'&&typeof Event==='function')document.dispatchEvent(new Event('unit501:nba-lines-updated'));
  if(!selected||!quotes)return;
  const s=quotes.spread,t=quotes.total;
  if(s&&fresh(s.updatedAt))card('Spread',[selected.away+' '+signed(s.away)+' ('+signed(s.awayPrice)+')',selected.home+' '+signed(s.home)+' ('+signed(s.homePrice)+')',historyText(quotes.history?.spread,s.away,s.updatedAt)],s.updatedAt);
  else card('Spread',['No current paired spread available. Refresh game lines.']);
  if(t&&fresh(t.updatedAt))card('Game total',['Over '+t.line+' ('+signed(t.over)+')','Under '+t.line+' ('+signed(t.under)+')',historyText(quotes.history?.total,t.line,t.updatedAt)],t.updatedAt);
  else card('Game total',['No current paired total available. Refresh game lines.']);
  const ml=quotes.moneyline;
  if(ml&&fresh(ml.updatedAt))card('Moneyline',[selected.away+' '+signed(ml.away),historyText(quotes.history?.awayMoneyline,ml.away,ml.updatedAt),selected.home+' '+signed(ml.home),historyText(quotes.history?.homeMoneyline,ml.home,ml.updatedAt)],ml.updatedAt);
 }
 function renderProps(){
  propBoard.replaceChildren();if(!selected||!props)return;
  const query=search.value.trim().toLowerCase();
  const source=(props.props||[]).filter(p=>fresh(p.updatedAt)&&(!market.value||p.market===market.value)&&(!query||p.name.toLowerCase().includes(query)));
  const rows=source.map(p=>{
   const matching=injuries&&Number.isFinite(injuries.reportAt)&&injuries.reportAt<=Date.now()+60000&&Date.now()-injuries.reportAt<=7200000?
    injuries.teams.filter(t=>t.available).flatMap(t=>t.players).filter(player=>normalizedName(player.name)===normalizedName(p.name)):[];
   const status=matching.length===1?matching[0].status:null;
   const prediction=root.Unit501NBAPlayerModel?.project(history,p,selected,status,Date.now(),{minutes:minuteOverrides.get(normalizedName(p.name))})||{available:false,reason:'—'};
   return {p,status,prediction};
  });
  if(!rows.length){propBoard.append(node('p','No current player quotes match this view. Change the filters or refresh props.'));return;}
  if(sort?.value==='most'||sort?.value==='least')rows.sort((a,b)=>{
   if(a.prediction.available!==b.prediction.available)return a.prediction.available?-1:1;
   if(!a.prediction.available)return a.p.name.localeCompare(b.p.name)||a.p.label.localeCompare(b.p.label);
   const direction=sort.value==='most'?-1:1;
   return direction*(a.prediction.above-b.prediction.above)||b.prediction.games-a.prediction.games||a.p.name.localeCompare(b.p.name)||a.p.label.localeCompare(b.p.label);
  });
  const table=node('table','', 'nba-form-table'),head=node('thead',''),header=node('tr','');
  for(const label of ['Player','Stat','Line','Projection','Above','Below','Equal','Games','Over','Under','Source update']){const cell=node('th',label);cell.scope='col';header.append(cell);}head.append(header);table.append(head);
  const body=node('tbody','');
  for(const {p,status,prediction} of rows){
   const row=node('tr','',status==='Out'?'nba-injury-out':'');
   for(const [index,value] of [p.name+(status?' · '+status.toUpperCase():''),p.label,p.line,prediction.available?prediction.projection.toFixed(1):prediction.reason].entries()){
    const cell=node('td',value);
    if(index===0&&prediction.minuteChange){
     const change=prediction.minuteChange;
     cell.append(node('strong','Recent minutes '+change.direction+' · '+change.previous.toFixed(1)+' → '+change.recent.toFixed(1),'nba-minutes-trend'));
    }
    if(index===3&&prediction.available){
     cell.append(node('small',prediction.method+' · recent average '+prediction.average.toFixed(1),'nba-line-history'));
     if(prediction.projectedMinutes!==null){
      const label=node('label','Minutes ', 'nba-minutes-control'),input=node('input');
      input.type='number';input.min='1';input.max='48';input.step='0.5';input.placeholder=prediction.projectedMinutes.toFixed(1);
      input.value=minuteOverrides.get(normalizedName(p.name))??'';
      input.setAttribute('aria-label',p.name+' projected minutes');
      input.addEventListener('change',()=>{
       const name=normalizedName(p.name),value=input.value.trim();
       if(!value){minuteOverrides.delete(name);renderProps();return;}
       const minutes=Number(value);
       if(!Number.isFinite(minutes)||minutes<1||minutes>48){input.value=minuteOverrides.get(name)??'';return;}
       minuteOverrides.set(name,minutes);renderProps();
      });label.append(input);cell.append(label);
     }
    }
    if(index===2)cell.append(node('small',historyText(p.history,p.line,p.updatedAt),'nba-line-history'));
    row.append(cell);
   }
   for(const [field,other] of [['above','below'],['below','above'],['equal',null]]){
    const cell=node('td',prediction.available?prediction[field]:'—',prediction.available&&other&&prediction[field]>prediction[other]?'nba-prop-strong':'nba-prop-count');row.append(cell);
   }
   for(const value of [prediction.available?prediction.games:'—',signed(p.over),signed(p.under),ui.timeCentral(new Date(p.updatedAt).toISOString())])row.append(node('td',value));body.append(row);
  }
  table.append(node('caption',rows.length+' fresh FanDuel prop line(s) · minutes-based estimates; above/below counts are actual results'),body);propBoard.append(table);
 }
 async function loadPlayerHistory(game,serial){
  const task=++historyTask;
  if(historyStatus)historyStatus.textContent='Loading recent player games…';
  try{
   const query=new URLSearchParams({date,game:String(game.id)});if(game.provider)query.set('provider',game.provider);
   const response=await fetch('/api/nba/player-history?'+query,{signal:AbortSignal.timeout(90000)}),data=await response.json();
   if(serial!==sequence||task!==historyTask)return;
   if(!response.ok||String(data.gameId)!==String(game.id)||data.tipoff!==game.tipoff||!Number.isFinite(data.checkedAt)||
     !Array.isArray(data.teams)||data.teams.length!==2||data.teams.some(t=>typeof t.available!=='boolean'||!Array.isArray(t.players)))throw Error('History unavailable');
   history=data;renderProps();
   if(historyStatus)historyStatus.textContent=data.teams.every(t=>t.available)?'Recent NBA box scores loaded · 2–4 games is a small sample.':'Some player history is missing; estimates appear only for verified players.';
  }catch{
   if(serial!==sequence||task!==historyTask)return;
   history=null;renderProps();if(historyStatus)historyStatus.textContent='Player history unavailable. FanDuel lines are still shown.';
  }
 }
 function renderComparison(){
  compareBoard.replaceChildren();if(!selected||!comparison)return;
  const table=node('table','', 'nba-form-table nba-book-table'),header=node('tr','');
  for(const label of ['Sportsbook',selected.away+' moneyline',selected.home+' moneyline',selected.away+' spread',selected.home+' spread','Over','Under']){
   const cell=node('th',label);cell.scope='col';header.append(cell);
  }
  const head=node('thead','');head.append(header);table.append(head);
  table.append(node('caption','Pregame quotes · source times in Central Time · scroll sideways for all markets'));
  const body=node('tbody','');
  for(const book of comparison.books){
   const row=node('tr',''),name=node('th',book.name);name.scope='row';row.append(name);
   const m=book.moneyline,s=book.spread,t=book.total;
   for(const [value,at] of [
    [m?signed(m.away):'',m?.updatedAt],[m?signed(m.home):'',m?.updatedAt],
    [s?signed(s.away)+' ('+signed(s.awayPrice)+')':'',s?.updatedAt],
    [s?signed(s.home)+' ('+signed(s.homePrice)+')':'',s?.updatedAt],
    [t?t.line+' ('+signed(t.over)+')':'',t?.updatedAt],[t?t.line+' ('+signed(t.under)+')':'',t?.updatedAt]
   ]){
    const cell=node('td',fresh(at)?value:'Unavailable');
    if(fresh(at)){
     const time=node('small','Updated '+new Date(at).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',timeZone:'America/Chicago',timeZoneName:'short'}));
     time.title=ui.timeCentral(new Date(at).toISOString());cell.append(time);
    }
    row.append(cell);
   }
   body.append(row);
  }
  if(!comparison.books.length){compareBoard.append(node('p','No pregame comparison quotes are available for this matchup.'));return;}
  table.append(body);compareBoard.append(table);
 }
 async function loadComparison(){
  if(!selected)return;
  const game=selected,serial=sequence,task=++comparisonTask;
  compare.disabled=true;compareStatus.textContent='Loading moneylines, spreads and totals from three sportsbooks…';
  try{
   const query=new URLSearchParams({date,game:String(game.id)});if(game.provider)query.set('provider',game.provider);
   const response=await fetch('/api/nba/comparison?'+query,{signal:AbortSignal.timeout(45000)}),data=await response.json();
   if(serial!==sequence||task!==comparisonTask)return;
   if(!response.ok)throw Error(data.error||'NBA sportsbook comparison unavailable.');
   if(String(data.gameId)!==String(game.id)||data.tipoff!==game.tipoff||data.bookmaker!=='Multiple'||!Array.isArray(data.books)||
    data.books.some(b=>!b||!['fanduel','draftkings','betmgm'].includes(b.key))||new Set(data.books.map(b=>b.key)).size!==data.books.length)
    throw Error('NBA comparison matchup or sportsbooks could not be verified.');
   comparison=data;renderComparison();
   compareStatus.textContent=(data.message||'NBA sportsbook comparison checked.')+' Cached up to five minutes; source quotes expire after 30 minutes or at tipoff.';
  }catch(error){
   if(serial!==sequence||task!==comparisonTask)return;
   compareStatus.textContent=error.message+' Any previously loaded fresh comparison quotes are retained.';renderComparison();
  }finally{if(serial===sequence&&task===comparisonTask)compare.disabled=false;}
 }
 async function load(kind){
  if(!selected)return;
  const game=selected,serial=sequence,task=kind==='game'?++gameTask:++propTask;
  const status=kind==='game'?gameStatus:propStatus,button=kind==='game'?refresh:loadProps;
  button.disabled=true;status.textContent=kind==='game'?'Loading FanDuel NBA spread and total…':'Loading FanDuel NBA player props…';
  try{
   const query=new URLSearchParams({date,game:String(game.id)});
   if(game.provider)query.set('provider',game.provider);
   const response=await fetch('/api/nba/'+(kind==='game'?'odds':'props')+'?'+query,{signal:AbortSignal.timeout(45000)});
   const data=await response.json();
   if(serial!==sequence||task!==(kind==='game'?gameTask:propTask))return;
   if(!response.ok)throw Error(data.error||'NBA FanDuel quotes unavailable.');
   if(String(data.gameId)!==String(game.id)||data.tipoff!==game.tipoff||data.bookmaker!=='FanDuel')throw Error('NBA quote matchup could not be verified.');
   if(kind==='game'){quotes=data;renderGames();}
   else{
    if(!Array.isArray(data.props))throw Error('NBA player quotes were not returned as a list.');
    props=data;renderProps();loadPlayerHistory(game,serial);
   }
   const coverage=kind==='props'?(data.coverage||[]).map(m=>m.label+': '+m.lines).join(' · '):'';
   status.textContent=(data.message||'NBA FanDuel quotes checked.')+(coverage?' '+coverage+'.':'')+' '+(data.tracking?.message||'Shared tracking status unavailable.')+' Quotes expire after 30 minutes or at tipoff.';
  }catch(error){
   if(serial!==sequence||task!==(kind==='game'?gameTask:propTask))return;
   status.textContent=error.message+' Any previously loaded fresh quotes are retained.';
   kind==='game'?renderGames():renderProps();
  }finally{if(serial===sequence&&task===(kind==='game'?gameTask:propTask))button.disabled=false;}
 }
 function clear(){minuteOverrides.clear();sequence++;historyTask++;history=null;if(historyStatus)historyStatus.textContent='';if(sort)sort.value='name';selected=null;quotes=null;
 if(typeof document.dispatchEvent==='function'&&typeof Event==='function')document.dispatchEvent(new Event('unit501:nba-lines-updated'));
 props=null;comparison=null;injuries=null;clearTimeout(timer);gameBoard.replaceChildren();propBoard.replaceChildren();compareBoard.replaceChildren();gameStatus.textContent='';propStatus.textContent='Select a matchup to load its player quotes.';compareStatus.textContent='Select a matchup to compare moneylines, spreads and totals.';refresh.disabled=true;loadProps.disabled=true;compare.disabled=true;}
 function tick(){if(!selected)return;if(!document.hidden){renderGames();renderProps();renderComparison();}timer=setTimeout(tick,60000);}
 root.Unit501NBAMarkets={clear,setInjuries(game,report){
  if(!selected||String(selected.id)!==String(game?.id)||selected.tipoff!==game.tipoff)return;
  injuries=report&&String(report.gameId)===String(selected.id)&&report.tipoff===selected.tipoff&&Array.isArray(report.teams)?report:null;
  renderProps();
 },linesFor(game){
  if(!selected||String(selected.id)!==String(game?.id)||selected.tipoff!==game.tipoff)return {};
  const spread=quotes?.spread,total=quotes?.total;
  return {awaySpread:spread&&fresh(spread.updatedAt)&&Number.isFinite(spread.away)&&Number.isFinite(spread.home)&&Math.abs(spread.away+spread.home)<1e-9?spread.away:null,
   total:total&&fresh(total.updatedAt)&&Number.isFinite(total.line)&&total.line>0?total.line:null};
 },spreadFor(game){
  const s=quotes?.spread;
  return selected&&String(selected.id)===String(game.id)&&selected.tipoff===game.tipoff&&s&&fresh(s.updatedAt)&&Number.isFinite(s.away)&&Number.isFinite(s.home)&&Math.abs(s.away+s.home)<1e-9?s.away:null;
 },select(game,day){clear();selected=game;date=day;market.value='';search.value='';refresh.disabled=false;loadProps.disabled=false;compare.disabled=false;compareStatus.textContent='Click Compare to check FanDuel, DraftKings and BetMGM; no comparison request has been made yet.';propStatus.textContent='Load FanDuel player props for points, rebounds, assists and threes.';load('game');tick();}};
 refresh.addEventListener('click',()=>load('game'));loadProps.addEventListener('click',()=>load('props'));
 market.addEventListener('change',renderProps);search.addEventListener('input',renderProps);sort?.addEventListener('change',renderProps);
 compare.addEventListener('click',loadComparison);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden){renderGames();renderProps();renderComparison();}});
 clear();
})(window);
