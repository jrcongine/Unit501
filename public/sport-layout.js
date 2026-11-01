/* Shared navigation and basketball startup. No automatic matchup/prop requests. */
(function(){
 'use strict';
 const doc=document;
 const picker=doc.querySelector('[data-date-picker]');
 if(picker)picker.addEventListener('click',()=>{
  const field=doc.querySelector('input[type=date]');
  try{field.showPicker();}catch{field.focus();}
 });
 const league=doc.querySelector('.sport-league');
 if(league)league.addEventListener('change',()=>{
  if(!['nba.html','ncaab.html'].includes(league.value))return;
  const date=doc.querySelector('input[type=date]')?.value;
  // Preserve the selected date when moving between basketball leagues.
  const url=new URL(league.value,location.href);
  if(/^\d{4}-\d{2}-\d{2}$/.test(date))url.searchParams.set('date',date);
  location.assign(url.href);
 });
 if(league){
  const date=new URL(location.href).searchParams.get('date'),field=doc.querySelector('input[type=date]');
  if(field&&/^\d{4}-\d{2}-\d{2}$/.test(date||''))field.value=date;
 }
 for(const [selector,label]of [['[data-lab-link]','🎯 Game Lab'],['[data-player-link]','📊 Player props']]){
  const link=doc.querySelector(selector);if(!link)continue;
  const target=doc.querySelector(link.getAttribute('href'));if(!target)continue;
  const sync=()=>{
   const ready=!target.hidden&&!target.classList.contains('hidden');
   link.textContent=label+(ready?'':' · select game');
   link.classList.toggle('is-unavailable',!ready);
   link.setAttribute('aria-disabled',String(!ready));link.tabIndex=ready?0:-1;
  };
  link.addEventListener('click',event=>{if(link.getAttribute('aria-disabled')==='true')event.preventDefault();});
  new MutationObserver(sync).observe(target,{attributes:true,attributeFilter:['class','hidden']});sync();
 }
 // All clients are registered before this final page script runs. Restore the
 // requested date first, then start each independent dashboard feed once.
 if(league){
  const college=league.value==='ncaab.html',prefix=college?'ncaab':'nba';
  window.Unit501LeaguePulse?.show(prefix,false);
  doc.getElementById(prefix+'-load')?.click();
 }
})();

// Native disclosures keep their contents and live updates mounted. Start compact
// on phones, including when a tablet changes orientation across the breakpoint.
(function(){
 if(typeof window.matchMedia!=='function')return;
 const phone=window.matchMedia('(max-width: 700px)');
 const sync=()=>document.querySelectorAll('details.phone-fold').forEach(panel=>{panel.open=!phone.matches;});
 sync();
 phone.addEventListener?.('change',sync);
})();
