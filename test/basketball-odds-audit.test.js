'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {run}=require('../basketball-odds-audit');
const now=Date.parse('2026-11-01T18:00Z');
function setup(){
 const env={UNIT501_BASKETBALL_ODDS_AUDIT:'test-1',UNIT501_LINE_HISTORY_FILE:'/data/history.json',ODDS_API_KEY:'secret-test-key'};
 const game={id:1,away:'Chicago Bulls',home:'Boston Celtics',tipoff:'2026-11-02T00:00:00Z',status:'Scheduled',timeKnown:true};
 const sources={nba:{games:async()=>({games:[game]})},ncaab:{games:async()=>({games:[game]})}};
 const files={open:async()=>({close:async()=>{}}),writeFile:async()=>{}};
 let calls=0;
 const fetcher=async url=>{calls++;const event={id:'event',sport_key:url.includes('basketball_ncaab')?'basketball_ncaab':'basketball_nba',away_team:game.away,home_team:game.home,commence_time:game.tipoff};
 return {ok:true,status:200,headers:{get:()=> '100'},json:async()=>url.includes('/odds?')?{...event,bookmakers:[{key:'fanduel',markets:[{key:'player_points',last_update:new Date(now).toISOString(),outcomes:[{name:'Over',description:'Player',point:12.5,price:-110},{name:'Under',description:'Player',point:12.5,price:-110}]}]}]}:[event]};};
 return {env,sources,files,fetcher,now:()=>now,calls:()=>calls};
}
test('bounded audit checks two event identities and reports real props without secrets',async()=>{
 const s=setup(),r=await run(s);assert.equal(s.calls(),4);assert.equal(r.leagues.length,2);
 for(const l of r.leagues){assert.equal(l.status,'verified-response');assert.equal(l.props.accepted,1);assert.equal(l.sample[0].line,12.5);}
 assert(!JSON.stringify(r).includes('secret-test-key'));
});
test('audit skips disabled, previously consumed and low-capacity runs',async()=>{
 const s=setup();delete s.env.UNIT501_BASKETBALL_ODDS_AUDIT;assert.equal((await run(s)).status,'disabled');assert.equal(s.calls(),0);
 const prior=setup();prior.files.open=async()=>{throw Object.assign(Error(),{code:'EEXIST'});};assert.equal((await run(prior)).status,'already-run');assert.equal(prior.calls(),0);
 for(const remaining of [null,'0','13','invalid']){
  const x=setup(),base=x.fetcher;x.fetcher=async u=>({...await base(u),headers:{get:()=>remaining}});
  const r=await run(x);assert.equal(x.calls(),2);assert(r.leagues.every(l=>l.status==='capacity-unverified-or-low'));
 }
});
test('audit rejects wrong event identity and never logs upstream errors or credentials',async()=>{
 const s=setup(),base=s.fetcher;s.fetcher=async u=>{const r=await base(u);if(u.includes('/odds?'))return {...r,json:async()=>({...await r.json(),id:'wrong'})};return r;};
 assert((await run(s)).leagues.every(l=>l.status==='identity-mismatch'));
 s.fetcher=async()=>{throw Error('secret-test-key');};assert(!JSON.stringify(await run(s)).includes('secret-test-key'));
});
