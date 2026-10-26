'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {teamCode,reportTime,latestReport,reportHeader,groupItems,parseRows,matchReport,createNBAInjuries}=require('../nba-injuries');
const url='https://ak-static.cms.nba.com/referee/injury/Injury-Report_2026-10-26_04_30PM.pdf';
const now=Date.parse('2026-10-26T20:40:00Z');
const game={id:123,statusCode:1,away:'Chicago Bulls',home:'Boston Celtics',tipoff:'2026-10-26T23:30:00Z'};
const item=(str,x,y)=>({str,transform:[0,0,0,0,x,y]});
function fixture(){
 const line=(y,...cells)=>cells.filter(([,v])=>v).map(([x,v])=>item(v,x,y));
 return [{width:842,items:[...line(533,[289,'Injury Report: 10/26/26 04:30 PM']),
  ...line(450,[24,'10/26/2026'],[121,'07:30 (ET)'],[201,'CHI@BOS'],[265,'Chicago Bulls'],[426,'Claxton, Nic'],[587,'Out']),
  ...line(430,[426,'Essengue, Noa'],[587,'Questionable']),
  ...line(410,[265,'Boston Celtics'],[426,'Carter, Devin'],[587,'Out']),
  ...line(390,[24,'10/27/2026'],[121,'07:30 (ET)'],[201,'BKN@BOS'],[265,'Brooklyn Nets'],[667,'NOT YET SUBMITTED']),
  ...line(370,[265,'Boston Celtics'],[667,'NOT YET SUBMITTED'])]}];
}
test('official report timestamps use Eastern time, handle DST and reject stale/untrusted files',()=>{
 assert.equal(reportTime('2026-10-26','04','30','PM'),Date.parse('2026-10-26T20:30:00Z'));
 assert.equal(reportTime('2026-11-02','04','30','PM'),Date.parse('2026-11-02T21:30:00Z'));
 assert.equal(reportTime('2026-11-01','01','30','AM'),null);
 assert.equal(latestReport(url,now).url,url);
 assert.equal(latestReport(url,now+3*3600000),null);
 assert.equal(latestReport(url.replace('ak-static.cms.nba.com','example.com'),now),null);
 assert.equal(teamCode('Los Angeles Clippers'),'LAC');assert.equal(teamCode('unknown'),null);
});
test('report parser matches exact matchup and treats not-submitted reports as unknown',()=>{
 const pages=fixture();assert.equal(reportHeader(pages),Date.parse('2026-10-26T20:30:00Z'));
 const parsed=parseRows(groupItems(pages)),teams=matchReport(parsed,game);
 assert.deepEqual(teams.map(t=>[t.code,t.available,t.players]),[
  ['CHI',true,[{name:'Nic Claxton',status:'Out'},{name:'Noa Essengue',status:'Questionable'}]],
  ['BOS',true,[{name:'Devin Carter',status:'Out'}]]]);
 assert.equal(matchReport(parsed,{...game,tipoff:'2026-10-26T22:30:00Z'}),null);
 assert.equal(matchReport(parsed,{...game,away:'Detroit Pistons'}),null);
 const pending=matchReport(parsed,{...game,away:'Brooklyn Nets',tipoff:'2026-10-27T23:30:00Z'});
 assert.ok(pending.every(t=>!t.available&&t.players.length===0));
});
test('conflicting player statuses are withheld rather than guessed',()=>{
 const pages=fixture();pages[0].items.push(item('Claxton, Nic',426,420),item('Probable',587,420));
 const teams=matchReport(parseRows(groupItems(pages)),game);
 assert.equal(teams[0].available,false);assert.deepEqual(teams[0].players,[]);
});
test('shared NBA report import caches public requests and checks report timestamp',async()=>{
 let count=0,clock=now;
 const fetcher=async target=>{count++;return target===url?{ok:true,headers:new Headers(),arrayBuffer:async()=>new Uint8Array(101).buffer}:{ok:true,text:async()=>url};};
 const load=createNBAInjuries({now:()=>clock,fetcher,extract:async()=>fixture()});
 const [a,b]=await Promise.all([load(game,2026),load(game,2026)]);
 assert.deepEqual(a,b);assert.equal(count,2);assert.equal(a.teams[0].players[0].name,'Nic Claxton');
 await load(game,2026);assert.equal(count,2);
 clock+=300001;await load(game,2026);assert.equal(count,4);
 const wrong=createNBAInjuries({now:()=>now,fetcher,extract:async()=>{const p=fixture();p[0].items[0].str='Injury Report: 10/26/26 04:15 PM';return p;}});
 await assert.rejects(wrong(game,2026),/timestamp mismatch/);
 await assert.rejects(load({...game,tipoff:'2026-10-26T20:30:00Z'},2026),/Scheduled/);
});

test('PDF extraction reads column positions from a real PDF byte stream',async()=>{
 const {extractPDF}=require('../nba-injuries');
 const commands=[
  'BT /F1 12 Tf 289 533 Td (Injury Report: 10/26/26 04:30 PM) Tj ET',
  'BT /F1 10 Tf 24 450 Td (10/26/2026) Tj ET',
  'BT /F1 10 Tf 121 450 Td (07:30 \\(ET\\)) Tj ET',
  'BT /F1 10 Tf 201 450 Td (CHI@BOS) Tj ET',
  'BT /F1 10 Tf 265 450 Td (Chicago Bulls) Tj ET',
  'BT /F1 10 Tf 426 450 Td (Claxton, Nic) Tj ET',
  'BT /F1 10 Tf 587 450 Td (Out) Tj ET',
  'BT /F1 10 Tf 265 410 Td (Boston Celtics) Tj ET',
  'BT /F1 10 Tf 667 410 Td (NOT YET SUBMITTED) Tj ET'
 ].join('\n');
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  '<< /Length '+Buffer.byteLength(commands)+' >>\nstream\n'+commands+'\nendstream'];
 let body='%PDF-1.4\n',offsets=[0];
 for(let i=0;i<objects.length;i++){offsets.push(Buffer.byteLength(body));body+=(i+1)+' 0 obj\n'+objects[i]+'\nendobj\n';}
 const xref=Buffer.byteLength(body);body+='xref\n0 '+(objects.length+1)+'\n0000000000 65535 f \n';
 for(const offset of offsets.slice(1))body+=String(offset).padStart(10,'0')+' 00000 n \n';
 body+='trailer\n<< /Size '+(objects.length+1)+' /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF\n';
 const pages=await extractPDF(Buffer.from(body));assert.equal(reportHeader(pages),Date.parse('2026-10-26T20:30:00Z'));
 const teams=matchReport(parseRows(groupItems(pages)),game);
 assert.equal(teams[0].players[0].name,'Nic Claxton');assert.equal(teams[0].players[0].status,'Out');assert.equal(teams[1].available,false);
});

test('unparsed or empty team rows stay unknown instead of claiming a clean report',()=>{
 const pages=fixture();
 pages[0].items=pages[0].items.filter(i=>!(i.transform[5]===410&&i.transform[4]>=420));
 let result=matchReport(parseRows(groupItems(pages)),game);
 assert.equal(result[1].available,false);
 pages[0].items.push(item('NO INJURIES TO REPORT',667,410));
 result=matchReport(parseRows(groupItems(pages)),game);
 assert.equal(result[1].available,true);assert.deepEqual(result[1].players,[]);
 const bad=fixture();bad[0].items.find(i=>i.str==='Out').str='Unknown Status';
 result=matchReport(parseRows(groupItems(bad)),game);
 assert.equal(result[0].available,false);assert.deepEqual(result[0].players,[]);
});
