'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../public/index.html'),'utf8');
test('Market Pulse links to official BetMGM public betting percentages without claiming a connected feed',()=>{
  const source=html.match(/<a\s+id="market-betmgm-source"[^>]*>/)?.[0];
  assert.ok(source,'Expected visible BetMGM source link');
  assert.match(source,/href="https:\/\/sports\.betmgm\.com\/en\/blog\/betting-tools\/sportsbook-public-betting\/"/);
  assert.match(source,/target="_blank"/);
  assert.match(source,/rel="noopener noreferrer"/);
  assert.match(html,/Not automatically imported:/);
  assert.match(html,/Do not interpret ticket share as money percentage/);
  assert.doesNotMatch(html,/id="betmgm-auto-percentages"/);
});
