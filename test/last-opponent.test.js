const test=require('node:test');
const assert=require('node:assert/strict');
const {describe,basketball}=require('../public/last-opponent');
globalThis.Unit501NBAPlayerModel=require('../public/nba-player-model');
const opp={id:'2',name:'Miami'};
const played={time:Date.parse('2025-11-09T18:00Z'),opponentId:2,status:'played',stats:{passTD:0}};
const later={...played,time:played.time+86400000};
test('latest meeting keeps zero, excludes verified DNP, other opponents and future games',()=>{
 const games=[played,{...later,status:'dnp'},{...later,opponentId:3},{...later,time:later.time+1}];
 assert.equal(describe(games,opp,'passTD',later.time+1),'0 vs Miami · Nov 9, 2025');
 for(const newer of [{...later,status:'unknown'},{...later,stats:{}}]){
  assert.equal(describe([played,newer],opp,'passTD',later.time+1),'Unavailable');
 }
});
test('basketball resolves player and opponent by verified game and team identity',()=>{
 const game={id:'44',tipoff:'2025-11-20T18:00Z'};
 const date='2025-11-09T18:00Z';
 const player={name:'Test Player',results:[{gameId:'12',player_assists:0}],inactive:[]};
 const team={id:1,available:true,gameLog:[{id:'12',opponentId:'2',tipoff:date}],players:[player]};
 const history={gameId:game.id,tipoff:game.tipoff,teams:[team,{...opp,players:[]}]};
 const quote={name:player.name,market:'player_assists'};
 assert.equal(basketball(history,quote,game),'0 vs Miami · Nov 9, 2025');
 history.teams[1].players=[player];
 assert.equal(basketball(history,quote,game),'Unavailable');
});
