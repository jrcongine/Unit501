'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createPortraitLookup}=require('../player-portraits');
test('portraits require a unique player on a matched team and a provider-supplied photo for that ID',async()=>{
 const athlete={id:'47',displayName:'Example Player',headshot:{href:'https://a.espncdn.com/i/headshots/nfl/players/full/47.png'}};
 for(const [athletes,expected] of [[[athlete],athlete.headshot.href],[[athlete,athlete],null],[[{...athlete,id:'48'}],null],[[{...athlete,headshot:null}],null]]){
  const lookup=createPortraitLookup(async path=>({ok:true,json:async()=>path.includes('/roster')?{athletes:[{items:athletes}]}:{sports:[{leagues:[{teams:[{team:{id:'13',displayName:'Example Team'}}]}]}]}}));
  assert.equal((await lookup('nfl','Example Team','Example Player'))?.url??null,expected);
  assert.equal(await lookup('nfl','Wrong Team','Example Player'),null);
 }
});
