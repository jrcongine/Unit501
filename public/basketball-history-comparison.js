/* History-only comparisons: entered thresholds are never sportsbook quotes. */
(function(root){
 'use strict';
 const catalog=[['player_points','Points'],['player_rebounds','Rebounds'],['player_assists','Assists'],['player_threes','Threes']];
 function create(id,college=false){
  const container=document.getElementById(id);if(!container)return {update(){}};
  let history=null,game=null,identity='',selected='',market='player_points',threshold='',expanded=false,timer=null;
  const node=(tag,text='')=>{const e=document.createElement(tag);e.textContent=text;return e;};
  function render(){
   clearTimeout(timer);container.replaceChildren();if(!game||!history)return;
   const deadline=Math.min(history.checkedAt+1800001,Date.parse(game.tipoff));
   if(college&&Number.isFinite(deadline)&&deadline>Date.now())timer=setTimeout(render,deadline-Date.now());
   const names=[...new Set((history.teams||[]).flatMap(t=>(t.players||[]).map(p=>p.name)).filter(Boolean))].sort();
   if(!names.length)return;
   const panel=node('details'),title=node('summary','Compare player history — no betting line needed');panel.open=expanded;
   panel.addEventListener('toggle',()=>{expanded=panel.open;});panel.append(title);
   const player=node('select'),stat=node('select'),input=node('input'),result=node('p');result.setAttribute('aria-live','polite');
   const empty=node('option','Choose player');empty.value='';player.append(empty);
   for(const name of names){const o=node('option',name);o.value=name;player.append(o);}player.value=names.includes(selected)?selected:'';
   for(const [key,label] of catalog){const o=node('option',label);o.value=key;stat.append(o);}stat.value=market;
   input.type='number';input.min='0';input.step='0.5';input.value=threshold;input.placeholder='Enter threshold';
   const controls=node('div');controls.className='nba-prop-filters';
   for(const [label,control] of [['Player ',player],['Stat ',stat],['Comparison threshold ',input]]){const wrap=node('label',label);control.setAttribute('aria-label',label.trim());wrap.append(control);controls.append(wrap);}
   panel.append(controls,node('p','Entered threshold · historical results only. This is not a FanDuel line, price, projection, or confirmation of availability.'),result);
   function compare(){
    selected=player.value;market=stat.value;threshold=input.value.trim();
    if(!selected||threshold===''){result.textContent='Choose a player and enter a comparison threshold.';return;}
    const line=Number(threshold);
    if(!Number.isFinite(line)||line<0||!Number.isInteger(line*2)){result.textContent='Use a whole number or half point, zero or higher.';return;}
    // Reuse strict identity, freshness, DNP and missing-stat guards; discard the
    // projection entirely. A current Out status does not erase historical facts.
    const p=root.Unit501NBAPlayerModel.project(history,{name:selected,market,line},game,null,Date.now(),{regulationMinutes:college?40:48});
    result.textContent=p.available?`${p.above} above · ${p.below} below · ${p.equal} equal · ${p.games} verified appearances. DNPs excluded; missing records are not zeros.`:p.reason;
   }
   player.addEventListener('change',compare);stat.addEventListener('change',compare);input.addEventListener('input',compare);compare();container.append(panel);
  }
  return {update(nextHistory,nextGame){const next=nextGame?String(nextGame.id)+'|'+nextGame.tipoff:'';if(next!==identity){selected='';market='player_points';threshold='';expanded=false;identity=next;}history=nextHistory;game=nextGame;render();}};
 }
 root.Unit501BasketballHistoryComparison={create};
})(window);
