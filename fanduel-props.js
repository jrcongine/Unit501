'use strict';
const { sports } = require('./fanduel');
const { matches, missingMatchMessage } = require('./odds-matching');
const markets = {player_pass_yds:'passYds',player_pass_tds:'passTD',player_rush_attempts:'carries',player_rush_yds:'rushYds',player_rush_tds:'rushTD',player_reception_yds:'recYds',player_receptions:'rec',player_reception_tds:'recTD'};
const normalize = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const cache = new Map();
const {errorForResponse}=require('./odds-provider-error');
async function request(path, params = {}) {
  const key = path + JSON.stringify(params);
  const previous = cache.get(key);
  if (previous && Date.now() - previous.at < 300000) return previous.pending;
  const pending = (async () => {
    try {
      const query = new URLSearchParams({...params,apiKey:process.env.ODDS_API_KEY.trim()});
      const res = await fetch(`https://api.the-odds-api.com/v4/sports/${path}?${query}`,{signal:AbortSignal.timeout(12000)});
      require('./odds-monitor').observe(res);
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw errorForResponse(res.status,payload);
      }
      return await res.json();
    } catch (e) {
      if (e.message.startsWith('FanDuel feed')) throw e;
      throw new Error('FanDuel prop feed could not be reached. Enter lines manually.');
    }
  })();
  cache.set(key,{at:Date.now(),pending});
  // Don't cache authentication/quota failures for five minutes. A fixed key should be retried.
  pending.catch(() => { if (cache.get(key)?.pending === pending) cache.delete(key); });
  // Bound the cache across changing slates; share in-flight requests between visitors.
  if (cache.size > 200) cache.delete(cache.keys().next().value);
  return pending;
}
function parseProps(event,now=Date.now()) {
  return require('./prop-quotes').auditProps(event,markets,now).props.map(({market,...p})=>p);
}
function marketCoverage(props) {
  return Object.entries(markets).map(([market,stat])=>({market,stat,lines:props.filter(p=>p.stat===stat).length}));
}
async function getProps(q) {
  if(!process.env.ODDS_API_KEY?.trim()) return {props:[],message:'FanDuel props need a valid ODDS_API_KEY in Railway. No live prop lines available; manual entry still works.'};
  if(q.kickoff<=Date.now()) return {props:[],message:'Automatic props are for upcoming games. Enter lines manually for this game.'};
  const sport=sports[q.league];
  const events=await request(`${sport}/events`);
  if(!Array.isArray(events)) throw new Error('FanDuel returned an invalid event list.');
  const found=events.filter(e=>matches(e,q));
  if(found.length!==1) return {props:[],message:missingMatchMessage(events,q)};
  const data=await request(`${sport}/events/${encodeURIComponent(found[0].id)}/odds`,{bookmakers:'fanduel',markets:Object.keys(markets).join(','),oddsFormat:'american'});
  if(data.id!==found[0].id || !matches(data,q)) throw new Error('FanDuel prop matchup could not be verified.');
  const parsed=require('./prop-quotes').auditProps(data,markets);
  const audit=parsed.audit,props=parsed.props.map(({market,...p})=>p);
  return {props,audit,eventId:data.id,coverage:marketCoverage(props),message:props.length?'FanDuel props loaded. Missing props can be entered manually.':'No fresh FanDuel props available for this matchup. Enter lines manually.'};
}
module.exports={getProps,parseProps,matches,normalize,marketCoverage};
