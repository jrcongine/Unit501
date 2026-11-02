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
  function playerMenu(select) {
    if(!select || typeof MutationObserver==='undefined')return;
    const menu=node('details',null,'player-menu'),title=node('summary'),list=node('div',null,'player-options');
    const search=node('input');search.type='search';search.placeholder='Search name or nickname';search.setAttribute('aria-label',search.placeholder);
    function sync(){title.textContent='Player · '+(select.selectedOptions[0]?.textContent||'All Players');}
    function draw(){
      list.replaceChildren();
      for(const option of select.options){
        const name=norm(option.textContent),q=norm(search.value);
        if(!name.includes(q)&&!Object.entries(aliases).some(([full,aka])=>name.includes(full)&&aka.some(a=>a.includes(q))))continue;
        const item=node('button',option.textContent);item.type='button';
        item.addEventListener('click',()=>{select.value=option.value;menu.open=false;select.dispatchEvent(new Event('change'));sync();title.focus();});
        list.append(item);
      }
      if(!list.children.length)list.append(node('small','No matching players'));
    }
    menu.addEventListener('toggle',()=>{if(menu.open){search.value='';draw();search.focus();}});
    menu.addEventListener('keydown',e=>{if(e.key==='Escape'){menu.open=false;title.focus();}});
    search.addEventListener('input',draw);menu.append(title,search,list);
    select.before(menu);select.hidden=true;select.addEventListener('change',sync);
    new MutationObserver(()=>{sync();if(menu.open)draw();}).observe(select,{subtree:true,childList:true,attributes:true});sync();
  }
  root.Unit501PlayerControls={scenarios,showScenarios,playerMenu,teamLabel};
})(typeof window==='undefined'?globalThis:window);
