'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {estimate,createQuarterbackImpact}=require('../quarterback-impact');
const games=[3,2,1].map(id=>({game:{id,date:{timestamp:id},status:{short:'FT'}},league:{id:'2',season:'2026'},teams:{away:{id:'1'},home:{id:'2'}}}));
const roster=[{id:'10',name:'Starter',position:'QB'},{id:'11',name:'Backup',position:'QB'}];
function boxes(backupYards=60,latestAttempts=25){return new Map(games.map((g,i)=>[String(g.game.id),[{team:{id:'1'},groups:[{name:'Passing',players:[{player:{id:'10',name:'Starter'},statistics:[{name:'comp/att',value:'10/'+(i===0?latestAttempts:25)},{name:'yards',value:200}]},{player:{id:'11',name:'Backup'},statistics:[{name:'comp/att',value:'5/10'},{name:'yards',value:backupYards}]}]}]}]]));}
test('QB estimate compares production, shrinks backup sample, and allows a stronger backup',()=>{
 const team={id:'1'};
 const low=estimate(games,boxes(),team,...roster),high=estimate(games,boxes(100),team,...roster);
 assert.ok(low.yardChange<0);assert.ok(high.yardChange>0);assert.ok(low.backupYPA>6&&low.backupYPA<8);
 assert.equal(estimate(games,boxes(60,0),team,...roster),null);
 const missing=boxes();for(const rows of missing.values())rows[0].groups[0].players.pop();
 assert.equal(estimate(games,missing,team,...roster),null);
});
test('college unique experienced backup is estimated automatically, ambiguity and conditional backup withheld',async()=>{
 const now=100000,scope={gameId:'9',kickoff:200000,season:'2026',checkedAt:now,available:true};
 const t={id:'1',roster:{...scope,rows:roster},official:{...scope,rows:[{id:'10',teamId:'1',status:'Out'},{id:'11',teamId:'1',status:'Available'}]}};
 const api=async path=>({response:path.startsWith('/games?')?games:boxes().get(path.split('=').at(-1))});
 const enrich=createQuarterbackImpact(api,()=>now),q={game:'9',league:'2',season:'2026'};
 await enrich(q,[t]);assert.equal(t.quarterback.rows.length,1);assert.equal(t.quarterback.rows[0].role,'recent backup estimate');
 t.official.rows[1].status='Questionable';await enrich(q,[t]);assert.equal(t.quarterback.rows.length,0);
});
