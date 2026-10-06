'use strict';
const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const aliases = new Map(require('./fbs-2026.json').teams.flatMap(team =>
  team.aliases.map(alias => [normalize(alias), normalize(team.name)])));
aliases.set('southern mississippi golden eagles', 'southern miss');
function teamMatches(provider, requested, college) {
  const a=normalize(provider), b=normalize(requested);
  if(!a || !b) return false;
  if(a===b) return true;
  if(!college) return false;
  const knownA=aliases.get(a), knownB=aliases.get(b);
  if(knownA && knownB) return knownA===knownB;
  const suffix=a.startsWith(b+' ')?a.slice(b.length+1):'';
  const otherSchool=/^(state|tech|a m|southern|northern|eastern|western|central|oh|ohio|fl|florida)( |$)/.test(suffix);
  return Boolean(suffix && !otherSchool);
}
function matches(event,q) {
  return teamMatches(event.away_team,q.away,q.league==='2') &&
    teamMatches(event.home_team,q.home,q.league==='2') &&
    Math.abs(Date.parse(event.commence_time)-q.kickoff)<10800000;
}
function missingMatchMessage(events,q) {
  const names=events.filter(e=>teamMatches(e.away_team,q.away,q.league==='2') && teamMatches(e.home_team,q.home,q.league==='2'));
  if(events.filter(e=>matches(e,q)).length>1) return 'Multiple matching events returned by the odds feed. Automatic selection withheld; enter lines manually.';
  if(names.length) return 'Teams found in the odds feed, but kickoff differs by three hours or more. Verify the selected date and time; enter lines manually.';
  return 'This matchup was not found under recognized team names in the odds feed. It may be missing from the feed or use another name. Enter lines manually.';
}
module.exports={teamMatches,matches,missingMatchMessage};
