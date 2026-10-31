/* Optional automatic matchup prep reuses existing feeds; it never casts votes or places wagers. */
(()=>{
 'use strict';
 const lab=document.getElementById('lab'),matchup=document.getElementById('matchup');
 if(!lab||!matchup)return;
 const panel=document.createElement('section');
 panel.id='matchup-auto-prep';
 panel.style.cssText='margin:12px 0;padding:12px;border:1px solid #354057;border-radius:10px';
 const heading=document.createElement('strong');heading.textContent='Automatic game prep';
 const autoLabel=document.createElement('label');
 const automatic=document.createElement('input');automatic.type='checkbox';automatic.checked=true;automatic.id='auto-prep-enabled';
 autoLabel.append(automatic,' Prepare projections and simulation when I select a game');
 const ratingsLabel=document.createElement('label');
 const ratings=document.createElement('input');ratings.type='checkbox';ratings.checked=false;ratings.id='auto-prep-ratings';
 ratingsLabel.append(ratings,' Build Full League Rankings');
 const start=document.createElement('button');start.type='button';start.id='auto-prep-now';start.textContent='Prepare selected game now';
 const status=document.createElement('p');status.id='auto-prep-status';status.setAttribute('role','status');
 const help=document.createElement('p');help.textContent='FanDuel lines, team context, injury reports and weather already refresh on game selection. Prep also starts player projections and runs Game Lab once current lines, scoring and supported injury context are ready. If feeds are missing it waits rather than inventing inputs. No picks are selected or bets placed.';
 panel.append(heading,autoLabel,ratingsLabel,start,status);matchup.after(panel);
 let token=0,prepared=null,simulated=null,ratingStarted=null,edited=false;
 function preserveEdits(event){if(event.target===automatic||event.target===ratings)return;edited=true;status.textContent='Inputs changed. Run Game Lab when ready, or choose Prepare selected game now.';}
 lab.addEventListener('input',preserveEdits);
 lab.addEventListener('change',preserveEdits);
 const current=()=>typeof selected!=='undefined'?selected:null;
 function maybeSim(){
  const game=current();
  if(!game||game!==prepared||simulated===game||edited)return;
  const scoring=typeof scoringContext!=='undefined'&&scoringContext?.game===game;
  const odds=typeof gameQuotes!=='undefined'&&gameQuotes?.game===game;
  const spread=document.getElementById('spread').value,total=document.getElementById('total').value;
  if(!scoring||!odds||spread===''||total===''||!Number.isFinite(Number(spread))||
     !Number.isFinite(Number(total))||Number(total)<=0){
   status.textContent='Preparing: waiting for scored teams and live FanDuel spread/total. Manual Run remains available.';
   return;
  }
  const auto=document.getElementById('autoInjuries');
  if(['1','2'].includes(game.league)&&auto?.checked){
   const review=window.Unit501AutoInjury?.evaluate(window.Unit501Availability?.snapshot(),game,window.Unit501Lineups?.evaluate(),Date.now(),scoringContext.data);
   if(!review?.ready){
    status.textContent='Preparing: waiting for fresh, matching '+(game.league==='1'?'NFL':'college')+' roster, player roles and official reports for both teams.';
    return;
   }
  }
  if(document.getElementById('weatherEnabled')?.checked &&
     (typeof forecastContext==='undefined'||forecastContext?.game!==game||!forecastContext.settled)){
   status.textContent='Preparing: waiting for the stadium weather check.';return;
  }
  // Never overwrite a simulation after the user began editing/choosing other scenarios.
  if(sim()===true){
   simulated=game;
   status.textContent='Game prep ready: simulation completed. Weather and injury coverage are shown with the result.';
  }else status.textContent='Game prep is waiting for usable model inputs. See the Game Lab message.';
 }
 function prepare(game,includeRatings){
  if(!game||current()!==game)return;
  prepared=game;simulated=null;edited=false;
  status.textContent='Preparing player projections and existing live feeds…';
  const predict=document.getElementById('predict');
  if(predict&&!predict.disabled)predict.dispatchEvent(new Event('click'));
  if(includeRatings&&game.league==='1'&&ratingStarted!==game){
   const button=document.getElementById('build-player-ratings');
   if(button&&!button.disabled){ratingStarted=game;button.click();}
  }
  maybeSim();
 }
 function delayedPrepare(){
  const game=current(),ticket=++token;prepared=null;simulated=null;ratingStarted=null;
  if(!game||!automatic.checked){status.textContent='Automatic prep paused. Select Prepare selected game now to run it manually.';return;}
  // Selection events fire before Game Lab inputs and independent feed requests are initialized.
  setTimeout(()=>{if(ticket===token&&current()===game&&automatic.checked)prepare(game,ratings.checked);},0);
 }
 document.addEventListener('unit501:selection-changed',delayedPrepare);
 document.addEventListener('unit501:simulation-invalidated',()=>{
  if(current()&&current()===prepared){
   simulated=null;
   status.textContent='Simulation needs rerunning. Inputs or supporting data changed; see the Game Lab message.';
  }
 });
 document.addEventListener('unit501:simulation-completed',()=>{
  if(current()&&current()===prepared){
   simulated=current();
   status.textContent='Game prep ready: simulation completed. Weather and injury coverage are shown with the result.';
  }
 });
 for(const event of ['unit501:team-context-updated','unit501:availability-updated','unit501:odds-updated','unit501:weather-updated','unit501:lineup-updated'])
  document.addEventListener(event,maybeSim);
 start.addEventListener('click',()=>{const game=current();if(!game){status.textContent='Select a game first.';return;}prepare(game,ratings.checked);});
 automatic.addEventListener('change',()=>{
  if(automatic.checked)delayedPrepare();
  else{prepared=null;simulated=null;token++;status.textContent='Automatic game prep off. All existing Game Lab controls still work.';}
 });
 ratings.addEventListener('change',()=>{
  if(ratings.checked&&prepared===current()&&ratingStarted!==prepared){
   const button=document.getElementById('build-player-ratings');
   if(prepared?.league==='1'&&button&&!button.disabled){ratingStarted=prepared;button.click();}
  }
 });
 status.textContent='Choose a matchup to begin automatically.';
})();
