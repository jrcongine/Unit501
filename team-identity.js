'use strict';
const membership=require('./fbs-2026.json');
const {decodePunctuation}=require('./team-names');
const normalize = name => decodePunctuation(name).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const fbsAliases = new Map(membership.teams.flatMap(team => team.aliases.map(alias => [normalize(alias), team.name])));
function fbsName(team, season) {
  if (String(season) !== membership.season) return null;
  // API-Sports mislabeled these IDs in its 2026 NCAA feed. Verified Oct 2
  // against all 12 opponents and the four completed-game scores at:
  // https://ubbulls.com/sports/football/schedule/text/2026
  // https://riceowls.com/sports/football/schedule/text
  // Scope corrections to both ID and exact name; Buffalo State is a different school.
  if (String(team?.id) === '141' && team.name === 'Buffalo State') return 'Buffalo';
  if (String(team?.id) === '36' && team.name === 'Jerry Rice Team') return 'Rice';
  return fbsAliases.get(normalize(team?.name)) || null;
}

// Collapse a future-only duplicate provider ID only when exactly one ID for
// the same verified FBS program has completed-game history. Conflicting
// historical IDs remain unresolved and keep national coverage gates closed.
function canonicalizeGames(games,reference,season){
 const schools=new Map();
 for(const g of reference){
  if(String(g.league?.id)!=='2'||String(g.league?.season)!==String(season))continue;
  for(const t of [g.teams?.away||g.teams?.visitors,g.teams?.home]){
   const school=fbsName(t,season);if(!school||!t?.id)continue;
   if(!schools.has(school))schools.set(school,new Map());
   const ids=schools.get(school),id=String(t.id);if(!ids.has(id))ids.set(id,{team:t,completed:false});
   if(['FT','AOT','FINAL'].includes(g.game?.status?.short)&&Number(g.game?.date?.timestamp)>0)ids.get(id).completed=true;
  }
 }
 const aliases=new Map();
 for(const ids of schools.values()){
  const active=[...ids.values()].filter(t=>t.completed);
  if(ids.size>1&&active.length===1)for(const [id]of ids)aliases.set(id,active[0].team);
 }
 return games.map(g=>{
  if(String(g.league?.id)!=='2'||String(g.league?.season)!==String(season))return g;
  const teams={...g.teams};
  for(const side of ['away','visitors','home']){
   const own=teams[side],canonical=aliases.get(String(own?.id));
   if(canonical&&fbsName(own,season)===fbsName(canonical,season))teams[side]={...own,id:canonical.id,name:canonical.name,providerId:own.id};
  }
  return {...g,teams};
 });
}
module.exports={fbsName,canonicalizeGames};
