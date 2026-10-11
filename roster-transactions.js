'use strict';
const {clean,key}=require('./player-name-match');
const {createStarterVerifier}=require('./starter-sources');
function rosterContains(html,name,position){
 const rows=[];
 for(const table of String(html).matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)){
  const headers=[...table[1].matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/gi)].map(m=>clean(m[1]));
  if(headers[0]!=='Player'||headers[1]!=='#'||headers[2]!=='Pos')continue;
  for(const row of table[1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)){
   const cells=[...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(m=>clean(m[1]));
   if(cells.length>=3&&key(cells[0])===key(name))rows.push(cells);
  }
 }
 return rows.length===1&&rows[0][2]===position;
}
// Reviewed moves block stale former-team identities only. No roster or history is moved.
function createRosterTransactions(now=Date.now,fetchPage=async url=>{
 const r=await fetch(url,{signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error('Transaction source unavailable.');return r.text();
},reviews=require('./roster-transaction-reviews.json')){
 const verify=createStarterVerifier(now,fetchPage),cache=new Map();
 async function roster(review){
  let item=cache.get(review.rosterUrl);
  if(!item||now()<item.at||now()-item.at>=900000){
   item={at:now(),pending:fetchPage(review.rosterUrl).then(html=>({html,checkedAt:now()}))};cache.set(review.rosterUrl,item);
   item.pending.catch(()=>{if(cache.get(review.rosterUrl)===item)cache.delete(review.rosterUrl);});
  }
  const report=await item.pending;
  if(!rosterContains(report.html,review.name,review.position))throw Error('Current destination roster identity unavailable.');
  return report;
 }
 return async(q,teams,g)=>{
  const kickoff=Number(g?.game?.date?.timestamp)*1000;
  await Promise.all(teams.map(async team=>{
   const matching=reviews.filter(r=>r.league===q.league&&r.season===q.season&&r.gameId===String(q.game)&&r.teamId===String(team.id)&&r.kickoff===kickoff);
   const rows=[];let unverified=0;
   for(const r of matching){
    try{
     const at=Date.parse(r.reviewedAt),published=Date.parse(r.publishedAt);
     if(q.league!=='1'||kickoff<=now()||kickoff>now()+7*86400000||!Number.isFinite(at)||at>now()||now()-at>=86400000||!Number.isFinite(published)||published>now()||now()-published>30*86400000||r.destinationTeamId===r.teamId)throw Error('Move review expired.');
     if(matching.filter(v=>v.playerId===r.playerId).length!==1||!team.roster?.available||!Number.isFinite(team.roster.checkedAt)||team.roster.checkedAt>now()||now()-team.roster.checkedAt>=3600000)throw Error('Former roster identity unavailable.');
     const identities=team.roster.rows.filter(p=>String(p.id)===r.playerId||key(p.name)===key(r.rosterName));
     if(identities.length!==1||String(identities[0].id)!==r.playerId||key(identities[0].name)!==key(r.rosterName)||identities[0].position!==r.position)throw Error('Former roster identity ambiguous.');
     const [source,current]=await Promise.all([verify(r),roster(r)]);
     rows.push({id:r.playerId,name:r.name,position:r.position,teamId:r.teamId,destination:r.destination,destinationTeamId:r.destinationTeamId,url:r.url,rosterUrl:r.rosterUrl,reviewedAt:r.reviewedAt,publishedAt:r.publishedAt,sourceCheckedAt:Math.min(source.checkedAt,current.checkedAt)});
    }catch{unverified++;}
   }
   team.transactions={available:rows.length>0,league:q.league,season:q.season,gameId:String(q.game),kickoff,checkedAt:rows.length?Math.min(...rows.map(r=>r.sourceCheckedAt)):null,rows,unverified,message:'Reviewed moves with a rechecked official article and current destination roster. Coverage is incomplete; missing entries do not verify membership. Former-team projections are withheld; stats and workloads are not transferred.'};
  }));
 };
}
module.exports={createRosterTransactions,rosterContains};
