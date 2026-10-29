(()=>{
 'use strict';
 const panel=document.createElement('section');panel.id='pregame-checks';panel.className='card hidden';
 document.getElementById('player-lab').before(panel);
 const node=(tag,text)=>{const el=document.createElement(tag);el.textContent=text;return el;};let timer,lastSignature='';
 function render(){
  clearTimeout(timer);
  if(!selected){lastSignature='';panel.classList.add('hidden');return;}
  panel.classList.remove('hidden');
  const input=id=>{const value=document.getElementById(id).value;return value.trim()===''?null:Number(value);};
  const report=window.Unit501Pregame.evaluate({game:selected,availability:window.Unit501Availability?.snapshot(),quotes:gameQuotes?.game===selected?gameQuotes.data:null,inputs:{spread:input('spread'),total:input('total')}});
  const signature=JSON.stringify([selected.id,selected.kickoff,report]);
  const schedule=()=>{if(report.active&&!document.hidden)timer=setTimeout(render,Math.min(60000,Math.max(1,selected.kickoff-Date.now())));};
  if(signature===lastSignature){schedule();return;}lastSignature=signature;
  panel.replaceChildren(node('h2','Pregame check'),node('p',report.message));
  if(report.active){
   const list=document.createElement('div');list.className='pregame-grid';
   for(const check of report.checks){const card=document.createElement('div');card.className='pregame-check pregame-'+check.status;card.append(node('strong',check.label+' · '+({checked:'Checked',review:'Review',unknown:'Unconfirmed'}[check.status])),node('p',check.message));list.append(card);}
   panel.append(list);
   const actions=document.createElement('div');actions.className='pregame-actions';
   for(const [label,target] of [['Refresh lines','refresh-odds'],['Refresh injuries','refresh-availability']]){
    const button=node('button',label);button.type='button';button.onclick=()=>{const control=document.getElementById(target);if(control&&!control.disabled)control.click();};actions.append(button);
   }
   panel.append(actions,node('p','Rechecked each minute while this page is visible. Reading this checklist uses no extra API requests. Refresh buttons use the existing feeds and caches.'));
   schedule();
  }
 }
 for(const event of ['unit501:selection-changed','unit501:availability-updated','unit501:odds-updated','visibilitychange'])document.addEventListener(event,render);
 for(const id of ['spread','total'])document.getElementById(id).addEventListener('input',render);
 render();
})();
