'use strict';
const {sports}=require('./fanduel');
const {matches,missingMatchMessage}=require('./odds-matching');
const {gameLines,BOOKS}=require('./nba-odds');
const {errorForResponse}=require('./odds-provider-error');
function createComparison({fetcher=fetch,key=()=>process.env.ODDS_API_KEY,now=Date.now}={}) {
 const cache=new Map();
 return async function get(query) {
  const base={league:query.league,away:query.away,home:query.home,kickoff:query.kickoff,books:[]};
  if(!sports[query.league]||!Number.isFinite(query.kickoff)||query.kickoff<=now()) return {...base,available:false,message:'Comparison is available before kickoff only.'};
  if(!key()?.trim())return {...base,available:false,message:'Odds provider is not configured.'};
  const sport=sports[query.league]; let entry=cache.get(sport);
  if(!entry || now()-entry.at>=300000){
   const params=new URLSearchParams({apiKey:key().trim(),bookmakers:Object.keys(BOOKS).join(','),markets:'h2h,spreads,totals',oddsFormat:'american'});
   const pending=(async()=>{let response;try{response=await fetcher(`https://api.the-odds-api.com/v4/sports/${sport}/odds/?${params}`,{signal:AbortSignal.timeout(12000)});}catch{throw Error('Sportsbook comparison feed could not be reached.');}
    require('./odds-monitor').observe(response);if(!response.ok)throw errorForResponse(response.status,await response.json().catch(()=>null));
    const data=await response.json();if(!Array.isArray(data))throw Error('Invalid sportsbook comparison response.');return data;})();
   entry={at:now(),pending};cache.set(sport,entry);pending.catch(()=>{if(cache.get(sport)===entry)cache.delete(sport);});
  }
  const events=await entry.pending, found=events.filter(e=>matches(e,query));
  if(found.length!==1)return {...base,available:false,message:missingMatchMessage(events,query)};
  if(Date.parse(found[0].commence_time)<=now())return {...base,available:false,message:'Pregame comparison is unavailable after kickoff.'};
  const books=Object.entries(BOOKS).map(([key,name])=>({key,name,...gameLines(found[0],now(),key)}));
  return {...base,books,available:books.some(b=>b.moneyline||b.spread||b.total),message:'Comparison checked. Missing or stale prices remain unavailable.'};
 };
}
module.exports={createComparison};
