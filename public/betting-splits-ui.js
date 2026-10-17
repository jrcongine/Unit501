(()=>{
 'use strict';
 const panel=document.getElementById('betting-splits-panel'),body=document.getElementById('betting-splits-body'),status=document.getElementById('betting-splits-status');
 let game=null,report=null,version=0;
 const node=(tag,text)=>{const n=document.createElement(tag);n.textContent=text;return n;};
 const invalidate=()=>{invalidateSimulation();};
 const signed=value=>Number.isFinite(value)?(value>0?'+':'')+value:'—';
 function render(){
  body.replaceChildren();if(!game)return;
  body.append(node('h3',game.a+' @ '+game.h));
  const quotes=typeof gameQuotes!=='undefined'&&gameQuotes?.game===game?gameQuotes.data:null;
  const wrap=node('div','');wrap.className='splits-scroll';
  const table=node('table','');table.className='splits-table';
  const head=node('tr','');['Market / team','Line','Bets %','Money %','Gap'].forEach(s=>head.append(node('th',s)));table.append(head);
  for(const [market,title,sides] of [['moneyline','Moneyline',['away','home']],['spread','Spread',['away','home']],['total','Total',['over','under']]]){
   const section=node('tr','');section.className='splits-market';const heading=node('th',title);heading.colSpan=5;section.append(heading);table.append(section);
   for(const side of sides){
    const row=node('tr',''),data=report?.available?report[market]:null;
    const label=side==='away'?game.a:side==='home'?game.h:side==='over'?'Over':'Under';
    row.append(node('th',label));
    let line=data?.[side+'Line'],fallback=false;
    if(!Number.isFinite(line)&&quotes){line=market==='spread'?(Number.isFinite(quotes.awaySpread)?(side==='away'?quotes.awaySpread:-quotes.awaySpread):null):market==='total'?quotes.total:null;fallback=Number.isFinite(line);}
    const cell=node('td',market==='total'?(Number.isFinite(line)?String(line):'—'):signed(line));
    if(fallback){cell.append(node('small','FanDuel'));}row.append(cell);
    const bets=data?.[side+'Bets'],money=data?.[side+'Money'];
    for(const [value,kind] of [[bets,'bets'],[money,'money']]){
     const td=node('td','');if(Number.isFinite(value)&&value>=0&&value<=100){const bar=node('span',value+'%');bar.className='splits-bar '+kind;bar.style.setProperty('--fill',value+'%');td.append(bar);}else td.textContent='—';row.append(td);
    }
    const gap=Number.isFinite(bets)&&Number.isFinite(money)?Math.round((money-bets)*10)/10:null;
    const delta=node('td',gap===null?'—':signed(gap)+' pp');delta.title='Money percentage minus bet percentage';if(gap>=10)delta.className='splits-gap';row.append(delta);table.append(row);
   }
  }
  wrap.append(table);body.append(wrap);
  if(report?.available){
   const source=node('p',report.source+' · '+new Date(report.fetchedAt).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'}));source.className='splits-caption';body.append(source);
   if(report.url){const link=node('a','Source');link.href=report.url;link.target='_blank';link.rel='noopener noreferrer';source.append(document.createTextNode(' · '),link);}
  }
  status.textContent=report?.available?'Bets = wagers. Money = dollars. Gap is not proof of sharp bets.':report?'Betting percentages unavailable for this game.':'Loading betting percentages…';
 }
 async function load(){
  const task=++version;game=selected;report=null;body.replaceChildren();panel.classList.toggle('hidden',!game);document.getElementById('splits-manual').reset();
  if(!game)return;
  render();
  const current=game;status.textContent='Loading splits…';
  try{const q=new URLSearchParams({game:game.id,league:game.league,season:game.season,kickoff:game.kickoff,away:game.a,home:game.h});
   const r=await fetch('/api/betting-splits?'+q,{signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error();const d=await r.json();if(task!==version||current!==selected)return;report=d;
  }catch{if(task!==version)return;report={available:false,message:'Splits unavailable. Enter sourced numbers below.'};}
  render();invalidate();
 }
 window.Unit501BettingSplits={snapshot:()=>game===selected?report:null};
 document.getElementById('refresh-splits').onclick=load;
 document.getElementById('use-betting-splits').onchange=invalidate;
 document.getElementById('spread').addEventListener('input',()=>{if(game===selected)render();});
 document.getElementById('splits-manual').onsubmit=e=>{
  e.preventDefault();if(!game||game!==selected)return;
  const form=e.currentTarget,values=new FormData(form),source=String(values.get('source')).trim(),sourceAt=new Date(values.get('time')).getTime(),now=Date.now();
  const bets=Number(values.get('bets')),money=Number(values.get('money')),line=Number(values.get('line'));
  if(!source||![bets,money,line,sourceAt].every(Number.isFinite)||bets<0||bets>100||money<0||money>100||!Number.isInteger(line*2)||sourceAt>now||now-sourceAt>1800000){status.textContent='Use valid percentages, a source, and its update time within 30 minutes.';return;}
  report={available:true,gameId:String(game.id),league:game.league,season:game.season,kickoff:game.kickoff,fetchedAt:now,sourceAt,source:'Entered: '+source,sharpVerified:false,spread:{awayLine:line,homeLine:-line,awayBets:bets,homeBets:100-bets,awayMoney:money,homeMoney:100-money}};
  render();invalidate();
 };
 document.addEventListener('unit501:selection-changed',load);
 document.addEventListener('unit501:odds-updated',()=>{if(game===selected)render();});
 for(const id of ['spread','total'])document.getElementById(id).addEventListener('input',()=>{if(game===selected)render();});
})();
