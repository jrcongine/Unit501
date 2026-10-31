'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {gameQuotes}=require('../game-quotes');
const {selectLines}=require('../fanduel');
const now=1800000000000;
const event=()=>({away_team:'Away',home_team:'Home',commence_time:new Date(now+3600000).toISOString(),bookmakers:[{key:'fanduel',last_update:new Date(now).toISOString(),markets:[
 {key:'h2h',outcomes:[{name:'Away',price:150},{name:'Home',price:-175}]},
 {key:'spreads',outcomes:[{name:'Away',point:3.5,price:-110},{name:'Home',point:-3.5,price:-110}]},
 {key:'totals',outcomes:[{name:'Over',point:45.5,price:-110},{name:'Under',point:45.5,price:-110}]}
]}]});
const query=league=>({league,away:'Away',home:'Home',kickoff:now+3600000});
test('football leagues and shared basketball parser identify missing game markets without losing intact quotes',()=>{
 for(const sport of ['1','2','basketball']){
  const e=event();e.bookmakers[0].markets.pop();
  const r=['1','2'].includes(sport)?selectLines([e],query(sport),now):require('../nba-odds').gameLines(e,now);
  assert.equal(r.moneyline.away,150);assert.equal(r.total,null);
  assert.deepEqual(r.marketAudit.map(x=>x.status),['working','working','unavailable']);
  assert.equal(r.marketAudit[2].reason,'missing_market');
 }
});
test('per-market diagnostics separate timestamps, conflicts, identity and invalid price failures',()=>{
 for(const [mutate,reason] of [
  [m=>m.last_update=new Date(now-1800001).toISOString(),'stale_timestamp'],
  [m=>m.last_update=new Date(now+60001).toISOString(),'future_timestamp'],
  [m=>m.last_update='unknown','missing_timestamp'],
  [m=>m.outcomes=null,'unpaired_outcomes'],
  [m=>m.outcomes[0]=null,'unpaired_outcomes'],
  [m=>m.outcomes[0].name='Another team','conflicting_outcomes'],
  [m=>m.outcomes[0].point=4.5,'invalid_or_conflicting_line'],
  [m=>m.outcomes[0].price=50,'missing_or_invalid_price']
 ]){const e=event();mutate(e.bookmakers[0].markets[1]);const r=gameQuotes(e,now);assert.equal(r.spread,null);assert.equal(r.marketAudit[1].reason,reason);assert.equal(r.total.line,45.5);assert.equal(r.moneyline.away,150);}
 const e=event();e.bookmakers[0].markets.push(e.bookmakers[0].markets[1]);assert.equal(gameQuotes(e,now).marketAudit[1].reason,'ambiguous_market');
 e.bookmakers.push(e.bookmakers[0]);assert.ok(gameQuotes(e,now).marketAudit.every(m=>m.reason==='ambiguous_bookmaker'));
});
test('malformed containers and identical opponents cannot fabricate valid paired quotes',()=>{
 for(const e of [null,{}, {bookmakers:{}}, {...event(),bookmakers:[null]}, {...event(),home_team:'Away'}, {...event(),bookmakers:[{key:'fanduel',markets:{}}]}]){
  const r=gameQuotes(e,now);assert.equal(r.spread,null);assert.equal(r.total,null);assert.equal(r.moneyline,null);
 }
});
test('football retains verified price-free lines as partial but never retains prices from rejected pairs',()=>{
 const e=event();delete e.bookmakers[0].markets[1].outcomes[0].price;
 for(const league of ['1','2']){const r=selectLines([e],query(league),now);assert.equal(r.awaySpread,3.5);assert.equal(r.prices.away,null);assert.equal(r.marketAudit[1].status,'partial');}
 e.bookmakers[0].markets[1].outcomes[1].point=-4.5;
 const r=selectLines([e],query('1'),now);assert.equal(r.awaySpread,null);assert.equal(r.prices.home,null);assert.equal(r.prices.away,null);assert.equal(r.spreadUpdated,null);
});
test('valid zero spreads and freshness boundary remain accepted',()=>{
 const e=event(),m=e.bookmakers[0].markets[1];m.outcomes[0].point=0;m.outcomes[1].point=0;m.last_update=new Date(now-1800000).toISOString();
 assert.equal(gameQuotes(e,now).spread.away,0);assert.equal(gameQuotes(e,now+1).spread,null);
});
test('NBA and CBB request adapters deliver market diagnostics to feed health',async()=>{
 const {createHealth}=require('../data-health');
 for(const sport of ['nba','ncaab']){
  const e=event();e.sport_key='basketball_'+sport;e.id='event';e.bookmakers[0].markets[2].outcomes[0].point=99;
  const options={now:()=>now,key:()=> 'fixture',fetcher:async()=>({ok:true,json:async()=>[e]})};
  const feed=sport==='nba'?require('../nba-odds').createNBAOdds(options):require('../ncaab-markets').createMarkets(options);
  const data=await feed({id:1,away:'Away',home:'Home',tipoff:e.commence_time,status:'Scheduled',timeKnown:true},'game');
  assert.equal(data.available,true);assert.equal(data.total,null);assert.equal(data.marketAudit[2].reason,'invalid_or_conflicting_line');
  const h=createHealth({now:()=>now});h.observe(new URL('http://local/api/'+sport+'/odds'),200,data);
  const row=h.snapshot().feeds.find(r=>r.id===sport+':odds');assert.equal(row.status,'partial');assert.deepEqual(row.details,['Total: invalid or conflicting line.']);
 }
});
