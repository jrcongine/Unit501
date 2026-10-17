(()=>{
 'use strict';
 const panel=document.getElementById('betting-splits-panel'),body=document.getElementById('betting-splits-body'),status=document.getElementById('betting-splits-status');
 let game=null,report=null,version=0;
 const node=(tag,text)=>{const n=document.createElement(tag);n.textContent=text;return n;};
 const invalidate=()=>{invalidateSimulation();};
 function render(){
  body.replaceChildren();status.textContent=report?.message||'Loading splits…';
  if(!report?.available)return;
  const table=node('table',''),head=node('tr','');['Spread','Bets','Money'].forEach(s=>head.append(node('th',s)));table.append(head);
  for(const side of ['away','home']){const row=node('tr',''),s=report.spread;const line=s?.[side+'Line'];row.append(node('td',(side==='away'?game.a:game.h)+(Number.isFinite(line)?' '+(line>0?'+':'')+line:'')));
   for(const key of ['Bets','Money'])row.append(node('td',Number.isFinite(s?.[side+key])?s[side+key]+'%':'—'));table.append(row);}
  body.append(table);
  const signal=Unit501BettingSplitsModel.evaluate(report,game,Number(document.getElementById('spread').value),true);
  body.append(node('p','Possible sharp lean: '+(signal.lean?(signal.lean==='away'?game.a:game.h):'None')));
  const source=node('p',report.source+' · fetched '+new Date(report.fetchedAt).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'}));body.append(source);
  if(report.url){const link=node('a','View source');link.href=report.url;link.target='_blank';link.rel='noopener noreferrer';body.append(link);}
  status.textContent=signal.reason;
 }
 async function load(){
  const task=++version;game=selected;report=null;body.replaceChildren();panel.classList.toggle('hidden',!game);document.getElementById('splits-manual').reset();
  if(!game)return;
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
})();
