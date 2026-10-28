'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const now=Date.parse('2026-10-28T18:00:00Z');
for(const [league,create] of [
 ['basketball_nba',require('../nba-odds').createNBAOdds],
 ['basketball_ncaab',require('../ncaab-markets').createMarkets]
]){
 test(league+' reports moneyline-only coverage without inventing spreads or totals',async()=>{
  const game={id:123,away:'Away Team',home:'Home Team',tipoff:'2026-10-29T00:00:00Z',status:'Scheduled',timeKnown:true};
  for(const [age,available] of [[0,true],[1800001,false]]){
   const event={id:'event',sport_key:league,away_team:game.away,home_team:game.home,commence_time:game.tipoff,
    bookmakers:[{key:'fanduel',markets:[{key:'h2h',last_update:new Date(now-age).toISOString(),
     outcomes:[{name:game.away,price:150},{name:game.home,price:-175}]}]}]};
   const feed=create({now:()=>now,key:()=> 'fixture',fetcher:async()=>({ok:true,json:async()=>[event]})});
   const result=await feed(game,'game');
   assert.equal(result.available,available);
   assert.equal(result.spread,null);assert.equal(result.total,null);
   if(available){assert.equal(result.moneyline.away,150);assert.match(result.message,/loaded/i);}
   else{assert.equal(result.moneyline,null);assert.doesNotMatch(result.message,/loaded/i);}
  }
 });
}
