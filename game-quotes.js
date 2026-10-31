'use strict';
// One validation path for NFL, CFB, NBA and CBB game markets. Football can
// retain a verified line without prices; that market is explicitly incomplete.
const price=n=>Number.isInteger(n)&&Math.abs(n)>=100;
const half=n=>Number.isFinite(n)&&Number.isInteger(n*2);
function gameQuotes(event,now=Date.now(),bookKey='fanduel',{requirePrices=true}={}){
 const books=(Array.isArray(event?.bookmakers)?event.bookmakers:[]).filter(b=>b?.key===bookKey);
 const book=books.length===1?books[0]:null;
 const result={spread:null,total:null,moneyline:null,marketAudit:[]};
 const teamValid=typeof event?.away_team==='string'&&event.away_team.trim()&&typeof event?.home_team==='string'&&event.home_team.trim()&&event.away_team.trim()!==event.home_team.trim();
 for(const [key,field] of [['h2h','moneyline'],['spreads','spread'],['totals','total']]){
  const entry={market:key,status:'unavailable',reason:null};result.marketAudit.push(entry);
  const markets=(Array.isArray(book?.markets)?book.markets:[]).filter(m=>m?.key===key);
  if(!teamValid){entry.reason='invalid_teams';continue;}
  if(!book){entry.reason=books.length?'ambiguous_bookmaker':'missing_bookmaker';continue;}
  if(markets.length!==1){entry.reason=markets.length?'ambiguous_market':'missing_market';continue;}
  const market=markets[0],stamp=market.last_update||book.last_update;
  const at=typeof stamp==='string'?Date.parse(stamp):NaN;
  if(!Number.isFinite(at)){entry.reason='missing_timestamp';continue;}
  if(at>now+60000){entry.reason='future_timestamp';continue;}
  if(now-at>1800000){entry.reason='stale_timestamp';continue;}
  const rows=market.outcomes;
  if(!Array.isArray(rows)||rows.length!==2||rows.some(r=>!r||typeof r!=='object')){entry.reason='unpaired_outcomes';continue;}
  const names=key==='totals'?['Over','Under']:[event.away_team,event.home_team];
  const first=rows.filter(r=>r.name===names[0]),second=rows.filter(r=>r.name===names[1]);
  if(first.length!==1||second.length!==1){entry.reason='conflicting_outcomes';continue;}
  const [a,b]=[first[0],second[0]];
  if(key==='spreads'&&(!half(a.point)||b.point!==-a.point)||key==='totals'&&(!half(a.point)||a.point<=0||b.point!==a.point)){
   entry.reason='invalid_or_conflicting_line';continue;
  }
  const priced=price(a.price)&&price(b.price);
  if(!priced&&(requirePrices||key==='h2h')){entry.reason='missing_or_invalid_price';continue;}
  if(key==='h2h')result[field]={away:a.price,home:b.price,updatedAt:at};
  if(key==='spreads')result[field]={away:a.point,home:b.point,awayPrice:price(a.price)?a.price:null,homePrice:price(b.price)?b.price:null,updatedAt:at};
  if(key==='totals')result[field]={line:a.point,over:price(a.price)?a.price:null,under:price(b.price)?b.price:null,updatedAt:at};
  entry.status=priced?'working':'partial';entry.reason=priced?null:'missing_or_invalid_price';
 }
 return result;
}
module.exports={gameQuotes};
