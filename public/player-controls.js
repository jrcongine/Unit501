/* Shared player projection controls. The native select owns selection and game scope. */
(function(root){
  const cards = [
    ['off','Normal','Standard projection.'],
    ['boost','Star Power','Big-game breakout.'],
    ['rivalry','Rivalry Boost','Extra rivalry intensity.'],
    ['early','Early Kickoff Hangover','Early start or heavy travel.'],
    ['defense','Defensive Dogfight','Physical, low-scoring matchup.'],
    ['fatigue','Fatigue Factor','Short rest or heavy workload.']
  ];
  function node(tag,text,cls) {
    const el=document.createElement(tag);
    if(text)el.textContent=text;
    if(cls)el.className=cls;
    return el;
  }
  function showScenarios(map,id,render,name) {
    // The empty key holds an unapplied draft for the next selected player.
    if(id && map.has('')){
      map.set(id,[...new Set([...(map.get(id)||[]),...map.get('')])]);
      map.delete('');
    }
    document.getElementById('scenario-picker').replaceChildren(scenarios(map,id,render,name));
  }
  function scenarios(map,id,render,name) {
    const panel=node('section',null,'scenario-deck');
    panel.id='player-power-controls';
    const selected=map.get(id)||[];
    const delta=Math.round((root.Unit501StarPower.adjust(100,selected).factor-1)*100);
    const bar=node('div',null,'scenario-bar');
    const status=node('span',selected.length+' selected · Combined '+(delta>0?'+':'')+delta+'%');
    status.setAttribute('role','status');
    function update(keys,focus) {
      if(keys.length)map.set(id,keys);else map.delete(id);
      render();
      document.getElementById(focus)?.focus?.({preventScroll:true});
    }
    const reset=node('button','Reset');reset.type='button';reset.id='scenario-reset';
    reset.addEventListener('click',()=>update([],reset.id));
    bar.append(node('strong','Player Scenarios'),node('small',id?'For '+(name||id):'Applies to the next player you choose.'),status,reset);panel.append(bar);
    const grid=node('div',null,'scenario-grid');panel.append(grid);
    for(const [key,title,description] of cards) {
      const label=node('label',null,'scenario-tile');
      const pic=node('img');pic.src='/scenario-art/'+key+'.webp';pic.alt='';
      const pct=Math.round((root.Unit501StarPower.modes[key].factor-1)*100);
      const toggle=node('input');toggle.type='checkbox';toggle.id='scenario-'+key;
      toggle.setAttribute('role','switch');toggle.setAttribute('aria-label',title);
      toggle.checked=key==='off'?!selected.length:selected.includes(key);
      toggle.addEventListener('change',()=>update(key==='off'?[]:toggle.checked?
        [...new Set([...selected,key])]:selected.filter(k=>k!==key),toggle.id));
      label.append(pic,node('strong',title),node('b',(pct>0?'+':'')+pct+'%'),node('small',description),toggle);
      grid.append(label);
    }
    return panel;
  }
  const aliases={kennethwalker:['k9','kw3'],lebronjames:['kingjames'],stephencurry:['steph','chefcurry'],kevindurant:['kd'],joshallen:['ja17']};
  const norm=s=>s.toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g,'');
  function teamLabel(name,history) {
    const teams=(history?.teams||[]).filter(team=>team.players?.some(p=>norm(p.name)===norm(name)));
    return teams.length===1&&teams[0].name ? name+' — '+teams[0].name : name;
  }
  function recentRates(cell,line,above,below,games){
    if(!Number.isFinite(line)||!Number.isInteger(games)||games<1||![above,below].every(Number.isInteger)){
      cell.append(node('small','Above/Below unavailable'));return;
    }
    const group=node('div',null,'hit-rates');
    for(const [label,count] of [['Above',above],['Below',below]]){
      const side=node('span');side.append(node('small',label),node('strong',count+'/'+games),node('small',(100*count/games).toFixed(1)+'%'));group.append(side);
    }
    cell.append(group);
    const pushes=games-above-below;
    if(pushes)cell.append(node('small',pushes+' push'+(pushes===1?'':'es'),'push-count'));
  }
  const columns=['Player / Team','Stat','Games','FanDuel Line','Projection','Difference','Last vs Opponent','Above / Below'];
  function sortMode(control){
    return ({most:'above-desc',least:'below-desc'})[control.value]||control.value||'';
  }
  function columnHeader(label,control){
    const cell=node('th',label);cell.scope='col';
    if(label!=='Above / Below'||!control)return cell;
    cell.className='hit-sort-header';
    const buttons=node('div',null,'hit-sort-buttons'),mode=sortMode(control);
    for(const side of ['above','below']){
      const active=mode.startsWith(side+'-'),ascending=active&&mode.endsWith('-asc');
      const next=side+(active&&!ascending?'-asc':'-desc');
      const title=side==='above'?'Above':'Below';
      const button=node('button',title+' '+(active?(ascending?'↑':'↓'):'↕'));
      button.type='button';button.setAttribute('aria-label','Sort '+title+' percentage '+(next.endsWith('asc')?'lowest':'highest')+' first');
      button.setAttribute('aria-pressed',String(active));
      button.addEventListener('click',()=>{
        control.value=control.id==='prop-filter-sort'?next:({'above-desc':'most','below-desc':'least'})[next]||next;
        control.dispatchEvent(new Event('change'));
      });
      buttons.append(button);
    }
    cell.append(buttons);return cell;
  }
  function boardHeader(header,control){
    for(const label of columns)header.append(columnHeader(label,control));
  }
  function boardRow(row,player,market,games,line,projection,difference,last,rates){
    const values=[player,market,games,line,projection,difference,last,rates];
    row.addEventListener('click',event=>{
      if(event.target.closest('button,input,label,a,select,details'))return;
      row.querySelector('.player-link')?.click();
    });
    values.forEach((value,i)=>{
      const cell=node('td');cell.setAttribute('data-label',columns[i]);
      if(value&&typeof value==='object')cell.append(value);else cell.textContent=String(value??'—');
      row.append(cell);
    });
  }
  function selectPlayer(select,value){
    select.value=value;select.dispatchEvent(new Event('change'));
  }
  function playerLink(select,value,label){
    const button=node('button',label,'player-link');button.type='button';
    button.addEventListener('click',()=>selectPlayer(select,value));return button;
  }
  function profile(select,label,context,logo){
    const hero=node('header',null,'player-profile');
    if(logo){const img=node('img');img.src=logo;img.alt='';hero.append(img);}
    const text=node('div');text.append(node('small','UNIT 501   /   PLAYER PROJECTIONS'),node('h3',label),node('p',context));
    hero.append(text,playerLink(select,'','← All Players'));return hero;
  }
  function matchupBanner(away,home,awayLogo,homeLogo){
    const banner=node('section',null,'board-matchup');
    banner.append(node('small','UNIT 501  /  PLAYER MARKETS'));
    const line=node('div');
    for(const [name,logo] of [[away,awayLogo],[home,homeLogo]]){
      if(line.children.length)line.append(node('small','at','matchup-at'));
      const side=node('span',null,'matchup-side');
      if(logo){const img=node('img');img.src=logo;img.alt='';side.append(img);}
      side.append(node('strong',name));line.append(side);
    }
    banner.append(line);return banner;
  }
  function availabilitySummary(select,players,teams,open){
    const panel=node('details',null,'market-availability');panel.open=open;
    const summary=node('summary');summary.append(node('strong','Player availability'),node('span',players.length+' with projections withheld'));
    panel.append(summary);
    const groups=node('div',null,'availability-teams');
    for(const team of teams){
      const roster=players.filter(p=>p.record.teamId===team.id);
      if(!roster.length)continue;
      const section=node('section');section.append(node('h4',team.name));
      for(const {record,status} of roster){
        const row=node('div',null,'availability-player');
        row.append(playerLink(select,record.id,record.name),node('span',status));
        section.append(row);
      }
      groups.append(section);
    }
    panel.append(groups);return panel;
  }
  const photoRequests=new Map();
  function showPortrait(hero,identity){
    if(!identity?.team||!identity.name||typeof Image==='undefined')return;
    const query=new URLSearchParams(identity).toString();
    let request=photoRequests.get(query);
    if(!request){
      request=fetch('/api/player-portrait?'+query,{signal:AbortSignal.timeout(17000)}).then(async r=>{
        if(!r.ok)throw Error();return (await r.json()).portrait?.url;
      }).catch(()=>{photoRequests.delete(query);return null;});
      if(photoRequests.size>=80)photoRequests.delete(photoRequests.keys().next().value);
      photoRequests.set(query,request);
    }
    request.then(url=>{
      if(!url||!hero.isConnected)return;
      const photo=new Image();photo.className='athlete-portrait';photo.alt=identity.name;
      photo.onload=()=>{if(hero.isConnected)hero.prepend(photo);};
      photo.src=url;
    });
  }
  function dashboard(select,name,context,logo,opponentLogo,markets,identity){
    const panel=node('section',null,'athlete-dashboard');
    const hero=profile(select,name,context,logo);
    showPortrait(hero,identity);
    if(opponentLogo){const mark=node('img',null,'opponent-mark');mark.src=opponentLogo;mark.alt='Opponent';hero.append(mark);}
    panel.append(hero);
    const strip=node('div',null,'athlete-summary'),totals=node('section'),tiles=node('div',null,'athlete-tiles');
    totals.append(node('h4','Recorded stats'),tiles);
    const samples=markets.filter(m=>Number.isFinite(m.average)&&m.games>0);
    for(const m of samples.slice(0,4)){
      const tile=node('div');tile.append(node('small',m.stat),node('b',m.average.toFixed(1)),node('small','avg · '+m.games+' GP'));tiles.append(tile);
    }
    if(samples.length)strip.append(totals);
    const recent=markets.find(m=>m.values?.length);
    if(recent){const trend=node('section');trend.append(node('h4',recent.stat+' · last '+Math.min(5,recent.values.length)),chart(recent.values.slice(0,5)));strip.append(trend);}
    if(samples.length||recent)panel.append(strip);
    if(!markets.length)return panel;
    const table=node('table',null,'athlete-markets'),head=node('thead'),titles=node('tr'),body=node('tbody');
    const labels=['Stat','FanDuel line','Projection','Difference','Median','Last vs opponent','Above / Below'];
    const sort=document.getElementById(({'predict-player':'prop-filter-sort','nba-prop-player':'nba-prop-sort','ncaab-prop-player':'ncaab-prop-sort'})[select.id]);
    for(const title of labels)titles.append(columnHeader(title,sort));head.append(titles);table.append(head,body);
    const mode=sort&&sortMode(sort);
    const ranked=/^(above|below)-(asc|desc)$/.test(mode)?[...markets].sort((a,b)=>{
      const priced=Number(Number.isFinite(b.line))-Number(Number.isFinite(a.line));
      return priced||byHitRate(a,b,mode==='above-desc'?'most':mode);
    }):markets;
    for(const m of ranked){
      const row=node('tr'),projection=Number.isFinite(m.projection)?Number(m.projection.toFixed(1)):null;
      const diff=projection!==null&&Number.isFinite(m.line)?Number((projection-m.line).toFixed(1)):null;
      const fields=[m.stat,m.line==null?'Unavailable':String(m.line)+(m.manual?' (manual)':''),projection??'—',diff===null?'—':diff===0?'Equal':Math.abs(diff)+' '+(diff>0?'above':'below'),Number.isFinite(m.median)?Number(m.median.toFixed(1)):'—',m.last||'Unavailable'];
      fields.forEach((value,i)=>{const cell=node('td',String(value));cell.setAttribute('data-label',labels[i]);row.append(cell);});
      const rates=node('td');rates.setAttribute('data-label',labels[6]);recentRates(rates,m.line,m.above,m.below,m.games);row.append(rates);body.append(row);
    }
    panel.append(table);return panel;
  }
  function research(label,content){
    const details=node('details',null,'profile-research');details.append(node('summary',label),content);return details;
  }
  function basketballDashboard(select,name,history,game,rows){
    const logo=basketballLogo(name,history,game);
    const teams=(history?.teams||[]).filter(t=>t.players?.some(p=>norm(p.name)===norm(name)));
    const identity=teams.length===1?{team:teams[0].name,name,league:select.id==='nba-prop-player'?'nba':'cbb'}:null;
    const opponentLogo=logo===game.awayLogo?game.homeLogo:logo===game.homeLogo?game.awayLogo:null;
    return dashboard(select,teamLabel(name,history),game.away+' vs '+game.home,logo,logo?opponentLogo:null,
      rows.map(({quote,p})=>({...p,stat:quote.label,line:quote.line,values:p.recentValues,last:root.Unit501LastOpponent.basketball(history,quote,game)})),identity);
  }
  function chart(values){
    const figure=node('figure',null,'recent-chart');
    if(!values?.length)return figure;
    figure.append(node('figcaption','Recent games · newest first'));
    const bars=node('div'),max=Math.max(1,...values.map(Math.abs));
    for(const value of values){const bar=node('span');const meter=node('meter');meter.min=0;meter.max=max;meter.value=Math.abs(value);
      bar.setAttribute('style','--observed-height:'+Math.round(100*Math.abs(value)/max)+'%');
      meter.setAttribute('aria-label',String(value));bar.append(node('b',String(value)),meter);bars.append(bar);}
    figure.append(bars);return figure;
  }
  function basketballLogo(name,history,game){
    const teams=(history?.teams||[]).filter(t=>t.players?.some(p=>norm(p.name)===norm(name)));
    if(teams.length!==1)return null;
    const id=teams[0].selectedTeamId??teams[0].id;
    if(id==null)return null;
    return String(id)===String(game.awayId)?game.awayLogo:String(id)===String(game.homeId)?game.homeLogo:null;
  }
  function byHitRate(a,b,mode){
    const side=mode==='most'||mode==='above-asc'?'above':'below';
    const valid=r=>r.games>0&&Number.isInteger(r[side]);
    if(!valid(a)||!valid(b))return Number(valid(b))-Number(valid(a));
    const compare=a[side]*b.games-b[side]*a.games;
    return (mode.endsWith('-asc')?compare:-compare)||b.games-a.games;
  }
  function basketballRow(row,select,quote,prediction,status,history,game){
    const identity=node('div');
    const logo=basketballLogo(quote.name,history,game);
    if(logo){const img=node('img');img.src=logo;img.alt='';identity.append(img);}
    identity.append(playerLink(select,quote.name,teamLabel(quote.name,history)));
    if(!/^(active|available)$/i.test(status||''))identity.append(node('small','· '+(status?status.toUpperCase():'Availability unconfirmed'),'availability-flag'));
    const rates=node('div');recentRates(rates,quote.line,prediction.above,prediction.below,prediction.games);
    const projected=prediction.available?prediction.projection.toFixed(1):null;
    const gap=projected!==null&&Number.isFinite(quote.line)?Number((projected-quote.line).toFixed(1)):null;
    boardRow(row,identity,quote.label,prediction.games,quote.line??'Line unavailable',projected??prediction.reason,
      gap===null?'—':gap===0?'Equal':Math.abs(gap)+' '+(gap>0?'above':'below'),root.Unit501LastOpponent.basketball(history,quote,game),rates);
  }
  function playerMenu(select) {
    if(!select || typeof MutationObserver==='undefined')return;
    const menu=node('details',null,'player-menu'),title=node('summary'),list=node('div',null,'player-options');
    const count=node('small',null,'player-count');
    const search=node('input');search.type='search';search.placeholder='Search name or nickname';search.setAttribute('aria-label',search.placeholder);
    const back=node('button','← Back to All Players','all-players-back');back.type='button';
    back.addEventListener('click',()=>{
      menu.open=false;selectPlayer(select,'');title.focus({preventScroll:true});
      title.scrollIntoView({block:'nearest'});
    });
    function sync(){back.hidden=!select.value;title.textContent='Player · '+(select.selectedOptions[0]?.textContent||'All Players');}
    function draw(){
      list.replaceChildren();
      let shown=0;
      for(const option of select.options){
        const name=norm(option.textContent),q=norm(search.value);
        if(!name.includes(q)&&!Object.entries(aliases).some(([full,aka])=>name.includes(full)&&aka.some(a=>a.includes(q))))continue;
        const item=node('button',option.textContent.split(' — ').slice(0,2).join(' — '));if(option.value)shown++;item.type='button';
        item.addEventListener('click',()=>{select.value=option.value;menu.open=false;select.dispatchEvent(new Event('change'));sync();title.focus();});
        list.append(item);
      }
      const total=Array.from(select.options).filter(option=>option.value).length;
      count.textContent=shown+' of '+total+' players';
      if(!list.children.length)list.append(node('small','No matching players'));
    }
    menu.addEventListener('toggle',()=>{if(menu.open){search.value='';draw();search.focus();}});
    menu.addEventListener('keydown',e=>{if(e.key==='Escape'){menu.open=false;title.focus();}});
    search.addEventListener('input',draw);menu.append(title,search,count,list);
    select.before(back,menu);select.hidden=true;select.addEventListener('change',sync);
    new MutationObserver(()=>{sync();if(menu.open)draw();}).observe(select,{subtree:true,childList:true,attributes:true});sync();
  }
  root.Unit501PlayerControls={scenarios,showScenarios,playerMenu,teamLabel,recentRates,boardHeader,boardRow,playerLink,profile,matchupBanner,availabilitySummary,dashboard,research,basketballDashboard,chart,basketballRow,basketballLogo,byHitRate};
})(typeof window==='undefined'?globalThis:window);
