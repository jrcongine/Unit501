/* One shared, data-preserving navigation shell for football and basketball. */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root?.document)api.mount(root.document,root);
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const sports=[['nfl','NFL','/?league=1'],['ncaaf','CFB','/?league=2'],['nba','NBA','/nba.html'],['ncaab','CBB','/ncaab.html']];
 const safeLogo=url=>typeof url==='string'&&/^https:\/\/(?:[a-z0-9-]+\.)*(?:espncdn\.com|api-sports\.io|nba\.com)\/[^\s]*$/i.test(url);
 function gameView(game,league){
  if(!game)return null;
  const away=game.a||game.away,home=game.h||game.home;
  if(typeof away!=='string'||typeof home!=='string')return null;
  const kickoff=game.kickoff??Date.parse(game.tipoff);
  return {away,home,league,id:String(game.id),kickoff,awayLogo:safeLogo(game.awayLogo)?game.awayLogo:null,homeLogo:safeLogo(game.homeLogo)?game.homeLogo:null,
   venue:[game.venueName,game.venueCity].filter(Boolean).join(' · '),status:game.status||'Time unconfirmed',awayScore:game.awayScore,homeScore:game.homeScore};
 }
 function mount(doc,win){
  const main=doc.querySelector('main'),lab=doc.querySelector('#lab, #nba-lab, #ncaab-lab');
  if(!main||!lab||doc.getElementById('game-center'))return;
  const id=lab.id,prefix=id==='lab'?'':id.replace('lab',''),football=!prefix;
  const byId=id=>doc.getElementById(id);
  const make=(tag,text,cls)=>{const n=doc.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
  const league=()=>football?(byId('league').value==='1'?'nfl':'ncaaf'):prefix==='nba-'?'nba':'ncaab';
  const standings=new Map();
  let current=null,standing=null,active='overview',pending=false,marketOverview=null;
  doc.body.classList.add('game-center-layout');
  const header=main.querySelector('header'),switcher=main.querySelector('.sport-switch'),controls=main.querySelector('.controls');
  const top=make('div',null,'gc-top');main.prepend(top);
  if(header)top.append(header);
  if(switcher){switcher.replaceChildren();for(const [key,name,path]of sports){const link=make('a',name);link.href=path;const selectedDate=doc.querySelector('input[type=date]')?.value;if(/^\d{4}-\d{2}-\d{2}$/.test(selectedDate||'')){const target=new URL(path,win.location.href);target.searchParams.set('date',selectedDate);link.href=target.href;}link.dataset.league=key;
   link.addEventListener('click',event=>{if(!football||!['nfl','ncaaf'].includes(key))return;event.preventDefault();if(league()===key)return;byId('league').value=key==='nfl'?'1':'2';syncSport();win.history.replaceState(null,'',link.href);byId('load').click();});switcher.append(link);}top.append(switcher);}
  if(controls)top.append(controls);
  const games=byId(prefix+'games');if(games){games.classList.add('gc-game-strip');top.append(games);}
  const center=make('section',null,'gc-center');center.id='game-center';main.insertBefore(center,lab);
  const hero=make('section',null,'gc-hero');hero.setAttribute('aria-label','Selected matchup');
  const heroTitle=make('h2','Choose your matchup');const heroHint=make('p','Pick a sport, then swipe the games above.','gc-hero-hint');hero.append(heroTitle,heroHint);center.append(hero);
  const tabs=make('nav',null,'gc-tabs');tabs.setAttribute('aria-label','Matchup sections');tabs.setAttribute('role','tablist');center.append(tabs);
  const panels={},buttons={};
  const labels=[['overview','Overview'],['simulation','Simulation'],['props','Player Props'],...(football?[['weather','Weather']]:[]),['injuries','Injuries'],['war','War Room'],['news','News & Ranks']];
  for(const [key,label]of labels){const button=make('button',label);button.type='button';button.id='gc-tab-'+key;button.setAttribute('role','tab');button.setAttribute('aria-controls','gc-panel-'+key);
   const panel=make('section',null,'gc-panel');panel.id='gc-panel-'+key;panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',button.id);panel.tabIndex=0;
   tabs.append(button);center.append(panel);panels[key]=panel;buttons[key]=button;button.addEventListener('click',()=>show(key));
   button.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const usable=Object.keys(buttons).filter(k=>!buttons[k].disabled),i=usable.indexOf(key);const next=event.key==='Home'?usable[0]:event.key==='End'?usable.at(-1):usable[(i+(event.key==='ArrowRight'?1:-1)+usable.length)%usable.length];show(next);buttons[next].focus();});
  }
  const move=(node,key)=>{if(node&&panels[key])panels[key].append(node);};
  const details=(title,node,key='overview')=>{if(!node)return;const fold=make('details',null,'gc-details');fold.append(make('summary',title),node);move(fold,key);};
  move(lab,'simulation');move(byId(prefix+'player-lab'),'props');
  const war=byId('war-room');move(war,'war');
  if(war)war.open=true;
  const pulse=byId('league-pulse');move(pulse,'news');if(pulse?.querySelector('details'))pulse.querySelector('details').open=true;
  const form=make('section',null,'gc-form-summary');panels.overview.append(form);
  const shortcuts=make('div',null,'gc-shortcuts');
  for(const [key,label]of [['simulation','Run Simulation'],['props','Explore Player Props'],['injuries','Key Injuries']]){const b=make('button',label+' →');b.type='button';b.addEventListener('click',()=>show(key));shortcuts.append(b);}panels.overview.append(shortcuts);
  const injuryPeek=make('p','Select a game to check injury coverage.','gc-injury-peek');panels.overview.append(injuryPeek);
  const weatherPeek=football?make('button','Weather · select a matchup','gc-weather-peek'):null;if(weatherPeek){weatherPeek.type='button';weatherPeek.addEventListener('click',()=>show('weather'));panels.overview.append(weatherPeek);}
  let context,injuries;
  if(football){context=byId('team-context');details('Full matchup analysis & recent results',context);move(byId('game-weather'),'weather');move(byId('matchup-settings'),'weather');injuries=byId('availability-panel');move(injuries,'injuries');move(byId('injury-scoring-panel'),'injuries');
   move(byId('league-pulse-matchup'),'overview');
  }else{
   context=byId(prefix==='nba-'?'nba-team-context':'ncaab-teams');
   const formFold=context?.closest('details');if(formFold)formFold.open=true;details('Full matchup analysis & recent results',formFold||context);
   injuries=byId(prefix==='nba-'?'nba-injuries-list':'ncaab-injuries')?.closest('section.nba-model-status');move(injuries,'injuries');
   marketOverview=make('div');const market=lab.querySelector('.nba-market-panel');if(market)marketOverview.append(market);move(marketOverview,'overview');
   move(byId(prefix+'league-pulse-matchup'),'overview');
  }
  const newsPeek=make('section',null,'gc-news-peek');newsPeek.append(make('h3','Around the League'));panels.overview.append(newsPeek);
  const newsButton=make('button','More news & power rankings →');newsButton.type='button';newsButton.addEventListener('click',()=>show('news'));newsPeek.append(newsButton);
  // Keep background tools accessible, but off the primary game screen.
  for(const selector of ['#api-usage-panel','#player-ratings-panel','#pregame-checks','#maintenance-panel']){const node=doc.querySelector(selector);if(node)details('Advanced tools',node,'simulation');}
  const health=make('a','Data health & source status');health.href='/data-health.html';panels.news.append(health);
  move(byId('worth-a-look'),'news');
  const watch=byId('nba-alert-enable')?.closest('details');if(watch)move(watch,'simulation');
  const quick=main.querySelector('.quick-nav');if(quick){quick.classList.add('gc-legacy-nav');for(const [sel,key]of [['.nav-lab','simulation'],['.nav-player','props'],['.nav-war','war']])quick.querySelector(sel)?.addEventListener('click',()=>show(key));}
  function syncSport(){for(const a of switcher?.children||[]){if(a.dataset.league===league())a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');}}
  function show(key){if(!panels[key]||buttons[key].disabled)return;active=key;for(const k of Object.keys(panels)){panels[k].hidden=k!==key;buttons[k].setAttribute('aria-selected',String(k===key));buttons[k].tabIndex=k===key?0:-1;}if(key==='war'&&war)war.open=true;}
  function lock(){for(const key of Object.keys(buttons))buttons[key].disabled=!current&&!['overview','news','war'].includes(key);shortcuts.hidden=!current;if(marketOverview)marketOverview.hidden=!current;}
  function team(name,logo,record){const side=make('div',null,'gc-team');if(logo){const img=make('img');img.src=logo;img.alt=name+' logo';img.width=88;img.height=88;img.referrerPolicy='no-referrer';img.addEventListener('error',()=>{img.hidden=true;});side.append(img);}else side.append(make('span',name.split(/\s+/).map(x=>x[0]).join('').slice(0,3),'gc-team-monogram'));side.append(make('h3',name),make('small',record||'Season record unavailable'));return side;}
  function renderHero(){hero.replaceChildren();if(!current){hero.append(heroTitle,heroHint);return;}
   const label=make('div',current.league.toUpperCase()+' · '+current.status,'gc-eyebrow');
   const row=make('div',null,'gc-matchup');
   const date=football?byId('date')?.value:byId(prefix+'date')?.value;
   const getRecord=name=>win.Unit501SharedUI?.currentStanding(standing,current.league,String(date||'').slice(0,4),name,date)?.record;
   const middle=make('div',null,'gc-kickoff');middle.append(make('span','AT'));middle.append(make('strong',Number.isFinite(current.kickoff)?win.Unit501SharedUI.timeCentral(current.kickoff):'Time unconfirmed'));if(current.venue)middle.append(make('small',current.venue));
   if(current.awayScore!=null&&current.homeScore!=null)middle.append(make('b',current.awayScore+' – '+current.homeScore));
   row.append(team(current.away,current.awayLogo,getRecord(current.away)),middle,team(current.home,current.homeLogo,getRecord(current.home)));
   const markets=make('div',null,'gc-market-summary');
   const spread=byId(football?'spread':prefix+'spread'),total=byId(football?'total':prefix+'total');
   for(const [title,value]of (spread||total?[['Away spread',spread?.value],['Game total',total?.value]]:[])){const tile=make('div');tile.append(make('small',title),make('b',value!==''&&value!=null?value:'Unavailable'));markets.append(tile);}
   if(!spread&&!total){const note=make('p','Current market quotes are shown in Overview.','gc-quote-note');markets.append(note);}
   hero.append(label,row,markets);
  }
  function summary(){
   if(weatherPeek){const weather=byId('game-weather-status');const temp=weather?.querySelector('.weather-temp')?.textContent;const icon=weather?.querySelector('.weather-big-icon')?.textContent||'🌡️';const wind=weather?.querySelector('.weather-metrics>div strong')?.textContent;weatherPeek.textContent=current?(temp?icon+' '+temp+(wind?' · Wind '+wind:'')+' · Full forecast →':(weather?.textContent||'Weather unavailable').slice(0,130)):'Weather · select a matchup';weatherPeek.disabled=!current;}
   form.replaceChildren(make('h3','Last 5 · newest first'));
   const cards=current?context?.querySelectorAll('.football-form-card, .nba-team-history')||[]:[];
   for(const card of cards){const strip=card.querySelector('.football-form-strip, .nba-form-strip');if(!strip)continue;const line=make('div',null,'gc-form-line');line.append(make('strong',card.querySelector('h4')?.childNodes[0]?.textContent||card.querySelector('h4')?.textContent||'Team'),strip.cloneNode(true));form.append(line);}
   if(form.children.length===1)form.append(make('p',current?'Recent form unavailable or still loading. Open full matchup analysis for source details.':'Select a game to see recent form.'));
   const injuryText=current&&(football?byId('availability-panel')?.querySelector('h2, h3, [role=status]'):byId(prefix==='nba-'?'nba-injuries-status':'ncaab-injury-status'))?.textContent;
   const report=football&&current?win.Unit501Availability?.snapshot():null;
   const reports=(report?.teams||[]).flatMap(t=>{const source=t.official?.available?t.official:t.injuries;return (source?.rows||[]).filter(p=>/^(out|inactive|doubtful|questionable)$/i.test(p.status||'')).map(p=>({name:p.name||(t.roster?.rows||[]).find(r=>String(r.id)===String(p.id))?.name,status:p.status}));}).filter(p=>p.name);
   injuryPeek.textContent='Key injuries · '+(reports.length?reports.slice(0,4).map(p=>p.name+' ('+p.status+')').join(' · ')+(reports.length>4?' · +'+(reports.length-4)+' more':''):report?.current===false?report.message||'Report coverage unavailable':(football?'Coverage unavailable or loading — open Injuries to review.':injuryText)||'Open Injuries for reports, coverage and confirmed absences.');
  }
  const schedule=()=>{if(pending)return;pending=true;win.requestAnimationFrame(()=>{pending=false;summary();renderHero();});};
  function select(game,key){current=gameView(game,key);standing=standings.get(key)||null;lock();renderHero();summary();show('overview');}
  doc.addEventListener('unit501:matchup-selected',e=>{if(e.detail?.game)select(e.detail.game,e.detail.league);});
  for(const event of ['unit501:matchup-cleared','unit501:nba-clear','unit501:slate-reset'])doc.addEventListener(event,()=>{current=null;standing=null;lock();renderHero();summary();show('overview');syncSport();});
  doc.addEventListener('unit501:standings-updated',e=>{if(e.detail?.league)standings.set(e.detail.league,e.detail.report);if(current&&e.detail?.league===current.league){standing=e.detail.report;schedule();}});
  for(const event of ['unit501:odds-updated','unit501:availability-updated','unit501:weather-updated','unit501:team-context-updated','unit501:nba-lines-updated'])doc.addEventListener(event,schedule);
  for(const node of [context,injuries,byId('nba-game-odds'),byId('game-weather')])if(node)new win.MutationObserver(schedule).observe(node,{childList:true,subtree:true,characterData:true});
  for(const field of [byId('spread'),byId('total'),byId(prefix+'spread'),byId(prefix+'total')])if(field)field.addEventListener('input',schedule);
  byId('league')?.addEventListener('change',syncSport);
  // News is copied only as a short title; the original source links stay in News.
  const headlines=byId('league-pulse-headlines');if(headlines)new win.MutationObserver(()=>{newsPeek.querySelector('.gc-headline')?.remove();const a=headlines.querySelector('a');if(a){const copy=a.cloneNode(true);copy.classList.add('gc-headline');newsPeek.insertBefore(copy,newsButton);}}).observe(headlines,{childList:true,subtree:true});
  syncSport();lock();summary();show('overview');
  win.Unit501GameCenter={show,select,clear:()=>{current=null;lock();renderHero();summary();show('overview');}};
 }
 return {safeLogo,gameView,mount};
});
