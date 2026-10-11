'use strict';
const {readArticles}=require('./starter-sources');
const {clean,key,matchPlayer}=require('./player-name-match');
// Explicitly reviewed source identity; new weeks require another source entry.
const sources={'2026:5:2026-10-11':'https://www.nfl.com/news/nfl-week-5-inactives-players-ruled-out-sunday-2026-season'};
function parseInactives(html,url,season,week,date,now){
 const articles=readArticles(html,url);
 if(articles.length!==1)throw Error('Inactive article identity ambiguous.');
 const article=articles[0],published=Date.parse(article.datePublished),modified=Date.parse(article.dateModified);
 if(!Number.isFinite(published)||published>now||!Number.isFinite(modified)||modified<published||modified>now||new Date(published).toISOString().slice(0,10)!==date||
    !String(article.articleBody).includes(`Week ${week} of the ${season} NFL season`))throw Error('Inactive article season or date unverified.');
 const teams=[];
 for(const section of String(html).matchAll(/<h3\b[^>]*>([^<]+)<\/h3>\s*<ul\b[^>]*>([\s\S]*?)<\/ul>/gi)){
  const name=clean(section[1]);if(!/^[A-Z ]+$/.test(name))continue;
  const rows=[];
  for(const item of section[2].matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)){
   const value=clean(item[1]);
   const match=/^(QB|RB|FB|WR|TE|C|G|OG|OT|T|OL|EDGE|DT|DE|DL|NT|LB|ILB|OLB|CB|S|FS|SS|DB|K|P|LS)\s+(.+?)(?:\s*\((emergency third (?:QB|quarterback))\))?$/i.exec(value);
   if(!match)throw Error('Inactive list entry layout changed.');
   rows.push({position:match[1].toUpperCase(),name:match[2],emergency:!!match[3],status:'Inactive'});
  }
  // A pending empty list cannot confirm anyone's status.
  if(rows.length)teams.push({name,rows});
 }
 if(!teams.length||new Set(teams.map(t=>key(t.name))).size!==teams.length)throw Error('Inactive team lists missing or ambiguous.');
 return {teams,publishedAt:article.datePublished,modifiedAt:article.dateModified,checkedAt:now,url};
}
function createGameDayInactives(now,fetchPage){
 const cache=new Map();
 return async(q,teams,g)=>{
  const kickoff=Number(g.game.date.timestamp)*1000,week=Number(/^Week (\d+)$/.exec(g.game.week||'')?.[1]);
  if(q.league!=='1'||!Number.isFinite(kickoff)||kickoff<=now()||kickoff>now()+7*86400000)return;
  const date=new Date(kickoff).toISOString().slice(0,10),url=sources[`${q.season}:${week}:${date}`];
  for(const team of teams)team.inactives={available:false,rows:[],message:'Final game-day inactive list not verified. Absence from a list never confirms a starter or workload.'};
  if(!url)return;
  try{
   let item=cache.get(url);
   if(!item||now()<item.at||now()-item.at>=900000){item={at:now(),pending:fetchPage(url).then(html=>parseInactives(html,url,q.season,week,date,now()))};cache.set(url,item);item.pending.catch(()=>{if(cache.get(url)===item)cache.delete(url);});}
   const report=await item.pending;
   for(const team of teams){
    const name=String(team.id)===String(g.teams.away.id)?g.teams.away.name:String(team.id)===String(g.teams.home.id)?g.teams.home.name:null;
    const matches=report.teams.filter(t=>name&&key(name).endsWith(key(t.name)));
    if(matches.length!==1||!team.roster?.available||!Number.isFinite(team.roster.checkedAt)||team.roster.checkedAt>now()||now()-team.roster.checkedAt>3600000)continue;
    const rows=[],unmatched=[];
    for(const row of matches[0].rows){const player=matchPlayer(row,team.roster.rows||[],team.id);if(player)rows.push({...row,id:player.id,teamId:String(team.id)});else unmatched.push(row);}
    team.inactives={available:true,rows,unmatched,checkedAt:report.checkedAt,gameId:String(q.game),kickoff,league:q.league,season:q.season,url,publishedAt:report.publishedAt,modifiedAt:report.modifiedAt,message:'Official final game-day inactive list. Emergency third quarterbacks have restricted eligibility; normal full-game props are withheld. Other players are not confirmed active or starting by omission.'};
   }
  }catch{/* Fail closed to unverified coverage; weekly reports remain available. */}
 };
}
module.exports={parseInactives,createGameDayInactives,sources};
