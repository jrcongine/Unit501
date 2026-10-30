'use strict';
// Shared strict main-line parser. Counts refer to player/market quote candidates,
// while outcomesReceived counts the provider's individual Over/Under selections.
const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
function auditProps(event,markets,now=Date.now()) {
 const books=(Array.isArray(event?.bookmakers)?event.bookmakers:[]).filter(b=>b.key==='fanduel');
 const audit={outcomesReceived:0,quotesReceived:0,accepted:0,rejected:0,duplicatesRemoved:0,reasons:{},returnedMarkets:[],missingMarkets:[],entries:[],bookmakerCount:books.length};
 const reject=(name,market,reason)=>{audit.rejected++;audit.reasons[reason]=(audit.reasons[reason]||0)+1;audit.entries.push({name,market,reason});};
 const candidates=[];
 for(const book of books)for(const market of Array.isArray(book.markets)?book.markets:[]) {
  audit.returnedMarkets.push(market.key);
  const outcomes=Array.isArray(market.outcomes)?market.outcomes:[];
  audit.outcomesReceived+=outcomes.length;
  const groups=new Map();
  for(const row of outcomes){const name=typeof row.description==='string'?row.description.trim():'';const k=name||'';if(!groups.has(k))groups.set(k,[]);groups.get(k).push(row);}
  for(const [name,raw]of groups){
   audit.quotesReceived++;
   const seen=new Set(),rows=[];
   for(const row of raw){const signature=JSON.stringify([row.name,row.point,row.price]);if(seen.has(signature)){audit.duplicatesRemoved++;continue;}seen.add(signature);rows.push(row);}
   const at=Date.parse(market.last_update||book.last_update),stat=markets[market.key];
   let reason=books.length!==1?'ambiguous_bookmaker':!stat?'unsupported_market':!name?'missing_player_name':!Number.isFinite(at)?'missing_timestamp':at>now+60000?'future_timestamp':now-at>1800000?'stale_timestamp':null;
   const over=rows.filter(r=>r.name==='Over'),under=rows.filter(r=>r.name==='Under');
   if(!reason){
    if(over.length!==1||under.length!==1||rows.length!==2)reason=over.length>1||under.length>1?'conflicting_quotes':'unpaired_quote';
    else if(!Number.isFinite(over[0].point)||!Number.isInteger(over[0].point*2)||over[0].point!==under[0].point||(!String(stat).endsWith('Yds')&&over[0].point<0))reason='invalid_or_conflicting_line';
    else if(!rows.every(r=>Number.isInteger(r.price)&&Math.abs(r.price)>=100))reason='invalid_price';
   }
   if(reason){reject(name,market.key,reason);continue;}
   candidates.push({name,stat,market:market.key,line:over[0].point,updatedAt:at,over:over[0].price,under:under[0].price});
  }
 }
 // Collapse only identical snapshots; never choose between conflicting lines/prices.
 const grouped=new Map();
 for(const p of candidates){const k=normalize(p.name)+':'+p.market;if(!grouped.has(k))grouped.set(k,[]);grouped.get(k).push(p);}
 const props=[];
 for(const rows of grouped.values()){
  const signatures=new Set(rows.map(p=>JSON.stringify([p.name,p.line,p.updatedAt,p.over,p.under])));
  if(signatures.size!==1){for(const p of rows)reject(p.name,p.market,'ambiguous_player_market');continue;}
  props.push(rows[0]);for(const p of rows.slice(1))reject(p.name,p.market,'duplicate_snapshot');
 }
 audit.accepted=props.length;
 audit.returnedMarkets=[...new Set(audit.returnedMarkets)];
 audit.missingMarkets=Object.keys(markets).filter(k=>!audit.returnedMarkets.includes(k));
 return {props,audit};
}
module.exports={auditProps,normalize};
