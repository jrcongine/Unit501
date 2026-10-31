'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {auditProps}=require('../prop-quotes');
const {createHistory,footballTarget}=require('../line-history');
const now=Date.now(),markets={player_pass_yds:'passYds'};
const rows=(name='José Player',line=20.5)=>['Over','Under'].map(side=>({name:side,description:name,point:line,price:-110}));
const m=(outcomes=rows(),key='player_pass_yds',at=now)=>({key,last_update:new Date(at).toISOString(),outcomes});
const event=ms=>({bookmakers:[{key:'fanduel',markets:ms}]});
test('audit accounts for every candidate and reports exact missing market coverage',()=>{
 const {props,audit}=auditProps(event([m(),m(rows('Stale'),'player_pass_yds',now-1800001),m(rows('Alternate'),'alternate'),m(rows('One').slice(0,1)),m(rows('Price').map(r=>({...r,price:0})))]),{...markets,player_receptions:'rec'},now);
 assert.equal(props.length,1);assert.equal(audit.quotesReceived,5);assert.equal(audit.outcomesReceived,9);
 assert.equal(audit.accepted+audit.rejected,audit.quotesReceived);
 assert.deepEqual(audit.reasons,{stale_timestamp:1,unsupported_market:1,unpaired_quote:1,invalid_price:1});
 assert.deepEqual(audit.missingMarkets,['player_receptions']);
});
test('identical repeats recover once; conflicting duplicates and duplicate bookmakers stay blocked',()=>{
 const first=m([...rows(),rows()[0]]);
 const {props,audit}=auditProps(event([first,first]),markets,now);
 assert.equal(props.length,1);assert.equal(audit.duplicatesRemoved,2);assert.equal(audit.reasons.duplicate_snapshot,1);
 assert.equal(auditProps(event([m(),m(rows('José Player',21.5))]),markets,now).props.length,0);
 const e=event([m()]);e.bookmakers.push(e.bookmakers[0]);assert.equal(auditProps(e,markets,now).props.length,0);
});
test('recovered quote reaches shared history with the provider timestamp, audit unchanged',()=>{
 const result=auditProps(event([m(),m()]),markets,now);
 result.props=result.props.map(({market,...p})=>p);
 const history=createHistory({now:()=>now});
 const target=footballTarget({league:'2',away:'Baylor',home:'UCF',kickoff:now+3600000},'props');
 const captured=history.capture(target,result);
 assert.equal(captured.props[0].history.firstLine,20.5);assert.equal(captured.props[0].history.firstAt,now);
 assert.deepEqual(captured.audit,result.audit);
});

test('malformed nested provider records cannot erase independent valid paired props',()=>{
 const e=event([null,false,{},m([...rows(),null,7,[]]),m(rows('Unpaired').slice(0,1))]);e.bookmakers.unshift(null,[]);
 const result=auditProps(e,markets,now);
 assert.equal(result.props.length,1);assert.equal(result.props[0].name,'José Player');assert.equal(result.props[0].line,20.5);
 assert.equal(result.audit.accepted+result.audit.rejected,result.audit.quotesReceived);
 assert.equal(result.audit.reasons.unpaired_quote,1);
 assert.deepEqual(result.audit.malformedRecords,{bookmakers:2,markets:3,outcomes:3});
});

test('malformed props preserve football and basketball parsers and source timestamps',()=>{
 const {parseProps}=require('../fanduel-props'),{auditPlayerLines}=require('../nba-odds');
 const football=event([m([...rows(),null])]);assert.equal(parseProps(football,now)[0].updatedAt,now);
 const basketball=event([null,m([...rows(),null],'player_points')]);const result=auditPlayerLines(basketball,now);assert.equal(result.props.length,1);assert.equal(result.props[0].market,'player_points');assert.equal(result.props[0].updatedAt,now);
 for(const bad of [null,[],{}, {bookmakers:[{key:'fanduel',markets:null}]}])assert.deepEqual(auditProps(bad,markets,now).props,[]);
});

test('unknown inherited market names never become supported prop markets',()=>{
 for(const key of ['constructor','toString','__proto__']){
  const result=auditProps(event([m(rows(),key),m()]),markets,now);
  assert.equal(result.props.length,1);assert.equal(result.audit.reasons.unsupported_market,1);
 }
 const result=auditProps(event([{key:'player_pass_yds',outcomes:null}]),markets,now);
 assert.equal(result.audit.malformedRecords.markets,1);assert.deepEqual(result.audit.returnedMarkets,['player_pass_yds']);assert.deepEqual(result.audit.missingMarkets,[]);assert.deepEqual(result.props,[]);
});
