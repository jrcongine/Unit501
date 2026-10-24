'use strict';
const {fbsName}=require('./team-identity');
const catalog=require('./public/venue-weather');
const key=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const cache=new Map();
async function json(url){const r=await fetch(url,{signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('Venue source unavailable');return r.json();}
function identity(name,league,season){return key(league==='2'?(fbsName({name},season)||name):name);}
function matchEvent(events,q){
 // Prefer the exact scheduled kickoff. Providers can disagree when TV times change;
 // only accept a nearby time when both teams and season identify a unique event.
 const candidates=events.filter(e=>String(e.season?.year)===q.season).flatMap(e=>(e.competitions||[]).filter(c=>Math.abs(Date.parse(c.date)-q.kickoff)<12*3600000 && ['home','away'].every(side=>{
  const t=c.competitors?.find(t=>t.homeAway===side)?.team;
  return t&&[t.displayName,t.shortDisplayName,t.location].some(n=>identity(n,q.league,q.season)===identity(q[side],q.league,q.season));
 })).map(c=>({event:e,competition:c})));
 const exact=candidates.filter(m=>Math.abs(Date.parse(m.competition.date)-q.kickoff)<60000);
 return exact.length?exact:candidates;
}
async function resolveVenue(q){
 const cacheKey=JSON.stringify(q),old=cache.get(cacheKey);if(old&&Date.now()-old.at<3600000)return old.data;
 const sport=q.league==='1'?'nfl':'college-football',date=new Date(q.kickoff).toISOString().slice(0,10).replace(/-/g,'');
 const board=await json(`https://site.api.espn.com/apis/site/v2/sports/football/${sport}/scoreboard?dates=${date}&limit=1000${q.league==='2'?'&groups=80':''}`);
 const matches=matchEvent(board.events||[],q);if(matches.length!==1)return {available:false,message:'No unique venue match for these teams and kickoff.'};
 const {competition:c,event}=matches[0];
 let v=c.venue;
 // Scoreboards may omit the venue/address even when the event summary has it.
 if(!v?.fullName||!v.address?.city||!v.address?.state){
  try{
   const summary=await json(`https://site.api.espn.com/apis/site/v2/sports/football/${sport}/summary?event=${encodeURIComponent(event.id)}`);
   const detailed=summary.gameInfo?.venue;
   if(detailed&&(!v?.id||String(detailed.id)===String(v.id)))v={...v,...detailed};
  }catch{ /* A usable scoreboard venue must survive a summary outage. */ }
 }
 if(!v?.fullName)return {available:false,message:'Matchup venue not supplied by the event feeds.'};
 const known=catalog.resolve({season:q.season,venueName:v.fullName});
 let venue=known;
 if(!venue){
  const latitude=Number(v.latitude??v.location?.latitude??v.location?.lat),longitude=Number(v.longitude??v.location?.longitude??v.location?.lon);
  if(Number.isFinite(latitude)&&Math.abs(latitude)<=90&&Number.isFinite(longitude)&&Math.abs(longitude)<=180){
   venue={name:v.fullName,latitude,longitude,roof:v.indoor===true?'indoor':v.indoor===false?'outdoor':'unknown',locationPrecision:'stadium'};
  }else{
  const city=v.address?.city,state=v.address?.state;if(!city||!state)return {available:false,message:'Venue location incomplete.'};
  const address=v.address;
  const geo=await json('https://geocoding-api.open-meteo.com/v1/search?'+new URLSearchParams({name:city,count:'100',language:'en',format:'json'}));
  const states={AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',CT:'Connecticut',DE:'Delaware',FL:'Florida',GA:'Georgia',HI:'Hawaii',ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',KS:'Kansas',KY:'Kentucky',LA:'Louisiana',ME:'Maine',MD:'Maryland',MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',MS:'Mississippi',MO:'Missouri',MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',NJ:'New Jersey',NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',OH:'Ohio',OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',VA:'Virginia',WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming',DC:'District of Columbia'};
  const places=(geo.results||[]).filter(p=>p.country_code==='US'&&key(p.name)===key(city)&&key(p.admin1)===key(states[state]||state));
  const postal=places.filter(p=>p.postcodes?.includes(address?.zipCode));const found=postal.length===1?postal:places;
  if(found.length!==1)return {available:false,message:'Venue city coordinates could not be uniquely matched.'};
  venue={name:v.fullName,latitude:found[0].latitude,longitude:found[0].longitude,roof:v.indoor===true?'indoor':v.indoor===false?'outdoor':'unknown',locationPrecision:'city',city,state};
  }
 }
 const data={available:true,...venue,neutralSite:c.neutralSite===true,source:'ESPN matchup venue',sourceUrl:`https://www.espn.com/${sport}/game/_/gameId/${event.id}`};
 cache.set(cacheKey,{at:Date.now(),data});if(cache.size>500)cache.delete(cache.keys().next().value);return data;
}
module.exports={resolveVenue,matchEvent};
