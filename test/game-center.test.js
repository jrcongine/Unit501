'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {safeLogo,gameView}=require('../public/game-center');
test('matchup shell accepts only trusted HTTPS logos and preserves missing data',()=>{
 for(const url of ['javascript:alert(1)','https://espncdn.com.evil.test/a.png','http://a.espncdn.com/a.png','https://user:pass@a.espncdn.com/a.png'])assert.equal(safeLogo(url),false);
 assert.equal(safeLogo('https://a.espncdn.com/i/teamlogos/nfl/500/ne.png'),true);
 const g=gameView({id:7,a:'Patriots',h:'Dolphins',kickoff:1700000000000,awayLogo:'javascript:x'},'nfl');
 assert.equal(g.awayLogo,null);assert.equal(g.homeLogo,null);assert.equal(g.awayScore,undefined);assert.equal(g.venue,'');assert.equal(g.league,'nfl');
 assert.equal(gameView({},'nba'),null);
 const basket=gameView({id:'basket',away:'Bulls',home:'Heat',tipoff:'2026-11-01T22:00:00Z',awayScore:0,homeScore:0},'nba');
 assert.equal(basket.kickoff,Date.parse('2026-11-01T22:00:00Z'));assert.equal(basket.awayScore,0);
});
test('every supported client loads the same shell after its existing controllers',()=>{
 const fs=require('node:fs'),path=require('node:path');
 for(const file of ['index.html','nba.html','ncaab.html']){
  const html=fs.readFileSync(path.join(__dirname,'../public',file),'utf8');
  assert.match(html,/game-center\.css/);assert.ok(html.indexOf('game-center.js')>html.indexOf('sport-layout.js'));
 }
});
