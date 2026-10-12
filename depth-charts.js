'use strict';
const {matchPlayer}=require('./player-name-match');
const domains={
'Arizona Cardinals':'azcardinals.com','Atlanta Falcons':'atlantafalcons.com','Baltimore Ravens':'baltimoreravens.com','Buffalo Bills':'buffalobills.com','Carolina Panthers':'panthers.com','Chicago Bears':'chicagobears.com','Cincinnati Bengals':'bengals.com','Cleveland Browns':'clevelandbrowns.com','Dallas Cowboys':'dallascowboys.com','Denver Broncos':'denverbroncos.com','Detroit Lions':'detroitlions.com','Green Bay Packers':'packers.com','Houston Texans':'houstontexans.com','Indianapolis Colts':'colts.com','Jacksonville Jaguars':'jaguars.com','Kansas City Chiefs':'chiefs.com','Las Vegas Raiders':'raiders.com','Los Angeles Chargers':'chargers.com','Los Angeles Rams':'therams.com','Miami Dolphins':'miamidolphins.com','Minnesota Vikings':'vikings.com','New England Patriots':'patriots.com','New Orleans Saints':'neworleanssaints.com','New York Giants':'giants.com','New York Jets':'newyorkjets.com','Philadelphia Eagles':'philadelphiaeagles.com','Pittsburgh Steelers':'steelers.com','San Francisco 49ers':'49ers.com','Seattle Seahawks':'seahawks.com','Tampa Bay Buccaneers':'buccaneers.com','Tennessee Titans':'tennesseetitans.com','Washington Commanders':'commanders.com'};
const text=s=>String(s||'').replace(/<[^>]*>/g,' ').replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16))).replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n))).replace(/&amp;/g,'&').replace(/&nbsp;/g,' ').replace(/&apos;/g,"'").replace(/\s+/g,' ').trim();
const key=s=>text(s).toLowerCase().replace(/[^a-z0-9]/g,'');
function parseDepth(html){
 const rows=[];let slot=0;
 for(const table of html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)){
  if(!/depthchart|1st String|Position/i.test(table[0]))continue;
  for(const tr of table[1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)){
   const cells=[...tr[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(m=>m[1]);
   const position=text(cells[0]);if(!/^[A-Z]{1,5}$/.test(position)||cells.length<2)continue;
   const slotId=position+':'+slot++;
   for(let i=1;i<cells.length;i++){
    const links=[...cells[i].matchAll(/<a\b[^>]*href=["'][^"']*players-roster[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi)];
    // Shared slots and unrecognized cells are not guessed into a single player.
    if(links.length>1){rows.push({name:links.map(link=>text(link[1])).join(' / '),names:links.map(link=>text(link[1])),position,rank:i,slot:slotId,unresolved:true,reason:'Shared depth slot; individual workload is unconfirmed.'});continue;}
    const name=text(links.length?links[0][1]:cells[i]).replace(/^\d+\s+/,'');
    if(name && name.length<=80 && /^[A-Za-z][A-Za-z .’'\-]+$/.test(name))rows.push({name,position,rank:i,slot:slotId});
   }
  }
 }
 if(!rows.some(r=>r.position==='QB'))throw Error('Depth chart layout unavailable.');
 return rows;
}
function createDepthCharts(now=Date.now,fetchPage=async url=>{const r=await fetch(url,{signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error();return r.text();},reviews=require('./starter-confirmations.json'),imageDepth=null){
 const reviewedDepth=imageDepth||require('./reviewed-depth').createReviewedDepth(now),cache=new Map(),verifyStarter=require('./starter-sources').createStarterVerifier(now,fetchPage),discover=require('./starter-discovery').createStarterDiscovery(now,fetchPage);
 return async(q,teams,g)=>Promise.all(teams.map(async team=>{
  const kickoff=Number(g.game.date.timestamp)*1000;
  const away=String(team.id)===q.away,name=away?g.teams.away.name:g.teams.home.name,domain=domains[name];
  const opponent=(away?g.teams.home.name:g.teams.away.name).split(' ').at(-1);
  const newsTask=discover(domain?`https://www.${domain}/news/`:null,team.roster,opponent,kickoff);

  const evidence=reviews.filter(r=>r.league===q.league&&r.season===q.season&&r.gameId===String(q.game)&&r.teamId===String(team.id)&&r.kickoff===kickoff&&Number.isFinite(Date.parse(r.publishedAt))&&Date.parse(r.publishedAt)<=now()&&now()-Date.parse(r.publishedAt)<=7*86400000);
  const confirmations=[];let unverified=0;
  await Promise.all(evidence.map(async r=>{
   const matches=(team.roster?.rows||[]).filter(p=>key(p.name)===key(r.name)&&p.position===r.position);
   if(matches.length!==1){unverified++;return;}
   try{const source=await verifyStarter(r);confirmations.push({...r,id:matches[0].id,sourceCheckedAt:source.checkedAt});}catch{unverified++;}
  }));
  team.starters={gameId:String(q.game),kickoff,checkedAt:confirmations.length?Math.min(...confirmations.map(r=>r.sourceCheckedAt)):now(),rows:confirmations,unverified,message:'Reviewed team announcements are rechecked against their official article every 15 minutes while reports are requested. Changed or unavailable sources withdraw confirmation until reviewed again. Missing entries mean game starters are unconfirmed; newly discovered articles remain unreviewed until their starter evidence is checked.'};
  const url=domain?`https://www.${domain}/team/depth-chart`:null;
  team.depth={available:false,url,message:'Depth chart unavailable; starting roles remain unconfirmed.'};if(!url){team.starterCandidates=await newsTask;return;}
  try{
   let item=cache.get(url);if(!item||now()-item.at>=3600000){item={at:now(),pending:fetchPage(url).then(html=>{try{return {rows:parseDepth(html),checkedAt:now()};}catch{return {html,checkedAt:now()};}})};cache.set(url,item);item.pending.catch(()=>cache.delete(url));}
   const page=await item.pending;let report;
   if(page.rows)report=page;else{report=await reviewedDepth(q,team.id,kickoff,url,page.html);report.checkedAt=Math.min(page.checkedAt,report.checkedAt);}
   const rows=[],unresolved=[];let unmatched=0;
   for(const row of report.rows){const player=!row.unresolved&&matchPlayer(row,team.roster?.rows||[],team.id);if(!player||(['QB','RB','FB','WR','TE'].includes(row.position)&&player.position!==row.position)){
     unmatched++;
     const candidates=(team.roster?.rows||[]).filter(p=>key(p.name)===key(row.name));
     const reason=row.reason||(candidates.length===0?'No matching player identity in the provider roster.':candidates.length>1?'Multiple provider identities match this name.':'Position or identity conflict: chart '+row.position+', provider '+candidates[0].position+'.');
     unresolved.push({...row,reason});continue;
   }rows.push({...row,id:player.id});}
   team.depth={available:true,url,...(report.reviewedImage?{reviewedImage:true,imageUrl:report.imageUrl,publishedDate:report.publishedDate,scope:'Supported offensive positions only; manually reviewed image.'}:{}),gameId:String(q.game),kickoff:Number(g.game.date.timestamp)*1000,checkedAt:report.checkedAt,rows,unmatched,unresolved,coverage:['QB','RB','FB','WR','TE'].map(position=>({position,matched:rows.filter(r=>r.position===position).length,unresolved:unresolved.filter(r=>r.position===position).length})),message:report.reviewedImage?`Team-published image updated ${report.publishedDate}; supported offensive positions only. Reviewed depth order is unofficial and does not confirm game starters or expected touches.`:'Team-published depth order, often unofficial. It does not confirm the game starter or expected touches; fetch time is not publication time.'};
  }catch{cache.delete(url);}
  team.starterCandidates=await newsTask;
 }));
}
module.exports={createDepthCharts,parseDepth,domains};
