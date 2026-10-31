'use strict';
const {matchPlayer}=require('./public/nba-player-model');
const suffix=name=>/\s+(Jr\.?|Sr\.?|II|III|IV|V)$/i.test(String(name||'').trim());
// Same-source IDs must agree. Retain an explicit suffix so an omitted-suffix
// row cannot bridge two conflicting identities later in the history.
function retainIdentity(player,row){
 if(!player)return true;
 if(String(player.id)!==String(row.id)||matchPlayer([player],row.name).player!==player)return false;
 if(!suffix(player.name)&&suffix(row.name))player.name=row.name;
 return true;
}
module.exports={retainIdentity};
