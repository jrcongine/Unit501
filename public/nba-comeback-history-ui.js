(function(){
 'use strict';
 // Local-only observational dataset. Missing games, outcomes and odds are never inferred.
 const model=window.Unit501ComebackHistory;
 const shared=window.Unit501SharedUI;
 const list=document.getElementById('nba-comeback-records');
 const summary=document.getElementById('nba-comeback-summary');
 const gradeButton=document.getElementById('nba-comeback-grade');
 const gradeStatus=document.getElementById('nba-comeback-grade-status');
 if(!model||!shared||!list||!summary||!gradeButton||!gradeStatus)return;
 const KEY='unit501:nba-comeback-records:v1';
 const node=(tag,value)=>{const e=document.createElement(tag);e.textContent=String(value);return e;};
 function read(){
  try{
   const parsed=JSON.parse(localStorage.getItem(KEY)||'[]');
   return Array.isArray(parsed)?parsed.filter(r=>r&&Number.isSafeInteger(r.id)&&typeof r.gameDate==='string').slice(-250):[];
  }catch{return [];}
 }
 let records=read();
 function save(){try{localStorage.setItem(KEY,JSON.stringify(records));return true;}catch{return false;}}
 const currency=n=>(n<0?'−':'')+'$'+Math.abs(n).toFixed(2);
 function show(){
  const stats=model.summary(records);
  summary.textContent=stats.observed+' observed first-half leads of 20+ · '+
   stats.graded+' completed · '+stats.recovered+' trailing teams won'+
   (stats.graded?' ('+stats.recoveredPercent+'% of completed)':' (win rate not available yet)')+
   ' · '+stats.pending+' pending. '+
   (stats.priced?stats.priced+' completed games with manually recorded live prices: $5 hypothetical net '+
     currency(stats.paperProfit)+' ('+stats.paperROI+'% ROI on that subset).':
    'No completed observations with recorded live prices; profitability unknown.');
  list.replaceChildren();
  for(const r of [...records].reverse().slice(0,30)){
   const card=node('article','');card.className='nba-comeback-record';
   card.append(node('strong',r.trailing+' trailed '+r.leading+' by '+r.firstDeficit+' in Q'+r.quarter+
    ' · '+r.away+' '+r.triggeredAway+' – '+r.home+' '+r.triggeredHome));
   card.append(node('p','First observed: '+new Date(r.observedAt).toLocaleString()+
    (r.clock?' · '+r.clock+' on game clock':'')+
    ' · '+r.gameDate+' · first detected at '+r.firstDeficit+' down, not necessarily when it first reached 20.'));
   const outcome=r.result==='pending'?'Awaiting verified final score':
    (r.result==='won'?'Comeback WIN':'Comeback LOSS')+
    ' · Final '+r.away+' '+r.finalAway+' – '+r.home+' '+r.finalHome;
   card.append(node('p',outcome));
   if(r.recordedOdds!==null){
    card.append(node('p','Manually entered trailing-team ML '+(r.recordedOdds>0?'+':'')+r.recordedOdds+
     ' · $5 hypothetical '+(r.result==='pending'?'pending':currency(model.paperProfit(r)))+
     ' · NOT a verified available quote or real wager.'));
   }else if(r.result==='pending'&&Date.now()-r.observedAt<=600000){
    const row=node('div','');row.className='nba-comeback-price-input';
    const field=document.createElement('input');field.type='text';field.inputMode='numeric';
    field.placeholder='Live ML e.g. +2500';field.setAttribute('aria-label','Observed live moneyline for '+r.trailing);
    const button=node('button','Record live ML');button.type='button';
    button.addEventListener('click',()=>{
     const value=model.enterPrice(records,r.id,field.value,Date.now());
     if(!value.changed){gradeStatus.textContent='Use valid American odds (for example +2500 or −110) within 10 minutes of the observed alert.';return;}
     records=value.records;save();gradeStatus.textContent='Manual odds recorded for a hypothetical $5 calculation; no wager was placed or verified.';show();
    });
    row.append(field,button);card.append(row);
   }else if(r.recordedOdds===null)card.append(node('p','No recorded live price · not included in paper return.'));
   list.append(card);
  }
 }
 function observe(alert){
  const date=alert?.tipoff?shared.dateCentral(new Date(alert.tipoff)):shared.dateCentral();
  const value=model.add(records,alert,Date.now(),date);
  if(!value.added)return;
  records=value.records;
  if(!save())gradeStatus.textContent='Browser storage unavailable: observation may not survive a page refresh.';
  show();
 }
 async function gradeResults(silent=false){
  const now=Date.now();
  // No reason to load a final before at least 2h45m from tipoff (or detection if tipoff missing).
  const dates=[...new Set(records.filter(r=>r.result==='pending'&&
   now-(r.tipoff?Date.parse(r.tipoff):r.observedAt)>165*60000).map(r=>r.gameDate))].slice(-7);
  if(!dates.length){
   if(!silent)gradeStatus.textContent='No pending games far enough past tipoff to grade yet.';
   return;
  }
  gradeButton.disabled=true;
  if(!silent)gradeStatus.textContent='Checking official NBA final scores…';
  let updates=0,failed=0,checked=0;
  try{
   for(const date of dates){
    try{
     const response=await fetch('/api/nba/games?date='+encodeURIComponent(date),{signal:AbortSignal.timeout(17000)});
     if(!response.ok)throw Error();
     const data=await response.json();
     if(!Array.isArray(data.games))throw Error();
     const graded=model.applyFinals(records,data.games);
     if(graded.changed){
      updates+=records.filter(x=>x.result==='pending').length-
       graded.records.filter(x=>x.result==='pending').length;
      records=graded.records;save();show();
     }
     checked++;
    }catch{failed++;}
   }
   gradeStatus.textContent=updates+' new final result(s) graded · '+checked+' NBA date(s) checked'+
    (failed?' · '+failed+' feed request(s) failed; outcomes left pending.':'')+
    '. No result or betting price is assumed when missing.';
  }finally{gradeButton.disabled=false;}
 }
 window.Unit501ComebackTracker={observe,refresh:()=>gradeResults(false)};
 gradeButton.addEventListener('click',()=>gradeResults(false));
 show();
 if(records.some(r=>r.result==='pending'&&Date.now()-(r.tipoff?Date.parse(r.tipoff):r.observedAt)>165*60000))
  gradeResults(true);
})();