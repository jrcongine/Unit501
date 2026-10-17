'use strict';
const clean=s=>String(s||'').replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/&#8211;|&ndash;/g,'–').replace(/&#8217;|&rsquo;/g,"'").replace(/\s+/g,' ').trim();
const paths={nfl:'nfl',ncaaf:'college-football'};
function links(html,league){
 const prefix='https://www.sportsbettingdime.com/news/'+paths[league]+'/';
 return [...new Set([...html.matchAll(/href="([^"]+)"/g)].map(m=>m[1]).filter(u=>u.startsWith(prefix)&&/^[a-z0-9-]+\/$/.test(u.slice(prefix.length))&&!u.endsWith('/feed/')))]
  .sort((a,b)=>Number(/picks-today-best/.test(b))-Number(/picks-today-best/.test(a))).slice(0,10);
}
function parse(html,league,url,now=Date.now()){
 const author=clean(html.match(/<meta\b[^>]*name="author"[^>]*content="([^"]+)"/i)?.[1]);
 const published=Date.parse(html.match(/"datePublished":"([^"]+)"/)?.[1]);
 if(!author||!Number.isFinite(published)||published>now||now-published>36*3600000)return [];
 const rows=[];
 for(const match of html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)){
  const headers=[...match[1].matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/gi)].map(m=>clean(m[1]).toLowerCase());
  const matchup=headers.indexOf('matchup'),pick=headers.indexOf('best bet'),price=headers.findIndex(h=>/price|odds/.test(h));
  if(matchup<0||pick<0)continue;
  for(const row of match[1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)){
   const cells=[...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(m=>clean(m[1]));
   if(cells.length!==headers.length||!cells[pick]||cells[pick].length>180||!/(?: at | vs\.? )/i.test(cells[matchup]))continue;
   rows.push({id:'sbd:'+url+':'+cells[matchup]+':'+cells[pick],source:'sbd',author,league,pick:cells[pick]+(price>=0&&cells[price]?' ('+cells[price]+')':''),matchup:cells[matchup],eventLabel:'Article '+new Date(published).toLocaleDateString('en-US',{timeZone:'America/New_York'})+' · check kickoff',publishedLabel:new Date(published).toISOString(),publishedAt:new Date(published).toISOString(),url});
  }
 }
 return rows;
}
module.exports={links,parse};
