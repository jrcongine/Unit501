'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {evaluate}=require('../public/betting-splits-model');
const {parse,createSplits}=require('../betting-splits');
const now=100000,game={id:'1',league:'2',season:'2026',kickoff:200000};
const report=()=>({available:true,gameId:'1',league:'2',season:'2026',kickoff:200000,fetchedAt:now,sourceAt:now,spread:{awayLine:3,homeLine:-3,awayBets:70,homeBets:30,awayMoney:35,homeMoney:65}});
test('money vs bets lean uses one bounded margin signal; public majority alone does nothing',()=>{
 assert.equal(evaluate(report(),game,3,true,now).margin,.3);
 const r=report();r.spread.awayMoney=70;r.spread.homeMoney=30;assert.equal(evaluate(r,game,3,true,now).margin,0);
 assert.equal(evaluate(report(),game,3,false,now).margin,0);
});
test('stale, missing, wrong-game or different-line splits never move scores',()=>{
 for(const r of [null,{...report(),sourceAt:null},{...report(),fetchedAt:now+1},{...report(),gameId:'2'},{...report(),league:'1'},{...report(),sourceAt:now-1800001}])assert.equal(evaluate(r,game,3,true,now).applied,false);
 assert.equal(evaluate(report(),game,3.5,true,now).applied,false);
 const r=report();r.spread.awayMoney=null;assert.equal(evaluate(r,game,3,true,now).applied,false);
});
test('public preview parser keeps paired rows and rejects mismatched sport or layout',()=>{
 const row=(team,line,money,bets)=>`<tr class="sp-row"><td data-gamecode="same"></td><td><a>${team}</a></td><td>${line}</td><td>${money}%</td><td>${bets}%</td>${'<td></td>'.repeat(6)}</tr>`;
 const html='<table class="sp-table"><thead><a href="?gamedate=2026-10-17">CFB - Saturday</a></thead>'+row('Florida',3,35,70)+row('Texas',-3,65,30)+'</table>';
 assert.equal(parse(html,'2').length,1);assert.equal(parse(html,'2')[0].spread.homeMoney,65);assert.equal(parse(html,'1').length,0);
 assert.equal(parse(html.replace('data-gamecode="same"','data-gamecode="other"'),'2').length,0);
});
