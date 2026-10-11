'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createRosterTransactions,rosterContains}=require('../roster-transactions');
const {digest}=require('../starter-sources');
const {assess,teamSummary}=require('../public/injury-model');
const {recommend}=require('../public/lineup-model');
const now=Date.parse('2026-10-11T14:00:00Z'),kickoff=now+3*3600000;
const review={league:'1',season:'2026',gameId:'1',teamId:'18',kickoff,name:'Moved Player',rosterName:'Moved Player',playerId:'10',position:'RB',destinationTeamId:'25',destination:'Miami Dolphins',url:'https://www.miamidolphins.com/news/move',rosterUrl:'https://www.miamidolphins.com/team/players-roster/',reviewedAt:new Date(now-1000).toISOString(),publishedAt:new Date(now-2*86400000).toISOString(),reviewedModifiedAt:new Date(now-2*86400000).toISOString(),reviewedBodyHash:digest('Reviewed claim from Washington')};
const article=body=>'<script type="application/ld+json">'+JSON.stringify({'@type':'NewsArticle',url:review.url,datePublished:review.publishedAt,dateModified:review.reviewedModifiedAt,articleBody:body})+'</script>';
const roster=rows=>'<table><thead><tr><th>Player</th><th>#</th><th>Pos</th></tr></thead>'+rows+'</table>';
const row='<tr><td><a>Moved Player</a></td><td>30</td><td>RB</td></tr>',q={league:'1',season:'2026',game:'1'},g={game:{date:{timestamp:kickoff/1000}}};
const team=()=>({id:'18',roster:{available:true,checkedAt:now,rows:[{id:'10',name:'Moved Player',position:'RB'}]},injuries:{available:true,checkedAt:now,rows:[]}});
test('destination roster requires a unique player in a recognized roster table and matching position',()=>{
 assert.equal(rosterContains(roster(row),'Moved Player','RB'),true);
 for(const html of [roster(row+row),roster(row.replace('RB','WR')),roster(row).replace('Player</th>','Name</th>'),'<div>Moved Player RB</div>'])assert.equal(rosterContains(html,'Moved Player','RB'),false);
});
test('reviewed transactions are exact-game scoped and withdraw changed article or destination roster evidence',async()=>{
 let clock=now,body='Reviewed claim from Washington',current=roster(row),calls=0;
 const load=createRosterTransactions(()=>clock,async url=>{calls++;return url===review.url?article(body):current;},[review]);const t=team();
 await load(q,[t],g);assert.equal(t.transactions.rows.length,1);assert.equal(calls,2);
 clock+=899999;await load(q,[t],g);assert.equal(t.transactions.checkedAt,now);assert.equal(calls,2);
 body='Changed claim';clock++;await load(q,[t],g);assert.equal(t.transactions.available,false);assert.equal(t.transactions.unverified,1);
 body='Reviewed claim from Washington';await load(q,[t],g);assert.equal(t.transactions.available,true);
 current=roster('');clock+=900000;await load(q,[t],g);assert.equal(t.transactions.available,false);
 current=roster(row);clock+=900000;await load(q,[t],g);assert.equal(t.transactions.available,true);
 await load({...q,game:'2'},[t],g);assert.equal(t.transactions.rows.length,0);
 await load(q,[t],{game:{date:{timestamp:kickoff/1000+1}}});assert.equal(t.transactions.rows.length,0);
 const wrong=team();wrong.roster.rows[0].id='11';await load(q,[wrong],g);assert.equal(wrong.transactions.available,false);
 const duplicate=team();duplicate.roster.rows.push({id:'99',name:'Moved Player',position:'RB'});await load(q,[duplicate],g);assert.equal(duplicate.transactions.available,false);
 clock=kickoff;await load(q,[t],g);assert.equal(t.transactions.available,false);
 const expired=createRosterTransactions(()=>now,async url=>url===review.url?article(body):current,[{...review,reviewedAt:new Date(now-86400000).toISOString()}]),expiredTeam=team();await expired(q,[expiredTeam],g);assert.equal(expiredTeam.transactions.available,false);
});
test('verified move blocks former-team props and workload suggestions without transferring identity or stats',async()=>{
 const t=team(),load=createRosterTransactions(()=>now,async url=>url===review.url?article('Reviewed claim from Washington'):roster(row),[review]);await load(q,[t],g);
 const data={current:true,teams:[t,{...team(),id:'25'}]},game={id:'1',kickoff,league:'1',season:'2026'};
 // The fresh destination provider roster still omits this player, so no provider duplicate masks this gate.
 data.teams[1].roster.rows=[];
 const result=assess(data,game,'18','10',now,true);assert.equal(result.blocked,true);assert.equal(result.state,'team-unconfirmed');assert.match(result.reason,/Miami Dolphins/);
 assert.equal(teamSummary(data,game,'18',now).unavailable[0].name,'Moved Player');
 const p={id:'10',teamId:'18',name:'Moved Player',role:'RB',position:'RB'};assert.equal(recommend([p],p,data,game,assess,now).state,'unknown');
 assert.equal(assess(data,{...game,id:'2'},'18','10',now,true).blocked,false);
 assert.equal(assess(data,{...game,league:'2'},'18','10',now,true).blocked,false);
 assert.equal(assess(data,{...game,season:'2025'},'18','10',now,true).blocked,false);
 assert.equal(assess(data,game,'25','10',now).blocked,false);
 t.transactions.checkedAt=now-900001;assert.equal(assess(data,game,'18','10',now,true).blocked,false);
 assert.deepEqual(t.roster.rows,[{id:'10',name:'Moved Player',position:'RB'}]);assert.deepEqual(data.teams[1].roster.rows,[]);
});
test('failed transaction source refresh withdraws confirmation and can recover',async()=>{
 let clock=now,fail=false;const t=team(),load=createRosterTransactions(()=>clock,async url=>{if(fail)throw Error('Offline');return url===review.url?article('Reviewed claim from Washington'):roster(row);},[review]);
 await load(q,[t],g);assert.equal(t.transactions.available,true);
 clock+=900000;fail=true;await load(q,[t],g);assert.equal(t.transactions.available,false);
 fail=false;await load(q,[t],g);assert.equal(t.transactions.available,true);assert.equal(t.transactions.checkedAt,clock);
});
