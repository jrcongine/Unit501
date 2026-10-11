'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createReviewedDepth,digest}=require('../reviewed-depth');
const {createDepthCharts}=require('../depth-charts');
const now=Date.parse('2026-10-11T14:00:00Z'),kickoff=now+3*3600000;
const review={league:'1',season:'2026',gameId:'1',teamId:'26',kickoff,url:'https://www.houstontexans.com/team/depth-chart',imageUrl:'https://static.clubs.nfl.com/image/upload/texans/fixture',imageHash:digest(Buffer.from('reviewed image')),publishedDate:'2026-10-06',reviewedAt:new Date(now-1000).toISOString(),rows:[{name:'Starter QB',position:'QB',rank:1,slot:'QB:0'},{name:'Backup QB',position:'QB',rank:2,slot:'QB:0'}]};
const q={league:'1',season:'2026',game:'1',away:'26',home:'6'},html=`<img src="${review.imageUrl}">`;
test('reviewed image order is exact-game scoped and withdraws changed image/page evidence',async()=>{
 let clock=now,bytes=Buffer.from('reviewed image'),calls=0;
 const verify=createReviewedDepth(()=>clock,async()=>{calls++;return bytes;},[review]);
 const a=await verify(q,'26',kickoff,review.url,html);assert.equal(a.reviewedImage,true);assert.equal(a.rows[1].rank,2);
 clock+=3599999;assert.equal((await verify(q,'26',kickoff,review.url,html)).checkedAt,now);assert.equal(calls,1);
 await assert.rejects(verify({...q,game:'2'},'26',kickoff,review.url,html));await assert.rejects(verify(q,'27',kickoff,review.url,html));await assert.rejects(verify(q,'26',kickoff+1,review.url,html));
 await assert.rejects(verify(q,'26',kickoff,review.url,html.replace('fixture','changed')));await assert.rejects(verify(q,'26',kickoff,review.url,html+html));
 clock++;bytes=Buffer.from('updated image');await assert.rejects(verify(q,'26',kickoff,review.url,html));assert.equal(calls,2);
 bytes=Buffer.from('reviewed image');assert.equal((await verify(q,'26',kickoff,review.url,html)).checkedAt,clock);assert.equal(calls,3);
 clock=kickoff;await assert.rejects(verify(q,'26',kickoff,review.url,html));
});
test('reviewed image fallback still applies unique roster identity and preserves missing lower-depth players',async()=>{
 const verify=createReviewedDepth(()=>now,async()=>Buffer.from('reviewed image'),[review]);
 const load=createDepthCharts(()=>now,async()=>html,[],verify);
 const team={id:'26',roster:{rows:[{id:'1',name:'Starter QB',position:'QB'}]}};
 const g={game:{date:{timestamp:kickoff/1000}},teams:{away:{name:'Houston Texans'},home:{name:'Tennessee Titans'}}};
 await load(q,[team],g);assert.equal(team.depth.available,true);assert.equal(team.depth.reviewedImage,true);
 assert.equal(team.depth.rows.length,1);assert.equal(team.depth.unresolved[0].name,'Backup QB');assert.equal(team.depth.unresolved[0].rank,2);
 assert.equal(team.starters.rows.length,0);
 team.roster.rows.push({id:'2',name:'Starter QB',position:'QB'});await load(q,[team],g);assert.equal(team.depth.rows.length,0);
});
