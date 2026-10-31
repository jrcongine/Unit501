'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const script=fs.readFileSync(require.resolve('../public/sport-layout.js'),'utf8');
for(const sport of ['nba','ncaab'])test(sport+' startup restores date before one slate load and independently starts league updates',()=>{
 const calls=[],field={value:'2026-10-31'},league={value:sport+'.html',addEventListener(){}},location={href:'https://example.test/'+sport+'.html?date=2026-11-05'};
 const document={querySelector:s=>s==='.sport-league'?league:s==='input[type=date]'?field:null,getElementById:id=>({click(){calls.push({kind:'slate',id,date:field.value});}})};
 vm.runInNewContext(script,{document,location,URL,window:{Unit501LeaguePulse:{show:(league,force)=>calls.push({kind:'pulse',league,force})}}});
 assert.equal(calls.length,2);assert.deepEqual(calls[0],{kind:'pulse',league:sport,force:false});assert.deepEqual(calls[1],{kind:'slate',id:sport+'-load',date:'2026-11-05'});
});
test('basketball entry defaults to college and both leagues contain local War Room and league updates',()=>{
 for(const file of ['index.html','data-health.html','nba.html','ncaab.html']){
  const html=fs.readFileSync(require.resolve('../public/'+file),'utf8');assert.match(html,/href="ncaab.html"[^>]*>[^<]*Basketball/);
  if(!['nba.html','ncaab.html'].includes(file))continue;
  assert.match(html,/href="#war-room"/);assert.match(html,/id="war-room" data-autoload="true"/);assert.match(html,/id="league-pulse"/);assert.match(html,/src="outside-picks.js"/);
  assert.match(html,new RegExp('value="'+file.replace('.html','')+'" selected'));
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length);
 }
});
