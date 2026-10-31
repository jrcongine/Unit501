'use strict';
// Shared roster identity matching for official injury and depth reports.
const clean = value => String(value || '').replace(/<[^>]*>/g,' ').replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16))).replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n))).replace(/&amp;/g,'&').replace(/&apos;|&quot;/g,"'").replace(/\s+/g,' ').trim();
const key = value => clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
// Only terminal generational suffixes are formatting differences. Conflicting explicit
// suffixes and multiple candidates stay unresolved, even if one name is exact.
const nameParts = value => {
  const name=clean(value), suffix=/\s+(Jr\.?|Sr\.?|II|III|IV|V)$/i.exec(name);
  return {base:key(suffix?name.slice(0,suffix.index):name),suffix:suffix?key(suffix[1]):''};
};
const {compatible:compatiblePosition}=require('./public/football-position');
const aliases = require('./injury-name-aliases.json');
function matchPlayer(row, roster, teamId, scope={}) {
  const source=nameParts(row.name);
  if(!source.base)return null;
  const alias=aliases.find(a=>(!a.league||String(scope.league)===a.league)&&(!a.season||String(scope.season)===a.season)&&String(a.teamId)===String(teamId)&&key(a.reportName)===key(row.name)&&key(a.position)===key(row.position));
  const candidates=roster.filter(p=>{
    const target=nameParts(p.name);
    return target.base===source.base || (alias&&String(p.id)===alias.playerId&&key(p.name)===key(alias.rosterName));
  });
  if(candidates.length!==1)return null;
  const p=candidates[0],target=nameParts(p.name);
  const exact=key(p.name)===key(row.name);
  if(!exact&&!compatiblePosition(p.position,row.position))return null;
  if(source.suffix&&target.suffix&&source.suffix!==target.suffix)return null;
  return p;
}
module.exports={clean,key,matchPlayer};
