'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {run}=require('../football-odds-audit');
function fixture(){
 const env={UNIT501_FOOTBALL_ODDS_AUDIT:'dry-run',ODDS_API_KEY:'audit-key',API_SPORTS_KEY:'schedule-key',UNIT501_LINE_HISTORY_FILE:'/data/history'};
 const files={open:async()=>({close:async()=>{}}),writeFile:async()=>{}};
 const now=()=>Date.parse('2027-01-05T12:00Z'),tipoff='2027-01-06T02:00Z';
 const options={env,files,now,remaining:'100',paid:0,drift:false};
 options.api=async endpoint=>{
  const params=new URL(endpoint,'http://local').searchParams;
  assert.equal(params.get('season'),'2026');assert.equal(params.get('date'),'2027-01-05');
  return {response:[{league:{id:params.get('league'),season:2026},game:{status:{short:'NS'},date:{timestamp:Date.parse(tipoff)/1000}},teams:{away:{name:'Away'},home:{name:'Home'}}}]};
 };
 options.fetcher=async url=>{
  const sport_key=url.includes('americanfootball_nfl')?'americanfootball_nfl':'americanfootball_ncaaf';
  const event={sport_key,id:'event',away_team:'Away',home_team:'Home',commence_time:tipoff};
  const paid=url.includes('/odds?');if(paid)options.paid++;
  return {ok:true,headers:{get:()=>options.remaining},json:async()=>paid?{...event,id:options.drift?'other':event.id,bookmakers:[]}:[event]};
 };
 return options;
}
test('football audit verifies independent schedules and quote identity in both leagues',async()=>{
 const options=fixture();const result=await run(options);
 assert.equal(options.paid,2);assert.equal(result.leagues.length,2);
 for(const row of result.leagues){assert.equal(row.status,'verified-response');assert.equal(row.received,0);assert.equal(row.moneyline,false);assert.equal(row.missingMarkets.length,8);}
 assert(!JSON.stringify(result).includes('audit-key'));
 options.drift=true;assert((await run(options)).leagues.every(row=>row.status==='identity-mismatch'));
});
test('football audit cannot spend odds credits without capacity or a new persistent marker',async()=>{
 const options=fixture();options.remaining='unknown';
 assert((await run(options)).leagues.every(row=>row.status==='events-or-capacity-unavailable'));
 options.files.open=async()=>{throw Object.assign(Error(),{code:'EEXIST'});};
 assert.equal((await run(options)).status,'already-run');assert.equal(options.paid,0);
});
