(function(){
 'use strict';
 const byId=id=>document.getElementById(id);
 const panel=byId('league-pulse');
 if(!panel)return;
 const selector=byId('league-pulse-league'),refresh=byId('league-pulse-refresh');
 const status=byId('league-pulse-status'),power=byId('league-pulse-power'),news=byId('league-pulse-headlines');
 const matchup=byId('league-pulse-matchup')||byId('nba-league-pulse-matchup');
 const names={nfl:'NFL',ncaaf:'College football',nba:'NBA',mlb:'MLB',nhl:'NHL'};
 const snapshots=new Map();
 let sequence=0,activeGame=null;
 function el(tag,text,className){
  const node=document.createElement(tag);
  if(text!==null&&text!==undefined)node.textContent=String(text);
  if(className)node.className=className;
  return node;
 }
 const logoSports={nfl:'nfl',ncaaf:'ncaa',nba:'nba',mlb:'mlb',nhl:'nhl'};
 function teamLogo(team,league){
  if(!team||!/^[0-9]{1,7}$/.test(String(team.id||''))||!logoSports[league])return null;
  const img=el('img',null,'league-pulse-logo');
  img.src='https://a.espncdn.com/i/teamlogos/'+logoSports[league]+'/500/'+team.id+'.png';
  img.alt='';img.loading='lazy';img.referrerPolicy='no-referrer';
  img.onerror=()=>img.remove();
  return img;
 }
 function rankLabel(data){
  if(data.league!=='ncaaf')return 'Overall Power Ranks';
  return data.power?.scheduleAdjustment?.applied===true?'Schedule-adjusted FBS Results':'Unadjusted FBS Results';
 }
 const norm=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
 function row(team,league){
  const result=el('li',null,'league-pulse-team');
  const rank=el('strong','#'+team.rank,'league-pulse-rank');
  const title=el('span',team.name,'league-pulse-name');
  if(Number.isInteger(team.scheduleRank)&&team.fbsRecord){
   title.append(el('small','FBS '+team.fbsRecord+' · schedule #'+team.scheduleRank,'league-pulse-strength'));
  }
  const record=el('span',team.record,'league-pulse-record');
  const score=el('strong',Number(team.score).toFixed(1),'league-pulse-index');
  score.title='UNIT 501 Power Index, not an official ranking or a betting prediction';
  if(Number.isInteger(team.scheduleRank))score.title='Schedule-adjusted FBS results index; not a win probability';
  const form=el('span',team.trend==='up'?'↑ '+team.trendLabel:team.trend==='down'?'↓ '+team.trendLabel:'→ '+team.trendLabel,
    'league-pulse-trend trend-'+team.trend);
  form.title='Form based on consecutive wins/losses, not ranking movement';
  const logo=teamLogo(team,league);
  result.append(rank,logo||el('span',null,'league-pulse-logo-placeholder'),title,record,score,form);
  return result;
 }
 function group(label,teams,open,league){
  const details=el('details',null,'league-pulse-group');
  details.open=open;
  const summary=el('summary',label+' ('+teams.length+')');
  const list=el('ol',null,'league-pulse-list');
  list.start=teams.length&&Number.isFinite(teams[0].rank)?teams[0].rank:1;
  for(const t of teams)list.append(row(t,league));
  details.append(summary,list);
  return details;
 }
 function renderBoard(data){
  power.replaceChildren();
  const board=data?.power;
  if(!board?.available||!Array.isArray(board.teams)){
   power.append(el('p',board?.message||'Overall power rankings are not verified for this league.','league-pulse-empty'));return;
  }
  const context=el('p','UNIT 501 '+rankLabel(data)+' · current '+board.season+' season · '+board.teams.length+' teams · '+board.basis,'league-pulse-note');
  const formula=el('p',(board.explanation||'Calculated from season results and points scored versus points allowed.')+' ↑/↓/→ = win/loss streak momentum, NOT movement in rank. Display only; it does not affect predictions.','league-pulse-explainer');
  if(board.scheduleAdjustment?.applied===false)formula.append(el('span',' '+board.scheduleAdjustment.reason));
  if(data.league==='ncaaf'){
   power.append(context,formula,
    group('🏆 Top 25 · '+rankLabel(data),board.teams.slice(0,25),true,data.league),
    group('26–50 · Next Tier',board.teams.slice(25,50),false,data.league),
    group('51–'+board.teams.length+' · Rest of FBS',board.teams.slice(50),false,data.league));
   return;
  }
  power.append(context,formula,
   group('🏆 Top 10 · Contenders',board.top,true,data.league),
   group('⚔ Middle of the Pack',board.middle,false,data.league),
   group('🧊 Bottom 10 · Bottom Feeders',board.bottom,true,data.league));
 }
 function renderNews(data){
  news.replaceChildren();
  if(!data?.headlines?.available||!data.headlines.items?.length){
   news.append(el('p',data?.headlines?.message||'League headlines unavailable.','league-pulse-empty'));return;
  }
  const list=el('ul',null,'league-pulse-articles');
  for(const h of data.headlines.items){
   if(typeof h.url!=='string'||!h.url.startsWith('https://'))continue;
   const category=String(h.category||'League update');
   const title=String(h.title||'');
   const categoryText=(category+' '+title).toLowerCase();
   const type=/injur|surgery|out for|questionable|ruled out/.test(categoryText)?'injury':
    /transfer|portal/.test(categoryText)?'transfer':
    /coach|coaching/.test(categoryText)?'coaching':
    /rank|top 10|top 25/.test(categoryText)?'rankings':
    /betting|analysis|preview|upset/.test(categoryText)?'analysis':'update';
   const symbols={injury:'✚',transfer:'⇄',coaching:'♟',rankings:'🏆',analysis:'📊',update:'📰'};
   const labels={injury:'INJURY REPORT',transfer:'TRANSFER',coaching:'COACHING',rankings:'RANKINGS',analysis:'GAME ANALYSIS',update:'LEAGUE UPDATE'};
   const item=el('li',null,'league-pulse-story league-pulse-'+type);
   const symbol=el('span',symbols[type],'league-pulse-story-symbol');symbol.setAttribute('aria-hidden','true');
   const titleKey=norm(title);
   const candidates=(data.power?.teams||[]).filter(t=>
    [t.name,t.providerName].filter(Boolean).some(name=>{
     const key=norm(name);
     return key.length>=6&&titleKey.includes(key);
    })
   );
   const logo=candidates.length===1?teamLogo(candidates[0],data.league):null;
   if(logo){symbol.textContent='';symbol.append(logo);}
   const content=el('div',null,'league-pulse-story-content');
   const badge=el('span',labels[type],'league-pulse-category');
   const link=el('a',title,'league-pulse-story-link');link.href=h.url;link.target='_blank';link.rel='noopener noreferrer';
   const time=Date.parse(h.publishedAt),label=Number.isFinite(time)?
    new Date(time).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZone:'America/Chicago'})+' CT':'Time unavailable';
   const meta=el('div',h.source+' · '+label+(h.premium?' · Subscriber article':''),'league-pulse-byline');
   content.append(badge,link,meta);item.append(symbol,content);list.append(item);
  }
  news.append(list,el('p','Headlines link to the original publisher. Injury, coaching and transfer reports are not automatically treated as confirmed player availability.','league-pulse-note'));
 }
 function findTeam(snapshot,name){
  if(!snapshot?.power?.available||!name)return null;
  const needle=norm(name);
  const exact=snapshot.power.teams.filter(t=>norm(t.name)===needle||norm(t.providerName)===needle);
  if(exact.length===1)return exact[0];
  // Football provider and league standings sometimes use school name vs. full team nickname.
  // Only one unambiguous prefix match may be used; never guess Miami (FL)/Miami (OH).
  if(needle.length<6)return null;
  const matches=snapshot.power.teams.filter(t=>{
   const full=norm(t.name),provider=norm(t.providerName);
   return full.startsWith(needle)||needle.startsWith(full)||provider.startsWith(needle)||needle.startsWith(provider);
  });
  return matches.length===1?matches[0]:null;
 }
 function renderMatchup(){
  if(!matchup)return;
  matchup.replaceChildren();
  if(!activeGame)return;
  const data=snapshots.get(activeGame.league);
  if(!data?.power?.available){
   matchup.append(el('p','Overall league power ranks will appear here when the current standings are verified.','league-pulse-empty'));return;
  }
  const a=findTeam(data,activeGame.away),h=findTeam(data,activeGame.home);
  const title=el('h3','🏆 UNIT 501 '+rankLabel(data));
  const unadjusted=data.league==='ncaaf'&&data.power.scheduleAdjustment?.applied!==true;
  const grid=el('div',null,'league-pulse-matchup-grid');
  for(const [name,team] of [[activeGame.away,a],[activeGame.home,h]]){
   const card=el('div',null,'league-pulse-matchup-team');
   card.append(el('strong',team?'#'+team.rank+' of '+data.power.count:'Rank unavailable'),
    el('span',name),
    el('small',team?'Index '+team.score.toFixed(1)+(Number.isInteger(team.scheduleRank)?' · FBS '+team.fbsRecord+' · schedule #'+team.scheduleRank:'')+' · '+(team.trend==='up'?'↑':team.trend==='down'?'↓':'→')+' '+team.trendLabel:'Team identity not verified'));
   grid.append(card);
  }
  if(unadjusted)matchup.append(el('p','Schedule strength unverified — these ranks can overrate teams facing weaker opponents.','league-pulse-note'));
  matchup.append(title,grid,el('p','Current-season ranking context only. Not a historical pregame rating or an automatic score/prop adjustment.','league-pulse-note'));
 }
 async function load(league){
  if(!names[league])return;
  panel.hidden=false;
  selector.value=league;
  const key=++sequence;
  status.textContent='Loading '+names[league]+' power index and league headlines…';
  power.replaceChildren();news.replaceChildren();
  snapshots.delete(league);
  renderMatchup();
  try{
   const response=await fetch('/api/league-pulse?league='+encodeURIComponent(league),{signal:AbortSignal.timeout(30000)});
   const data=await response.json();
   if(key!==sequence)return;
   if(!response.ok||data.error)throw Error(data.error||'League updates are unavailable.');
   snapshots.set(league,data);
   renderBoard(data);renderNews(data);renderMatchup();
   status.textContent=names[league]+' · updated '+
    new Date(data.checkedAt).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZone:'America/Chicago'})+
    ' CT · sources: '+(data.power?.provider||'ESPN standings')+' / ESPN headline links';
  }catch{
   if(key!==sequence)return;
   status.textContent='League pulse could not load. Try Refresh; no ranks or headlines were invented.';
   power.replaceChildren();news.replaceChildren();power.append(el('p','Verified power rankings unavailable.','league-pulse-empty'));
   renderMatchup();
  }
 }
 selector.addEventListener('change',()=>load(selector.value));
 refresh.addEventListener('click',()=>load(selector.value));
 document.addEventListener('unit501:slate-loaded',event=>{
  const league=event.detail?.league;
  if(league&&names[league])load(league);
 });
 document.addEventListener('unit501:matchup-selected',event=>{
  const d=event.detail;
  if(!d||!names[d.league])return;
  activeGame={league:d.league,away:d.away,home:d.home};
  renderMatchup();
 });
 document.addEventListener('unit501:matchup-cleared',()=>{
  activeGame=null;if(matchup)matchup.replaceChildren();
 });
 document.addEventListener('unit501:nba-clear',()=>{
  activeGame=null;if(matchup)matchup.replaceChildren();
 });
 window.Unit501LeaguePulse={show:load};
})();
