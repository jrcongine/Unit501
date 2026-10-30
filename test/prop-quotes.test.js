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
