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
  function boardHeader(header){
    for(const label of columns){const cell=node('th',label);cell.scope='col';header.append(cell);}
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
  function chart(values){
    const figure=node('figure',null,'recent-chart');
    if(!values?.length)return figure;
    figure.append(node('figcaption','Recent games · newest first'));
    const bars=node('div'),max=Math.max(1,...values.map(Math.abs));
    for(const value of values){const bar=node('span');const meter=node('meter');meter.min=0;meter.max=max;meter.value=Math.abs(value);
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
    function sync(){title.textContent='Player · '+(select.selectedOptions[0]?.textContent||'All Players');}
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
    select.before(menu);select.hidden=true;select.addEventListener('change',sync);
    new MutationObserver(()=>{sync();if(menu.open)draw();}).observe(select,{subtree:true,childList:true,attributes:true});sync();
  }
  root.Unit501PlayerControls={scenarios,showScenarios,playerMenu,teamLabel,recentRates,boardHeader,boardRow,playerLink,profile,chart,basketballRow,basketballLogo,byHitRate};
})(typeof window==='undefined'?globalThis:window);
