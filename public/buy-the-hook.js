(function(root){
 'use strict';
 const signed=n=>n>0?'+'+n:String(n);
 const profit=price=>price>0?price/10:1000/-price;
 function describe(q,league){
  const margin=-Math.floor(q.better),result=n=>margin+n===0?'push':margin+n>0?'win':'loss';
  const finish=margin===0?'With a tied final':'If '+q.team+(margin>0?' wins':' loses')+' by '+Math.abs(margin);
  return [q.team+' '+signed(q.line)+' ('+signed(q.price)+') → '+signed(q.better)+' ('+signed(q.alternatePrice)+')',
   'Profit on a winning $10 bet: $'+profit(q.price).toFixed(2)+' → $'+profit(q.alternatePrice).toFixed(2)+'.',
   margin===0&&league!=='1'?'Both lines settle the same on a decided game.':finish+': '+result(q.line)+' → '+result(q.better)+'.'];
 }
 if(typeof module!=='undefined'&&module.exports){module.exports={describe};return;}
 const panel=document.getElementById('hook-tool'),button=document.getElementById('hook-check'),out=document.getElementById('hook-result');
 if(!panel||!button||!out)return;
 let selected=null,serial=0,timer;
 function select(q){serial++;clearTimeout(timer);selected=q;panel.hidden=!q||q.kickoff<=Date.now();button.disabled=false;out.replaceChildren();}
 button.addEventListener('click',async()=>{
  const q=selected;if(!q||Date.now()>=q.kickoff){select(null);return;}
  const task=++serial;clearTimeout(timer);button.disabled=true;out.textContent='Checking FanDuel prices…';
  try{
   const r=await fetch('/api/hook?'+new URLSearchParams(q),{signal:AbortSignal.timeout(25000)});
   if(task!==serial)return;if(!r.ok)throw Error();
   const data=await r.json();if(task!==serial)return;
   const now=Date.now();if(now>=q.kickoff){select(null);return;}
   const quotes=data.quotes.filter(x=>x.updatedAt+1800000>now);
   out.replaceChildren();
   if(!quotes.length){out.textContent='No fresh FanDuel pair for an extra half-point.';return;}
   for(const quote of quotes){const row=document.createElement('p');for(const [i,line] of describe(quote,q.league).entries()){
    const el=document.createElement(i===0?'strong':'span');el.textContent=line;row.append(el);
   }out.append(row);}
   timer=setTimeout(()=>{if(task===serial)out.textContent='Quote expired. Check prices again.';},Math.max(1,Math.min(q.kickoff,...quotes.map(x=>x.updatedAt+1800000))-now));
  }catch{if(task===serial)out.textContent='Couldn’t check FanDuel prices. Try again later.';}
  finally{if(task===serial)button.disabled=false;}
 });
 root.Unit501Hook={select};
})(globalThis);
