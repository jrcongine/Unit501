'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {retainIdentity}=require('../basketball-player-identity');
test('history names preserve explicit suffix evidence and never cross provider IDs',()=>{
 const p={id:'1',name:'Jose ONeal'};
 assert.equal(retainIdentity(p,{id:'1',name:"José O'Neal Jr."}),true);
 assert.equal(retainIdentity(p,{id:'1',name:'Jose ONeal'}),true);
 assert.equal(retainIdentity(p,{id:'1',name:'Jose ONeal III'}),false);
 assert.equal(retainIdentity(p,{id:'2',name:p.name}),false);
 assert.equal(retainIdentity(p,{id:'1',name:'Different Person'}),false);
 assert.equal(retainIdentity(p,{id:'1',name:''}),false);
});
