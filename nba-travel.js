'use strict';
// Descriptive city-to-city distance between verified NBA game venues.
const {teamCode}=require('./nba-injuries');
const {miles}=require('./public/football-travel');
const ROOT='https://site.api.espn.com/apis/site/v2/sports/basketball/nba';
const states={AZ:'Arizona',CA:'California',CO:'Colorado',DC:'District of Columbia',FL:'Florida',GA:'Georgia',IL:'Illinois',IN:'Indiana',LA:'Louisiana',MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',NC:'North Carolina',NY:'New York',OH:'Ohio',OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',TN:'Tennessee',TX:'Texas',UT:'Utah',WI:'Wisconsin',ON:'Ontario',NV:'Nevada',MO:'Missouri',KY:'Kentucky',NJ:'New Jersey'};
const key=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
function createNBATravel({publicFeed,fetcher=fetch,now=Date.now}={}){
 const cache=new Map();
 async function read(url){
  const old=cache.get(url);if(old&&now()-old.at<3600000)return old.pending;
  const item={at:now()};item.pending=(async()=>{
   const r=await fetcher(url,{signal:AbortSignal.timeout(12000),redirect:'error'});
   if(!r.ok||Number(r.headers?.get?.('content-length')||0)>5000000)throw Error('Venue source unavailable');return r.json();
  })();cache.set(url,item);if(cache.size>200)cache.delete(cache.keys().next().value);
  item.pending.catch(()=>{if(cache.get(url)===item)cache.delete(url);});return item.pending;
 }
 async function venue(game,season){
  const data=await read(ROOT+'/summary?event='+encodeURIComponent(game.id));
  const header=data?.header,c=header?.competitions?.length===1?header.competitions[0]:null;
  const teams=c?.competitors||[];
  if(String(header?.id)!==String(game.id)||Number(header?.season?.year)!==season+1||Number(header?.season?.type)!==game.stage||Date.parse(c?.date)!==Date.parse(game.tipoff)||teams.length!==2||
    !teams.some(t=>String(t.id)===String(game.awayId)&&t.homeAway==='away')||!teams.some(t=>String(t.id)===String(game.homeId)&&t.homeAway==='home'))throw Error('NBA venue matchup unverified');
  const v=data.gameInfo?.venue,city=v?.address?.city,state=v?.address?.state;
  if(!v?.fullName||!city||!state||typeof city!=='string'||city.length>100||typeof state!=='string'||state.length>40)throw Error('NBA venue location unavailable');
  const expected=states[state]||state;
  const geo=await read('https://geocoding-api.open-meteo.com/v1/search?'+new URLSearchParams({name:city,count:'100',language:'en',format:'json'}));
  const matches=(geo.results||[]).filter(p=>['US','CA'].includes(p.country_code)&&key(p.name)===key(city)&&key(p.admin1)===key(expected)&&Number.isFinite(p.latitude)&&Number.isFinite(p.longitude));
  if(matches.length!==1)throw Error('NBA venue city is ambiguous');
  return {name:v.fullName,city,state,latitude:matches[0].latitude,longitude:matches[0].longitude};
 }
 return async(selected,date,season)=>{
  if(!selected||selected.statusCode!==1||!Number.isFinite(Date.parse(selected.tipoff))||Date.parse(selected.tipoff)<=now()||!Number.isInteger(season))throw Error('Pregame NBA matchup required');
  const slate=await publicFeed.games(date);
  const found=slate.games.filter(g=>g.statusCode===1&&teamCode(g.away)&&teamCode(g.away)===teamCode(selected.away)&&teamCode(g.home)&&teamCode(g.home)===teamCode(selected.home)&&g.stage===selected.stage&&Math.abs(Date.parse(g.tipoff)-Date.parse(selected.tipoff))<=15*60000);
  if(slate.season!==season||found.length!==1)throw Error('Public NBA matchup unverified');
  const match=found[0],context=await publicFeed.context(match,season),current=await venue(match,season);
  const sides=await Promise.all([context.away,context.home].map(async side=>{
   try{
    const previous=side?.recentGames?.[0];
    if(!side?.rest?.available||!previous||previous.tipoff!==side.rest.previousTipoff||!previous.opponentId||!['away','home'].includes(previous.venue))throw Error('Previous venue unavailable');
    const prior={id:previous.id,tipoff:previous.tipoff,stage:match.stage,awayId:previous.venue==='away'?side.id:previous.opponentId,homeId:previous.venue==='home'?side.id:previous.opponentId};
    const from=await venue(prior,season),distance=miles(from,current);if(distance===null)throw Error('Distance unavailable');
    return {available:true,miles:distance,previous:from.name,current:current.name,previousCity:from.city,currentCity:current.city};
   }catch{return {available:false};}
  }));
  return {gameId:selected.id,tipoff:selected.tipoff,away:sides[0],home:sides[1],source:'ESPN venues and Open-Meteo city coordinates'};
 };
}
module.exports={createNBATravel};
