(function(){
  'use strict';
  const byId=id=>document.getElementById(id);
  const bets=byId('war-money-bets'),money=byId('war-money-dollars'),result=byId('war-money-result'),selection=byId('war-money-selection');
  if(!bets||!money||!result||!selection)return;
  function update(){
    if(!bets.value.trim()||!money.value.trim()){
      result.textContent='Enter both percentages to compare. Missing money data is unknown, not zero.';return;
    }
    const b=Number(bets.value),m=Number(money.value);
    if(!Number.isFinite(b)||!Number.isFinite(m)||b<0||b>100||m<0||m>100){result.textContent='Enter percentages from 0 to 100.';return;}
    const gap=Math.round((m-b)*10)/10;
    result.textContent=(selection.value.trim()?selection.value.trim()+' — ':'')+'Manual comparison: '+b+'% of tickets / '+m+'% of money • '+(gap>0?'+':'')+gap+' percentage points. '+(gap>0?'Dollar share exceeds ticket share.':gap<0?'Ticket share exceeds dollar share.':'Ticket and dollar shares are equal.');
  }
  for(const field of [bets,money,selection])field.addEventListener('input',update);
  byId('war-money-clear').addEventListener('click',()=>{bets.value='';money.value='';selection.value='';update();});
})();
