'use strict';
const { sports } = require('./fanduel');
const { matches, missingMatchMessage } = require('./odds-matching');
const markets = {player_pass_yds:'passYds',player_pass_tds:'passTD',player_rush_attempts:'carries',player_rush_yds:'rushYds',player_rush_tds:'rushTD',player_reception_yds:'recYds',player_receptions:'rec',player_reception_tds:'recTD'};
const normalize = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const cache = new Map();
async function request(path, params = {}) {
  const key = path + JSON.stringify(params);
  const previous = cache.get(key);
  if (previous && Date.now() - previous.at < 300000) return previous.pending;
  const pending = (async () => {
    try {
      const query = new URLSearchParams({...params,apiKey:process.env.ODDS_API_KEY});
      const res = await fetch(`https://api.the-odds-api.com/v4/sports/${path}?${query}`,{signal:AbortSignal.timeout(12000)});
      if (!res.ok) throw new Error(`FanDuel prop feed returned ${res.status}. Check your odds plan or enter lines manually.`);
      return await res.json();
    } catch (e) {
      if (e.message.startsWith('FanDuel prop feed')) throw e;
      throw new Error('FanDuel prop feed could not be reached. Enter lines manually.');
    }
  })();
  cache.set(key,{at:Date.now(),pending});
  // Bound the cache across changing slates; share in-flight requests between visitors.
  if (cache.size > 200) cache.delete(cache.keys().next().value);
  return pending;
}
function parseProps(event,now=Date.now()) {
  const book=event.bookmakers?.find(b=>b.key==='fanduel');
  const props=[];
  for (const market of book?.markets || []) {
    const stat=markets[market.key];
    const updated=Date.parse(market.last_update || book.last_update);
    if (!stat || !Number.isFinite(updated) || now-updated>1800000 || updated>now+60000) continue;
    const names=new Set((market.outcomes||[]).map(o=>o.description).filter(Boolean));
    for (const name of names) {
      const rows=market.outcomes.filter(o=>o.description===name);
      const over=rows.filter(o=>o.name==='Over'),under=rows.filter(o=>o.name==='Under');
      if(over.length!==1 || under.length!==1) continue;
      const point=over[0].point;
      if(!Number.isFinite(point) || point!==under[0].point || !Number.isInteger(point*2) || (!stat.endsWith('Yds') && point<0)) continue;
      props.push({name,stat,line:point,updatedAt:updated,over:over[0].price,under:under[0].price});
    }
  }
  return props;
}
async function getProps(q) {
  if(!process.env.ODDS_API_KEY) return {props:[],message:'FanDuel props need the existing ODDS_API_KEY. Enter lines manually for now.'};
  if(q.kickoff<=Date.now()) return {props:[],message:'Automatic props are for upcoming games. Enter lines manually for this game.'};
  const sport=sports[q.league];
  const events=await request(`${sport}/events`);
  if(!Array.isArray(events)) throw new Error('FanDuel returned an invalid event list.');
  const found=events.filter(e=>matches(e,q));
  if(found.length!==1) return {props:[],message:missingMatchMessage(events,q)};
  const data=await request(`${sport}/events/${encodeURIComponent(found[0].id)}/odds`,{bookmakers:'fanduel',markets:Object.keys(markets).join(','),oddsFormat:'american'});
  if(data.id!==found[0].id || !matches(data,q)) throw new Error('FanDuel prop matchup could not be verified.');
  const props=parseProps(data);
  return {props,message:props.length?'FanDuel props loaded. Missing props can be entered manually.':'No fresh FanDuel props available for this matchup. Enter lines manually.'};
}
module.exports={getProps,parseProps,matches,normalize};
