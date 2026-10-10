'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {canonicalizeGames}=require('../team-identity');
const past={league:{id:2,season:2026},game:{id:1,date:{timestamp:100},status:{short:'FT'}},teams:{away:{id:59,name:'Hawaii'},home:{id:90,name:'San Jose State'}}};
const future={...past,game:{id:2,date:{timestamp:200},status:{short:'NS'}},teams:{away:{id:901,name:'Hawai&#x27;i'},home:{id:79,name:'Arizona State'}}};
test('future-only duplicate program IDs use the one existing history, including date-slate references',()=>{
 const rows=canonicalizeGames([past,future],[past,future],'2026');
 assert.equal(rows[1].teams.away.id,59);assert.equal(rows[1].teams.away.providerId,901);
 assert.equal(rows[0].teams.away.id,59);assert.equal(future.teams.away.id,901);
 assert.equal(canonicalizeGames([future],[past,future],'2026')[0].teams.away.id,59);
});
test('conflicting completed histories, unknown seasons and distinct schools are never merged',()=>{
 const finished={...future,game:{...future.game,status:{short:'FT'}}};
 assert.equal(canonicalizeGames([past,finished],[past,finished],'2026')[1].teams.away.id,901);
 assert.equal(canonicalizeGames([past,future],[past,future],'2027')[1].teams.away.id,901);
 const different={...future,teams:{...future.teams,away:{id:901,name:'Miami (OH)'}}};
 assert.equal(canonicalizeGames([past,different],[past,different],'2026')[1].teams.away.id,901);
 assert.equal(canonicalizeGames([future],[future],'2026')[0].teams.away.id,901);
});
test('canonical identity restores complete FBS scoring coverage without counting a future alias as another team',()=>{
 const membership=require('../fbs-2026.json'),{summarize}=require('../rankings');
 const teams=membership.teams.map((t,i)=>({id:t.name==="Hawai'i"?59:1000+i,name:t.name}));
 const games=[];
 for(let week=0;week<2;week++)for(let i=0;i<138;i+=2)games.push({league:{id:2,season:2026},game:{id:games.length+1,date:{timestamp:100+week*100},status:{short:'FT'}},teams:{away:teams[i],home:teams[i+1]},scores:{away:{total:24},home:{total:24}}});
 games.push(future);
 const rawRoster=[...teams,{id:901,name:'Hawai&#x27;i'}];const query={league:'2',season:'2026',before:250000};
 assert.equal(summarize(games,new Map(),query,rawRoster).coverage.pointsFor.ranked,false);
 const clean=canonicalizeGames(games,games,'2026'),roster=new Map(clean.flatMap(g=>[g.teams.away,g.teams.home]).map(t=>[String(t.id),t]));
 const result=summarize(clean,new Map(),query,[...roster.values()]);
 assert.equal(result.coverage.pointsFor.ranked,true);assert.equal(result.coverage.pointsFor.complete,138);
 assert.equal(result.teams.find(t=>t.id==='59').games,2);
});
