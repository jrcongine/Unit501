'use strict';
// NBA-only bookmaker quotes. These are market lines, not Unit 501 forecasts.
const SPORT='basketball_nba';
const BOOKS=Object.freeze({fanduel:'FanDuel',draftkings:'DraftKings',betmgm:'BetMGM'});
const MARKETS={player_points:'Points',player_rebounds:'Rebounds',player_assists:'Assists',player_threes:'Threes made'};
const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const team=s=>({laclippers:'losangelesclippers',lalakers:'losangeleslakers'}[normalize(s)]||normalize(s));
function matches(e,g){return e?.sport_key===SPORT&&!!team(g?.away)&&!!team(g?.home)&&team(g.away)!==team(g.home)&&team(e.away_team)===team(g.away)&&team(e.home_team)===team(g.home)&&Math.abs(Date.parse(e.commence_time)-Date.parse(g.tipoff))<=15*60000;}
const gameLines=require('./game-quotes').gameQuotes;
function auditPlayerLines(e,now=Date.now()){
 const result=require('./prop-quotes').auditProps(e,MARKETS,now);
 return {audit:result.audit,props:result.props.map(({stat,...p})=>({...p,label:stat})).sort((a,b)=>a.name.localeCompare(b.name)||a.label.localeCompare(b.label))};
}
function playerLines(e,now=Date.now()){return auditPlayerLines(e,now).props;}
function createNBAOdds({fetcher=fetch,key=()=>process.env.ODDS_API_KEY,now=Date.now}={}){
 const cache=new Map();
 async function request(path,params={}){
  const ck=path+JSON.stringify(params),old=cache.get(ck);if(old&&now()-old.at<300000)return old.pending;
  const pending=(async()=>{
   let response;try{response=await fetcher('https://api.the-odds-api.com/v4/sports/'+SPORT+'/'+path+'?'+new URLSearchParams({...params,apiKey:key().trim()}),{signal:AbortSignal.timeout(12000)});}catch{throw Error('NBA FanDuel feed could not be reached. Try again later.');}
   require('./odds-monitor').observe(response);
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
  if(!['game','props','comparison'].includes(kind)||!Number.isSafeInteger(game?.id)||!game.away||!game.home||!Number.isFinite(Date.parse(game.tipoff)))throw Error('Verified NBA matchup required.');
  const base={gameId:game.id,tipoff:game.tipoff,bookmaker:kind==='comparison'?'Multiple':'FanDuel',fetchedAt:now(),spread:null,total:null,props:[],coverage:[],...(kind==='comparison'?{books:[]}: {})};
  if(game.status!=='Scheduled'||Date.parse(game.tipoff)<=now())return {...base,available:false,message:'Pregame NBA quotes are only available before tipoff for scheduled games.'};
  if(!key()?.trim())return {...base,available:false,message:'NBA FanDuel quotes require the existing odds-provider connection to be configured.'};
  let e;
  if(kind==='game'||kind==='comparison'){
   const events=await request('odds',{bookmakers:kind==='comparison'?Object.keys(BOOKS).join(','):'fanduel',markets:'h2h,spreads,totals',oddsFormat:'american'});
   if(!Array.isArray(events))throw Error('NBA odds event list was invalid.');
   const found=events.filter(e=>matches(e,game));if(found.length!==1)return {...base,available:false,message:'No unique NBA sportsbook matchup matched both teams and tipoff.'};
   e=found[0];
   if(kind==='comparison'){
    const books=Object.entries(BOOKS).map(([key,name])=>({key,name,...gameLines(e,now(),key)}));
    return {...base,books,available:books.some(b=>b.moneyline||b.spread||b.total),
     message:'Pregame sportsbook comparison checked. Each market is timestamped separately; missing or stale prices remain unavailable.'};
   }
   const lines=gameLines(e,now());return {...base,...lines,available:Boolean(lines.moneyline||lines.spread||lines.total),message:lines.moneyline||lines.spread||lines.total?'FanDuel pregame lines loaded.':'No fresh paired FanDuel moneyline, spread or total was returned.'};
  }
  const events=await request('events');if(!Array.isArray(events))throw Error('NBA prop event list was invalid.');
  const found=events.filter(e=>matches(e,game));if(found.length!==1)return {...base,available:false,message:'No unique NBA prop matchup matched both teams and tipoff.'};
  e=await request('events/'+encodeURIComponent(found[0].id)+'/odds',{bookmakers:'fanduel',markets:Object.keys(MARKETS).join(','),oddsFormat:'american'});
  if(e.id!==found[0].id||!matches(e,game))throw Error('NBA prop event identity could not be verified.');
  const {props,audit}=auditPlayerLines(e,now()),coverage=Object.entries(MARKETS).map(([market,label])=>({market,label,lines:props.filter(p=>p.market===market).length}));
  return {...base,props,audit,eventId:e.id,coverage,available:props.length>0,message:props.length?'FanDuel player lines loaded.':'No fresh paired FanDuel player props were returned for this game.'};
 };
}
module.exports={createNBAOdds,matches,gameLines,playerLines,auditPlayerLines,MARKETS,BOOKS};
