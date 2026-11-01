'use strict';
// Only team-owned NFL schedules can introduce gamebook URLs. The PDF parser
// independently checks the full game identity and reconciles its statistics.
const domains={
 'Arizona Cardinals':'azcardinals.com','Atlanta Falcons':'atlantafalcons.com','Baltimore Ravens':'baltimoreravens.com','Buffalo Bills':'buffalobills.com',
 'Carolina Panthers':'panthers.com','Chicago Bears':'chicagobears.com','Cincinnati Bengals':'bengals.com','Cleveland Browns':'clevelandbrowns.com',
 'Dallas Cowboys':'dallascowboys.com','Denver Broncos':'denverbroncos.com','Detroit Lions':'detroitlions.com','Green Bay Packers':'packers.com',
 'Houston Texans':'houstontexans.com','Indianapolis Colts':'colts.com','Jacksonville Jaguars':'jaguars.com','Kansas City Chiefs':'chiefs.com',
 'Las Vegas Raiders':'raiders.com','Los Angeles Chargers':'chargers.com','Los Angeles Rams':'therams.com','Miami Dolphins':'miamidolphins.com',
 'Minnesota Vikings':'vikings.com','New England Patriots':'patriots.com','New Orleans Saints':'neworleanssaints.com','New York Giants':'giants.com',
 'New York Jets':'newyorkjets.com','Philadelphia Eagles':'philadelphiaeagles.com','Pittsburgh Steelers':'steelers.com','San Francisco 49ers':'49ers.com',
 'Seattle Seahawks':'seahawks.com','Tampa Bay Buccaneers':'buccaneers.com','Tennessee Titans':'tennesseetitans.com','Washington Commanders':'commanders.com'
};
function links(html){return [...html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)].map(m=>({href:m[1].replace(/&amp;/g,'&'),text:m[2].replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim()}));}
function matchingCards(html,source,team){
 const opponent=team===source.home?source.away:source.home;
 return html.split(/(?=<div\b[^>]*\bdata-gameid=)/i).filter(card=>{const raw=/\bdata-gametime="([^"]+)"/.exec(card)?.[1];return raw&&Math.abs(Date.parse(raw)-source.gameDate*1000)<=15*60000&&card.split('<script type="application/ld+json">')[0].includes(opponent);}).map(card=>card.split('<script type="application/ld+json">')[0]);
}
function gamePage(html,origin,source,team){
 const found=[];
 for(const body of matchingCards(html,source,team)){
  for(const link of links(body).filter(l=>/^Game (?:Center|Recap)$/i.test(l.text))){
   const u=new URL(link.href,origin);if(u.origin===origin&&u.pathname.includes('/'+source.season+'/')&&/\/reg(?:-|\/)/.test(u.pathname))found.push(u.href);
  }
 }
 return [...new Set(found)].length===1?found[0]:null;
}
function gamebookLinks(html){return [...new Set(links(html).filter(l=>/game\s*book/i.test(l.text)).map(l=>l.href).filter(u=>/^https:\/\/www\.nflgsis\.com\/20\d{2}\/REG\/\d{2}\/\d+\/Gamebook\.pdf$/.test(u)||/^https:\/\/static\.clubs\.nfl\.com\/image\/upload\/[a-zA-Z0-9/_.,-]+$/.test(u)))];}
function createDiscovery({fetcher=fetch,now=Date.now}={}){
 const cache=new Map();
 async function page(url){let old=cache.get(url);if(old&&now()-old.at<3600000)return old.pending;
  const item={at:now(),pending:(async()=>{const origin=new URL(url).origin,signal=AbortSignal.timeout(10000);let current=url;
   for(let i=0;i<4;i++){const r=await fetcher(current,{signal,redirect:'manual'});
    if([301,302,303,307,308].includes(r.status)){const location=r.headers?.get?.('location');if(!location)throw Error('Official redirect unavailable');const next=new URL(location,current);if(next.origin!==origin)throw Error('Untrusted official redirect');current=next.href;continue;}
    if(!r.ok||Number(r.headers?.get?.('content-length')||0)>2000000)throw Error('Official page unavailable');const s=await r.text();if(s.length>2000000)throw Error('Official page too large');return s;
   }throw Error('Too many official redirects');})()};cache.set(url,item);item.pending.catch(()=>{if(cache.get(url)===item)cache.delete(url);});if(cache.size>150)cache.delete(cache.keys().next().value);return item.pending;
 }
 return async source=>{
  if(source.league!=='1')return null;
  for(const team of [source.home,source.away]){
   if(!domains[team])continue;
   try{const origin='https://www.'+domains[team],schedule=await page(origin+'/schedule/');
    const cards=matchingCards(schedule,source,team);
    if(cards.length===1){const direct=gamebookLinks(cards[0]).filter(url=>!url.includes('nflgsis.com/')||url.includes('/'+source.season+'/REG/'));if(direct.length===1)return {...source,url:direct[0],page:origin+'/schedule/'};}
    const game=gamePage(schedule,origin,source,team);if(!game)continue;
    const urls=gamebookLinks(await page(game));if(urls.length===1)return {...source,url:urls[0],page:game};
   }catch{/* Another official team may provide the gamebook. */}
  }
  return null;
 };
}
module.exports={domains,links,gamePage,gamebookLinks,createDiscovery};
