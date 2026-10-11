'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {resolve,venues}=require('../public/venue-weather');
const games=require('../data/nfl-home-field-games-2024-2025.json');
test('catalog covers all 32 NFL home clubs with unique venue aliases and forecast coordinates',()=>{
 const clubs=new Map();for(const game of games){const values=clubs.get(game.homeName)||new Map();values.set(game.venue,(values.get(game.venue)||0)+1);clubs.set(game.homeName,values);}
 assert.equal(clubs.size,32);
 for(const [club,counts] of clubs){const name=[...counts].sort((a,b)=>b[1]-a[1])[0][0];assert.ok(resolve({season:2026,venueName:name}),club+' '+name);}
 const names=venues.flatMap(v=>[v.name,...v.aliases].map(n=>n.toLowerCase().replace(/[^a-z0-9]/g,'')));
 assert.equal(new Set(names).size,names.length);
 for(const venue of venues){assert.ok(venue.latitude>=-90&&venue.latitude<=90);assert.ok(venue.longitude>=-180&&venue.longitude<=180);}
});
test('venue lookup does not infer a home location and limits reviewed roof classifications to 2026',()=>{
 assert.equal(resolve({season:2027,venueName:'Nissan Stadium'}),null);
 assert.equal(resolve({season:2026,venueName:'Unknown',homeId:1}),null);
 assert.equal(resolve({season:2026,venueName:'NRG Stadium'}).roof,'retractable');
 assert.equal(resolve({season:2026,venueName:'Reliant Stadium'}).roof,'retractable');
 assert.equal(resolve({season:2026,venueName:'SoFi Stadium'}).roof,'covered');
 assert.equal(resolve({season:2026,venueName:'Mercedes-Benz Stadium'}).roof,'retractable');
 assert.equal(resolve({season:2026,venueName:'Mercedes-Benz Superdome'}).roof,'indoor');
});
