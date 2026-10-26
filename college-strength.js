'use strict';
// Display-only FBS results ranking. It never feeds scoring, odds or player props.
const membership=require('./fbs-2026.json');
const {fbsName}=require('./team-identity');
const logistic=x=>1/(1+Math.exp(-x));
const points=value=>typeof value==='string'&&/^\d+$/.test(value)?Number(value):value;
const fail=reason=>({available:false,reason});
function solve(matrix,b){
 const n=b.length,L=Array.from({length:n},()=>new Float64Array(n));
 for(let i=0;i<n;i++)for(let j=0;j<=i;j++){
  let value=matrix[i][j];for(let k=0;k<j;k++)value-=L[i][k]*L[j][k];
  if(i===j){if(!(value>0))return null;L[i][j]=Math.sqrt(value);}else L[i][j]=value/L[j][j];
 }
 const y=new Float64Array(n),x=new Float64Array(n);
 for(let i=0;i<n;i++){let v=b[i];for(let j=0;j<i;j++)v-=L[i][j]*y[j];y[i]=v/L[i][i];}
 for(let i=n-1;i>=0;i--){let v=y[i];for(let j=i+1;j<n;j++)v-=L[j][i]*x[j];x[i]=v/L[i][i];}
 return [...x];
}
// Ridge Bradley–Terry: equal zero priors, no school/conference/poll offsets.
// Penalty 1 is an explicit experimental assumption, not a tuned parameter.
function fit(games,count){
 let rating=Array(count).fill(0);
 const objective=r=>r.reduce((s,x)=>s+x*x/2,0)+games.reduce((s,g)=>{
  const z=r[g.a]-r[g.b];return s+Math.max(z,0)+Math.log1p(Math.exp(-Math.abs(z)))-g.y*z;
 },0);
 for(let iteration=0;iteration<30;iteration++){
  const gradient=[...rating],hessian=Array.from({length:count},(_,i)=>Array.from({length:count},(_,j)=>i===j?1:0));
  for(const g of games){
   const p=logistic(rating[g.a]-rating[g.b]),d=p-g.y,w=p*(1-p);
   gradient[g.a]+=d;gradient[g.b]-=d;
   hessian[g.a][g.a]+=w;hessian[g.b][g.b]+=w;hessian[g.a][g.b]-=w;hessian[g.b][g.a]-=w;
  }
  if(Math.max(...gradient.map(Math.abs))<1e-8)return rating;
  const delta=solve(hessian,gradient);if(!delta)return null;
  const old=objective(rating);let step=1,accepted=false;
  for(let k=0;k<25;k++,step/=2){
   const next=rating.map((x,i)=>x-step*delta[i]);
   if(objective(next)<=old+1e-12){rating=next;accepted=true;break;}
  }
  if(!accepted)return null;
 }
 return null;
}
function buildCollegeStrength(board,payload,at){
 if(board?.league!=='ncaaf'||String(board.season)!==membership.season||!Number.isFinite(at)||
  !Array.isArray(board.teams)||board.teams.length!==membership.teams.length)return fail('Verified current-season FBS standings are required.');
 if(!Array.isArray(payload?.response)||(payload.errors&&Object.keys(payload.errors).length)||Number(payload.paging?.total||1)>1)
  return fail('Complete college season results are unavailable.');
 const teams=[...board.teams].sort((a,b)=>a.name.localeCompare(b.name));
 const index=new Map(teams.map((t,i)=>[t.name,i]));
 if(index.size!==teams.length||membership.teams.some(t=>!index.has(t.name)))return fail('FBS membership does not match the verified season.');
 const totals=teams.map(()=>({games:0,wins:0,losses:0,diff:0,pointsFor:0,pointsAgainst:0,fbsGames:0,fbsWins:0,opponents:[]}));
 const games=[],seen=new Map();
 if(payload.response.length>5000)return fail('The returned season schedule is unexpectedly large.');
 for(const raw of payload.response){
  if(String(raw?.league?.id)!=='2'||String(raw.league.season)!==String(board.season))continue;
  const kickoff=Number(raw.game?.date?.timestamp)*1000;
  if(!['FT','AOT','FINAL'].includes(String(raw.game?.status?.short).toUpperCase())||!(kickoff>0)||kickoff>=at)continue;
  const away=raw.teams?.away||raw.teams?.visitors,home=raw.teams?.home;
  const a=index.get(fbsName(away,board.season)),b=index.get(fbsName(home,board.season));
  if(a===undefined&&b===undefined)continue;
  const id=String(raw.game?.id||''),sa=points(raw.scores?.away?.total),sh=points(raw.scores?.home?.total);
  if(!/^\d+$/.test(id)||!away?.id||!home?.id||String(away.id)===String(home.id)||
   ![sa,sh].every(s=>Number.isInteger(s)&&s>=0&&s<=200)||sa===sh||a===b)
   return fail('A completed college result has invalid identity or scores.');
  const signature=JSON.stringify([kickoff,String(away.id),String(home.id),a,b,sa,sh]);
  if(seen.has(id)){if(seen.get(id)!==signature)return fail('Conflicting completed-game records were returned.');continue;}
  seen.set(id,signature);
  for(const [i,own,other] of [[a,sa,sh],[b,sh,sa]])if(i!==undefined){
   const t=totals[i];t.games++;t.wins+=own>other?1:0;t.losses+=own<other?1:0;t.diff+=own-other;t.pointsFor+=own;t.pointsAgainst+=other;
  }
  // FCS games remain in the displayed overall record, but are excluded from
  // the FBS strength graph; no guessed FCS rating is assigned.
  if(a!==undefined&&b!==undefined){
   games.push({a,b,y:sa>sh?1:0});
   totals[a].fbsGames++;totals[b].fbsGames++;
   totals[a].fbsWins+=sa>sh?1:0;totals[b].fbsWins+=sh>sa?1:0;
   totals[a].opponents.push(b);totals[b].opponents.push(a);
  }
 }
 for(let i=0;i<teams.length;i++){
  const t=totals[i],expected=teams[i];
  if(t.games!==expected.games||t.wins!==expected.wins||t.losses!==expected.losses||t.diff!==expected.diff||t.pointsFor!==expected.pointsFor||t.pointsAgainst!==expected.pointsAgainst)
   return fail('Season results and standings do not yet agree for '+expected.name+'. No schedule adjustment applied.');
  if(t.fbsGames<2)return fail('Every FBS team needs at least two completed FBS games before a national schedule-adjusted board is available.');
 }
 const reached=new Set([0]),queue=[0];
 for(let k=0;k<queue.length;k++)for(const other of totals[queue[k]].opponents)if(!reached.has(other)){reached.add(other);queue.push(other);}
 if(reached.size!==teams.length)return fail('The completed FBS schedule is not yet connected across all teams.');
 games.sort((a,b)=>a.a-b.a||a.b-b.b||a.y-b.y);
 for(const team of totals)team.opponents.sort((a,b)=>a-b);
 const rating=fit(games,teams.length);if(!rating||!rating.every(Number.isFinite))return fail('The college strength calculation did not converge.');
 const opponents=totals.map(t=>t.opponents.reduce((s,j)=>s+rating[j],0)/t.fbsGames);
 const sos=[...opponents.keys()].sort((a,b)=>opponents[b]-opponents[a]||teams[a].name.localeCompare(teams[b].name));
 const sosRanks=Array(teams.length);sos.forEach((i,k)=>{sosRanks[i]=k&&Math.abs(opponents[i]-opponents[sos[k-1]])<1e-9?sosRanks[sos[k-1]]:k+1;});
 const sorted=teams.map((team,i)=>({...team,score:+(100*logistic(rating[i])).toFixed(1),strength:rating[i],
  fbsGames:totals[i].fbsGames,fbsRecord:totals[i].fbsWins+'-'+(totals[i].fbsGames-totals[i].fbsWins),
  excludedFCS:totals[i].games-totals[i].fbsGames,scheduleRank:sosRanks[i],opponentStrength:opponents[i]}))
  .sort((a,b)=>Math.abs(b.strength-a.strength)>1e-9?b.strength-a.strength:a.name.localeCompare(b.name));
 sorted.forEach((t,i)=>t.rank=i+1);
 return {available:true,board:{...board,teams:sorted,top:sorted.slice(0,10),middle:sorted.slice(10,-10),bottom:sorted.slice(-10),
  asOf:new Date(at).toISOString(),source:'API-Sports / ESPN',provider:'API-Sports results / ESPN standings',
  metric:'Experimental FBS schedule-adjusted results index · ridge Bradley–Terry; penalty 1',
  explanation:'FBS wins and losses adjusted for opponent strength. All teams start equally; no scoring-margin bonus. FCS games are excluded from the rating, but included in the overall record shown. Schedule #1 means the strongest played FBS opponents. The 0–100 index is not a win probability; injuries and home-field advantage are not modeled.',
  basis:'Schedule-adjusted FBS results; current season only, display only, not a betting projection.',
  scheduleAdjustment:{applied:true,modelVersion:'fbs-results-bt-ridge-v1',penalty:1,games:games.length,teams:teams.length,
   warning:'Experimental descriptive results ranking. Current-season schedule completeness is checked against standings; future predictive accuracy is unvalidated.'}}};
}
module.exports={buildCollegeStrength,fit};
