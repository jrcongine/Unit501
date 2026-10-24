/* NBA bookmaker markets only. No Unit 501 player or score estimates. */
(function(root){
 'use strict';
 const $=id=>document.getElementById(id),ui=root.Unit501SharedUI;
 const gameBoard=$('nba-game-odds'),propBoard=$('nba-prop-lines'),gameStatus=$('nba-odds-status'),propStatus=$('nba-props-status');
 const refresh=$('nba-refresh-odds'),loadProps=$('nba-load-props'),market=$('nba-prop-market'),search=$('nba-prop-search');
 if(!gameBoard||!propBoard||!ui)return;
 let selected=null,date='',sequence=0,gameTask=0,propTask=0,quotes=null,props=null,timer=null;
 const node=(tag,text='',cls='')=>{const n=document.createElement(tag);n.textContent=String(text);if(cls)n.className=cls;return n;};
 const signed=n=>Number.isFinite(n)?(n>0?'+':'')+n:'—';
 const fresh=at=>Number.isFinite(at)&&at<=Date.now()+60000&&Date.now()-at<=1800000&&selected&&Date.parse(selected.tipoff)>Date.now();
 function card(title,lines,at){const c=node('section','', 'nba-quote-card');c.append(node('h4',title));for(const line of lines)c.append(node('p',line));if(at)c.append(node('small','Source update: '+ui.timeCentral(new Date(at).toISOString())));gameBoard.append(c);}
 function renderGames(){
  gameBoard.replaceChildren();if(!selected||!quotes)return;
  const s=quotes.spread,t=quotes.total;
  if(s&&fresh(s.updatedAt))card('Spread',[selected.away+' '+signed(s.away)+' ('+signed(s.awayPrice)+')',selected.home+' '+signed(s.home)+' ('+signed(s.homePrice)+')'],s.updatedAt);
  else card('Spread',['No current paired spread available. Refresh game lines.']);
  if(t&&fresh(t.updatedAt))card('Game total',['Over '+t.line+' ('+signed(t.over)+')','Under '+t.line+' ('+signed(t.under)+')'],t.updatedAt);
  else card('Game total',['No current paired total available. Refresh game lines.']);
 }
 function renderProps(){
  propBoard.replaceChildren();if(!selected||!props)return;
  const query=search.value.trim().toLowerCase();
  const rows=(props.props||[]).filter(p=>fresh(p.updatedAt)&&(!market.value||p.market===market.value)&&(!query||p.name.toLowerCase().includes(query)));
  if(!rows.length){propBoard.append(node('p','No current player quotes match this view. Change the filters or refresh props.'));return;}
  const table=node('table','', 'nba-form-table'),head=node('thead',''),header=node('tr','');
  for(const label of ['Player','Stat','Line','Over','Under','Source update']){const cell=node('th',label);cell.scope='col';header.append(cell);}head.append(header);table.append(head);
  const body=node('tbody','');
  for(const p of rows){const row=node('tr','');for(const value of [p.name,p.label,p.line,signed(p.over),signed(p.under),ui.timeCentral(new Date(p.updatedAt).toISOString())])row.append(node('td',value));body.append(row);}
  table.append(node('caption',rows.length+' fresh FanDuel prop line(s) · bookmaker quotes, not projections'),body);propBoard.append(table);
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
    props=data;renderProps();
   }
   const coverage=kind==='props'?(data.coverage||[]).map(m=>m.label+': '+m.lines).join(' · '):'';
   status.textContent=(data.message||'NBA FanDuel quotes checked.')+(coverage?' '+coverage+'.':'')+' Cached up to five minutes; source quotes expire after 30 minutes or at tipoff.';
  }catch(error){
   if(serial!==sequence||task!==(kind==='game'?gameTask:propTask))return;
   status.textContent=error.message+' Any previously loaded fresh quotes are retained.';
   kind==='game'?renderGames():renderProps();
  }finally{if(serial===sequence&&task===(kind==='game'?gameTask:propTask))button.disabled=false;}
 }
 function clear(){sequence++;selected=null;quotes=null;props=null;clearTimeout(timer);gameBoard.replaceChildren();propBoard.replaceChildren();gameStatus.textContent='';propStatus.textContent='Select a matchup to load its player quotes.';refresh.disabled=true;loadProps.disabled=true;}
 function tick(){if(!selected)return;if(!document.hidden){renderGames();renderProps();}timer=setTimeout(tick,60000);}
 root.Unit501NBAMarkets={clear,select(game,day){clear();selected=game;date=day;market.value='';search.value='';refresh.disabled=false;loadProps.disabled=false;propStatus.textContent='Click Load FanDuel player props for points, rebounds, assists and threes. No player-stat projections yet.';load('game');tick();}};
 refresh.addEventListener('click',()=>load('game'));loadProps.addEventListener('click',()=>load('props'));
 market.addEventListener('change',renderProps);search.addEventListener('input',renderProps);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden){renderGames();renderProps();}});
 clear();
})(window);
