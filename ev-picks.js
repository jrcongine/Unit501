'use strict';
const AUTHOR_URL='https://guybostonsports.com/author/evansingleton/';
function leagueMatches(title,league){return league==='nfl'?/\bNFL\b/i.test(title):/\b(?:NCAAF|college football)\b/i.test(title);}
function articleLinks(html,league,text){
  const links=[];
  for(const m of html.matchAll(/<h2\b[^>]*class="[^"]*\bentry-title\b[^"]*"[^>]*>([\s\S]*?)<\/h2>/gi)){
    const a=m[1].match(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);if(!a || !leagueMatches(text(a[2]),league))continue;
    try{const u=new URL(a[1]);if(u.origin!=='https://guybostonsports.com'||u.username||u.password||u.search||u.hash)continue;
      if(!links.includes(u.href))links.push(u.href);
    }catch{}
  }
  return links.slice(0,3);
}
function parseArticle(html,url,league,now,text){
  const title=text(html.match(/<h1\b[^>]*class="[^"]*\bentry-title\b[^"]*"[^>]*>([\s\S]*?)<\/h1>/i)?.[1]);
  const author=[...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)].some(m=>/\brel="author"/i.test(m[1]) && m[1].includes('href="'+AUTHOR_URL+'"') && text(m[2])==='Ev Singleton');
  const published=html.match(/<meta\b[^>]*property="article:published_time"[^>]*content="([^"]+)"/i)?.[1];
  const at=Date.parse(published),age=now-at;
  if(!author||!leagueMatches(title,league)||!Number.isFinite(at)||age<0||age>7*86400000)return [];
  const body=html.match(/<h[2-4]\b[^>]*>\s*(?:<[^>]+>)*Plays:\s*(?:<[^>]+>)*<\/h[2-4]>/i);
  if(!body)return [];
  const after=html.slice(body.index+body[0].length);
  const list=after.match(/^\s*<ul\b[^>]*>([\s\S]*?)<\/ul>/i)?.[1];if(!list)return [];
  return [...list.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)].flatMap((m,i)=>{
    const pick=text(m[1]);
    if(!pick||pick.length>350||/[✅❌🅿]/u.test(pick)||/\b(?:win|loss|push|void|lost|won)\b/i.test(pick)||!/(?:\b(?:over|under|ML|moneyline|touchdown)\b|[+-]\d)/i.test(pick))return [];
    return [{id:'ev:'+url+':'+i,source:'ev',author:'Ev Singleton',league,pick,matchup:title,url,
      publishedAt:new Date(at).toISOString(),publishedLabel:new Date(at).toISOString(),
      eventLabel:'Game date not verified — review original post',requiresReview:true}];
  });
}
async function fetchEv(league,fetchPage,fetcher,now,text){
  const html=await fetchPage(AUTHOR_URL,fetcher,6000);
  const urls=articleLinks(html,league,text);
  const results=await Promise.allSettled(urls.map(async url=>parseArticle(await fetchPage(url,fetcher,6000),url,league,now,text)));
  const picks=results.flatMap(r=>r.status==='fulfilled'?r.value:[]);
  const failed=results.filter(r=>r.status==='rejected').length;
  return {picks,status:failed===urls.length&&failed?'unavailable':picks.length?'available':'empty',
    message:(picks.length?'Recent ungraded written plays. Game dates need review; these are not counted in agreement yet.':'No recent ungraded written plays found for this league in the latest three matching posts.')+(failed?' Some article pages could not be loaded.':'')};
}
module.exports={AUTHOR_URL,articleLinks,parseArticle,fetchEv};
