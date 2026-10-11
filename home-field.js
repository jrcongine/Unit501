'use strict';
// Ridge regression: margin = home strength - away strength + home-team advantage.
// Strength is separate by season; home effects shrink toward the existing 2-point prior.
function fitHomeField(games,before){
 const numeric=v=>typeof v==='number'&&Number.isFinite(v);
 const unique=new Map();
 for(const g of games){if(!numeric(g.kickoff)||g.kickoff>=before||g.league!=='1'||g.stage!=='Regular Season'||!['FT','AOT','FINAL'].includes(g.status)||!numeric(g.homeScore)||!numeric(g.awayScore)||g.homeScore<0||g.awayScore<0||g.homeId===g.awayId)continue;
  const key=g.season+':'+g.id;if(unique.has(key)&&JSON.stringify(unique.get(key))!==JSON.stringify(g))throw Error('Conflicting game identity.');unique.set(key,g);}
 const rows=[...unique.values()].sort((a,b)=>a.kickoff-b.kickoff),names=new Map(),venues=new Map();
 for(const g of rows){names.set(g.homeId,g.homeName);names.set(g.awayId,g.awayName);const k=g.season+':'+g.homeId;if(!venues.has(k))venues.set(k,new Map());const v=String(g.venue||'').toLowerCase().replace(/[^a-z0-9]/g,'');if(v)venues.get(k).set(v,(venues.get(k).get(v)||0)+1);}
 if(names.size!==32)throw Error('Complete 32-team NFL pool required.');
 const homeVenue=k=>{const sorted=[...(venues.get(k)||[])].sort((a,b)=>b[1]-a[1]);return sorted[0]?.[1]>=3&&sorted[0][1]>(sorted[1]?.[1]||0)?sorted[0][0]:null;};
 const eligible=rows.filter(g=>{const venue=String(g.venue||'').toLowerCase().replace(/[^a-z0-9]/g,'');return venue&&venue===homeVenue(g.season+':'+g.homeId)&&venue!==homeVenue(g.season+':'+g.awayId);});
 const strength=new Map(),advantages=new Map([...names.keys()].map(id=>[id,2]));
 for(const g of eligible)for(const id of [g.homeId,g.awayId])strength.set(g.season+':'+id,0);
 for(let iteration=0;iteration<400;iteration++){
  for(const k of strength.keys()){
   let sum=0,n=8;
   for(const g of eligible){const h=g.season+':'+g.homeId,a=g.season+':'+g.awayId,y=g.homeScore-g.awayScore;if(h===k){sum+=y+strength.get(a)-advantages.get(g.homeId);n++;}else if(a===k){sum+=strength.get(h)+advantages.get(g.homeId)-y;n++;}}
   strength.set(k,sum/n);
  }
  for(const id of advantages.keys()){
   let sum=40,n=20;for(const g of eligible)if(g.homeId===id){sum+=g.homeScore-g.awayScore-strength.get(g.season+':'+g.homeId)+strength.get(g.season+':'+g.awayId);n++;}
   advantages.set(id,sum/n);
  }
 }
 const teams=[...names].map(([id,name])=>{const homeGames=eligible.filter(g=>g.homeId===id).length,awayGames=eligible.filter(g=>g.awayId===id).length;return {id,name,homeGames,awayGames,available:homeGames>=6&&awayGames>=6,margin:Math.max(0,Math.min(5,advantages.get(id)))};}).sort((a,b)=>b.margin-a.margin||a.id.localeCompare(b.id));
 teams.forEach((t,i)=>{t.rank=i+1;t.margin=Math.round(t.margin*100)/100;});
 return {modelVersion:'home-field-ridge-v1',before,historyThrough:Math.max(...rows.map(g=>g.kickoff)),games:eligible.length,excludedVenueGames:rows.length-eligible.length,teams,method:'Opponent/team strength regression, separate strength by season; 20-game home-effect shrinkage toward 2 points; 8-game strength shrinkage. Home venues inferred from dominant season venue; shared/unknown/alternate venues excluded. Effects bounded 0–5 points. Descriptive estimate, not a crowd-noise or motivation rating.'};
}
module.exports={fitHomeField};
