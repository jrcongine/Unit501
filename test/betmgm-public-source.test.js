'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const home=fs.readFileSync(path.join(__dirname,'../public/index.html'),'utf8');
const nba=fs.readFileSync(path.join(__dirname,'../public/nba.html'),'utf8');
const link='https://sports.betmgm.com/en/blog/betting-tools/sportsbook-public-betting/';
test('BetMGM source link is available outside the football matchup Game Lab and also on NBA page',()=>{
  const section=home.indexOf('id="public-betting-sources"');
  const lab=home.indexOf('id="lab"');
  assert.ok(section>0 && lab>section,'Multi-sport research link must not require a selected football matchup');
  const source=home.match(/<a\s+id="market-betmgm-source"[^>]*>/)?.[0];
  assert.ok(source,'Expected visible BetMGM source link');
  assert.ok(source.includes('href="'+link+'"'));
  assert.match(source,/target="_blank"/);
  assert.match(source,/rel="noopener noreferrer"/);
  assert.ok(nba.includes('href="'+link+'"'));
  assert.match(home,/NFL, NBA, MLB, NHL/);
});
test('BetMGM is source-attributed and not represented as an automatic or sharp-money feed',()=>{
  assert.match(home,/Not automatically imported:/);
  assert.match(home,/not the share of dollars wagered or verified sharp action/);
  assert.match(nba,/ticket share, not money share/);
  assert.doesNotMatch(home,/id="betmgm-auto-percentages"/);
});
