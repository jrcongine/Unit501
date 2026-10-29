'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {seasonStanding}=require('../public/unit501-shared-ui');

const current={
 league:'nfl',season:2026,power:{available:true,teams:[
  {id:'29',name:'Carolina Panthers',record:'3-3'},
  {id:'9',name:'Green Bay Packers',record:'4-3'},
  {id:'12',name:'New York Giants',record:'4-2-1'},
  {id:'15',name:'Other Team',record:'1-5'}
 ]}
};
test('season records are matched by name rather than unrelated game-feed IDs',()=>{
 // Team IDs are intentionally different; a foreign ID must never select another team.
 assert.equal(seasonStanding(current,'nfl','2026','Carolina Panthers').record,'3-3');
 assert.equal(seasonStanding(current,'nfl','2026','Green Bay Packers').record,'4-3');
 assert.notEqual(seasonStanding(current,'nfl','2026','Carolina Panthers').record,'4-2-1');
});
test('wrong league, season, unknown name, invalid record, or duplicate name are withheld',()=>{
 assert.equal(seasonStanding(current,'ncaaf',2026,'Green Bay Packers'),null);
 assert.equal(seasonStanding(current,'nfl',2025,'Green Bay Packers'),null);
 assert.equal(seasonStanding(current,'nfl',2026,'Unknown Packers'),null);
 assert.equal(seasonStanding({...current,power:{...current.power,available:false}},'nfl',2026,'Green Bay Packers'),null);
 const duplicate={...current,power:{...current.power,teams:[...current.power.teams,{id:'999',name:'Green Bay Packers',record:'1-5'}]}};
 assert.equal(seasonStanding(duplicate,'nfl',2026,'Green Bay Packers'),null);
 const invalid={...current,power:{...current.power,teams:[{name:'Green Bay Packers',record:'4--3'}]}};
 assert.equal(seasonStanding(invalid,'nfl',2026,'Green Bay Packers'),null);
});
test('legitimate NFL ties remain visible and names normalize punctuation/spacing',()=>{
 assert.equal(seasonStanding(current,'nfl',2026,'New York Giants').record,'4-2-1');
 assert.equal(seasonStanding(current,'nfl',2026,'green bay packers').record,'4-3');
});
