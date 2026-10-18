'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {selectLines,getLines}=require('../fanduel');
const now=Date.now(),q={league:'1',away:'Away',home:'Home',kickoff:now+86400000};
const fixture=()=>[{away_team:'Away',home_team:'Home',commence_time:new Date(q.kickoff).toISOString(),bookmakers:[{key:'fanduel',last_update:new Date(now).toISOString(),markets:[{key:'spreads',outcomes:[{name:'Away',point:3.5,price:-110},{name:'Home',point:-3.5,price:-110}]},{key:'totals',outcomes:[{name:'Over',point:45.5},{name:'Under',point:45.5}]}]}]}];
test('contradictory or duplicate spreads cannot become a simulated line',()=>{
 const e=fixture();assert.equal(selectLines(e,q,now).awaySpread,3.5);
 e[0].bookmakers[0].markets[0].outcomes[1].point=-4.5;
 assert.equal(selectLines(e,q,now).awaySpread,null);
 assert.equal(selectLines(e,q,now).total,45.5);
 e[0].bookmakers[0].markets.push(e[0].bookmakers[0].markets[1]);
 assert.equal(selectLines(e,q,now).total,null);
});
test('game lines trim keys, explain quota failures safely and retry after a failure',async()=>{
 const oldFetch=global.fetch,oldKey=process.env.ODDS_API_KEY;let calls=0;
 process.env.ODDS_API_KEY=' fixture ';
 global.fetch=async url=>{calls++;assert.equal(new URL(url).searchParams.get('apiKey'),'fixture');return {ok:false,status:401,json:async()=>({error_code:'OUT_OF_USAGE_CREDITS',message:'SECRET'})};};
 try{for(let i=0;i<2;i++)await assert.rejects(getLines(q),e=>/monthly usage credits exhausted/.test(e.message)&&!e.message.includes('SECRET'));assert.equal(calls,2);}
 finally{global.fetch=oldFetch;if(oldKey===undefined)delete process.env.ODDS_API_KEY;else process.env.ODDS_API_KEY=oldKey;}
});
