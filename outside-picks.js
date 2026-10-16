'use strict';
// Public, attributed selections only. Never retrieve premium picks or infer video picks.
const {fetchEv,AUTHOR_URL}=require('./ev-picks');
const SOURCES = {
  ev:{name:'EV / Guy Boston Sports',urls:{nfl:AUTHOR_URL,ncaaf:AUTHOR_URL}},
  covers: {name:'Covers', urls:{nfl:'https://www.covers.com/picks/nfl', ncaaf:'https://www.covers.com/picks/ncaaf'}},
  wagertalk: {name:'WagerTalk', urls:{nfl:'https://www.wagertalk.com/free-sports-picks/nfl', ncaaf:'https://www.wagertalk.com/free-sports-picks/college-football'}}
};
function text(html) {
  return String(html || '').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,'').replace(/<[^>]*>/g,' ')
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (_, n) => {const v=n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n);return v<=0x10ffff?String.fromCodePoint(v):'';})
    .replace(/&(amp|quot|apos|lt|gt|nbsp);/g,(_,n)=>({amp:'&',quot:'"',apos:"'",lt:'<',gt:'>',nbsp:' '}[n]))
    .replace(/\s+/g,' ').trim();
}
// Extract a balanced element so a nested avatar cannot terminate a selection early.
function inner(html, pattern) {
  const match=pattern.exec(html); if(!match)return '';
  const tag=match[1], start=match.index+match[0].length;
  const tokens=new RegExp('<(/?)'+tag+'\\b[^>]*>','gi'); tokens.lastIndex=start;
  let depth=1, token;
  while((token=tokens.exec(html))) {depth+=token[1]?-1:1;if(!depth)return html.slice(start,token.index);}
  return '';
}
function cls(html, name) {return text(inner(html,new RegExp('<(div|span|p|h2)\\b[^>]*class="[^"]*\\b'+name+'\\b[^"]*"[^>]*>','i')));}
function parseCovers(html, league) {
  const starts=[...html.matchAll(/<div\b[^>]*\bdata-pick\s[^>]*>/g)];
  return starts.flatMap((m,i)=>{
    const block=html.slice(m.index,starts[i+1]?.index || html.length);
    if(!/data-tab="active-tabs"/.test(m[0]))return [];
    const pick=text(inner(block,/<(div)\b[^>]*class="w-100 fw-bold small[^\"]*"[^>]*>/i));
    const author=text(block.match(/<a\b[^>]*href="https:\/\/www\.covers\.com\/writers\/[^\"]+"[^>]*>([\s\S]*?)<\/a>/i)?.[1]);
    let game='';
    for(const t of block.matchAll(/data-tracking='([^']+)'/g)) {
      try {const value=JSON.parse(t[1]).text;if(typeof value==='string' && / vs /.test(value)){game=value;break;}}catch{}
    }
    const id=m[0].match(/\bid="([\w-]+)"/)?.[1];
    if(!pick || pick.length>250 || !author || !game || !id)return [];
    return [{id:'covers:'+id,source:'covers',author,league,pick,matchup:game.split(',')[0],eventLabel:game,
      publishedLabel:cls(block,'badge-style-time-only').replace(/^Pick made:\s*/,''),
      url:SOURCES.covers.urls[league]+'#'+id}];
  });
}
function parseWagerTalk(html,league) {
  return html.split(/<section\b[^>]*class="free-sports-main what-pros-say-section"[^>]*>/).slice(1).flatMap(block=>{
    const pick=cls(block,'content-play'), matchup=cls(block,'content-event'), eventLabel=cls(block,'content-date');
    const author=text(block.match(/<h2\b[^>]*>\s*<a\b[^>]*>([\s\S]*?)<\/a>/i)?.[1]);
    const at=Date.parse(eventLabel);
    if(!pick || pick.length>250 || !matchup || !author || !Number.isFinite(at))return [];
    return [{id:'wagertalk:'+league+':'+author+':'+matchup,source:'wagertalk',author,league,pick,matchup,eventLabel,
      eventAt:new Date(at).toISOString(),publishedLabel:cls(block,'r-date'),url:SOURCES.wagertalk.urls[league]}];
  });
}
async function fetchPage(url,fetcher,timeout=12000) {
  const response=await fetcher(url,{signal:AbortSignal.timeout(timeout),headers:{Accept:'text/html'},redirect:'error'});
  if(!response.ok)throw Error('Source unavailable');
  // Bound upstream responses as well as request duration.
  const reader=response.body.getReader();let size=0;const chunks=[];
  try {while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>2500000)throw Error('Source response too large');chunks.push(Buffer.from(value));}}
  finally {await reader.cancel().catch(()=>{});}
  return Buffer.concat(chunks).toString('utf8');
}
function createFeed({fetcher=fetch,now=Date.now}={}) {
  const cache=new Map(),pending=new Map();
  async function source(key,league) {
    const id=key+':'+league, previous=cache.get(id);
    if(previous && now()-previous.saved<300000)return previous.value;
    if(pending.has(id))return pending.get(id);
    const work=(async()=>{
      let value;
      try {
        if(key==='ev'){
          value={source:key,name:SOURCES[key].name,checkedAt:new Date(now()).toISOString(),...await fetchEv(league,fetchPage,fetcher,now(),text)};
        }else{
        const html=await fetchPage(SOURCES[key].urls[league],fetcher);
        const picks=(key==='covers'?parseCovers:parseWagerTalk)(html,league).slice(0,60);
        value={source:key,name:SOURCES[key].name,status:picks.length?'available':'empty',checkedAt:new Date(now()).toISOString(),picks,
          message:picks.length?'Public selections; source prices may have changed.':'No readable public selections returned. Check the source; its page format may have changed.'};
        }
      }catch{value={source:key,name:SOURCES[key].name,status:'unavailable',checkedAt:new Date(now()).toISOString(),picks:[],message:'Source could not be retrieved. Try again later or open the source.'};}
      cache.set(id,{saved:now(),value});return value;
    })();
    pending.set(id,work);try{return await work;}finally{pending.delete(id);}
  }
  return async league=>{
    if(!['nfl','ncaaf'].includes(league))throw Error('Unsupported league');
    const sources=await Promise.all(['covers','wagertalk','ev'].map(key=>source(key,league)));
    return {league,sources:sources.map(s=>({...s,picks:s.picks.filter(p=>(!p.eventAt || Date.parse(p.eventAt)>now()) && (!p.publishedAt || now()-Date.parse(p.publishedAt)<=7*86400000))})),
      manual:[{name:'Juice Reel',message:'No connected pick feed. Records and selections still require checking in Juice Reel.'}]};
  };
}
module.exports={parseCovers,parseWagerTalk,createFeed,text};
