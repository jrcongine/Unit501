'use strict';
// NBA-only bookmaker quotes. These are market lines, not Unit 501 forecasts.
const SPORT='basketball_nba';
const MARKETS={player_points:'Points',player_rebounds:'Rebounds',player_assists:'Assists',player_threes:'Threes made'};
const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const team=s=>({laclippers:'losangelesclippers',lalakers:'losangeleslakers'}[normalize(s)]||normalize(s));
const price=n=>Number.isInteger(n)&&Math.abs(n)>=100;
const half=n=>Number.isFinite(n)&&Number.isInteger(n*2);
function matches(e,g){return e?.sport_key===SPORT&&team(e.away_team)===team(g.away)&&team(e.home_team)===team(g.home)&&Math.abs(Date.parse(e.commence_time)-Date.parse(g.tipoff))<=15*60000;}
function bookFor(e){const books=(Array.isArray(e?.bookmakers)?e.bookmakers:[]).filter(b=>b.key==='fanduel');return books.length===1?books[0]:null;}
function fresh(m,b,now){const at=Date.parse(m.last_update||b.last_update);return Number.isFinite(at)&&at<=now+60000&&now-at<=1800000?at:null;}
function gameLines(e,now=Date.now()){
 const book=bookFor(e);let spread=null,total=null;
 for(const kind of ['spreads','totals']){
  const markets=(Array.isArray(book?.markets)?book.markets:[]).filter(m=>m.key===kind);if(markets.length!==1)continue;
  const m=markets[0],at=fresh(m,book,now),rows=m.outcomes;
  if(at===null||!Array.isArray(rows)||rows.length!==2||!rows.every(r=>price(r.price)))continue;
  if(kind==='spreads'){
   const away=rows.find(r=>r.name===e.away_team),home=rows.find(r=>r.name===e.home_team);
   if(away&&home&&half(away.point)&&home.point===-away.point)spread={away:away.point,home:home.point,awayPrice:away.price,homePrice:home.price,updatedAt:at};
  }else{
   const over=rows.find(r=>r.name==='Over'),under=rows.find(r=>r.name==='Under');
   if(over&&under&&half(over.point)&&over.point>0&&under.point===over.point)total={line:over.point,over:over.price,under:under.price,updatedAt:at};
  }
 }
 return {spread,total};
}
function playerLines(e,now=Date.now()){
 const book=bookFor(e),props=[];
 for(const [key,label] of Object.entries(MARKETS)){
  const markets=(Array.isArray(book?.markets)?book.markets:[]).filter(m=>m.key===key);if(markets.length!==1)continue;
  const m=markets[0],at=fresh(m,book,now);if(at===null||!Array.isArray(m.outcomes))continue;
  const names=new Set(m.outcomes.map(o=>o.description).filter(n=>typeof n==='string'&&n.trim()));
  for(const name of names){
   const rows=m.outcomes.filter(o=>o.description===name),over=rows.filter(o=>o.name==='Over'),under=rows.filter(o=>o.name==='Under');
   if(rows.length!==2||over.length!==1||under.length!==1||!half(over[0].point)||over[0].point<0||over[0].point!==under[0].point||!rows.every(r=>price(r.price)))continue;
   props.push({name:name.trim().slice(0,100),market:key,label,line:over[0].point,over:over[0].price,under:under[0].price,updatedAt:at});
  }
 }
 const counts=new Map();for(const p of props){const k=normalize(p.name)+':'+p.market;counts.set(k,(counts.get(k)||0)+1);}
 return props.filter(p=>counts.get(normalize(p.name)+':'+p.market)===1).sort((a,b)=>a.name.localeCompare(b.name)||a.label.localeCompare(b.label));
}
function createNBAOdds({fetcher=fetch,key=()=>process.env.ODDS_API_KEY,now=Date.now}={}){
 const cache=new Map();
 async function request(path,params={}){
  const ck=path+JSON.stringify(params),old=cache.get(ck);if(old&&now()-old.at<300000)return old.pending;
  const pending=(async()=>{
   let response;try{response=await fetcher('https://api.the-odds-api.com/v4/sports/'+SPORT+'/'+path+'?'+new URLSearchParams({...params,apiKey:key().trim()}),{signal:AbortSignal.timeout(12000)});}catch{throw Error('NBA FanDuel feed could not be reached. Try again later.');}
   if(!response.ok){
    const payload=await response.json().catch(()=>null);
    if(payload?.error_code==='INVALID_MARKET')throw Error('NBA odds provider rejected a requested basketball market.');
    throw require('./odds-provider-error').errorForResponse(response.status,payload);
   }
   try{return await response.json();}catch{throw Error('NBA odds provider returned an invalid response.');}
  })();
  cache.set(ck,{at:now(),pending});pending.catch(()=>{if(cache.get(ck)?.pending===pending)cache.delete(ck);});
  if(cache.size>200)cache.delete(cache.keys().next().value);return pending;
 }
 return async function get(game,kind='game'){
  if(!['game','props'].includes(kind)||!Number.isSafeInteger(game?.id)||!game.away||!game.home||!Number.isFinite(Date.parse(game.tipoff)))throw Error('Verified NBA matchup required.');
  const base={gameId:game.id,tipoff:game.tipoff,bookmaker:'FanDuel',fetchedAt:now(),spread:null,total:null,props:[],coverage:[]};
  if(game.status!=='Scheduled'||Date.parse(game.tipoff)<=now())return {...base,available:false,message:'Pregame NBA quotes are only available before tipoff for scheduled games.'};
  if(!key()?.trim())return {...base,available:false,message:'NBA FanDuel quotes require the existing odds-provider connection to be configured.'};
  let e;
  if(kind==='game'){
   const events=await request('odds',{bookmakers:'fanduel',markets:'spreads,totals',oddsFormat:'american'});
   if(!Array.isArray(events))throw Error('NBA odds event list was invalid.');
   const found=events.filter(e=>matches(e,game));if(found.length!==1)return {...base,available:false,message:'No unique FanDuel NBA matchup matched both teams and tipoff.'};
   e=found[0];const lines=gameLines(e,now());return {...base,...lines,available:Boolean(lines.spread||lines.total),message:lines.spread||lines.total?'FanDuel pregame lines loaded.':'No fresh paired FanDuel spread or total was returned.'};
  }
  const events=await request('events');if(!Array.isArray(events))throw Error('NBA prop event list was invalid.');
  const found=events.filter(e=>matches(e,game));if(found.length!==1)return {...base,available:false,message:'No unique NBA prop matchup matched both teams and tipoff.'};
  e=await request('events/'+encodeURIComponent(found[0].id)+'/odds',{bookmakers:'fanduel',markets:Object.keys(MARKETS).join(','),oddsFormat:'american'});
  if(e.id!==found[0].id||!matches(e,game))throw Error('NBA prop event identity could not be verified.');
  const props=playerLines(e,now()),coverage=Object.entries(MARKETS).map(([market,label])=>({market,label,lines:props.filter(p=>p.market===market).length}));
  return {...base,props,coverage,available:props.length>0,message:props.length?'FanDuel player lines loaded.':'No fresh paired FanDuel player props were returned for this game.'};
 };
}
module.exports={createNBAOdds,matches,gameLines,playerLines,MARKETS};
