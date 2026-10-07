/* Availability gates, not estimates of injury severity or playing probability. */
(function (root) {
  'use strict';
  const day = 86400000;
  const normalize = value => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  function assess(data, game, teamId, playerId, now = Date.now()) {
    const unknown = reason => ({blocked:false, state:'unknown', reason});
    if (!game || !Number.isFinite(game.kickoff) || game.kickoff <= now || game.kickoff > now + 7 * day)
      return unknown('Current reports cannot establish availability for a past game or a matchup more than seven days away.');
    if (!data?.current) return unknown('Current injury reports have not been verified.');
    const team = data.teams?.find(t => String(t.id) === String(teamId));
    if (!team) return unknown('Team availability is unknown.');
    const roster = team.roster?.rows?.find(p => String(p.id) === String(playerId));
    const fresh = (time, age) => Number.isFinite(time) && time <= now && now - time <= age;
    if (team.roster?.available && fresh(team.roster.checkedAt, 3600000) && roster &&
        /\binjured reserve\b/.test(normalize(roster.group)))
      return {blocked:true,state:'unavailable',reason:'Provider roster lists injured reserve. Projection withheld until the roster changes; this is not a confirmed game-day inactive list.'};
    if (!team.injuries?.available || !fresh(team.injuries.checkedAt, 900000))
      return unknown('Injury feed unavailable or fetch expired. Refresh the reports.');
    const reports = team.injuries.rows.filter(p => String(p.id) === String(playerId) &&
      (!p.teamId || String(p.teamId) === String(teamId)));
    const dated = reports.filter(p => fresh(Date.parse(p.date), 7 * day));
    if (!dated.length) return unknown(reports.length ? 'Injury report is stale or undated; playing status is unconfirmed.' : 'No injury entry returned; playing status is unconfirmed.');
    const latest = Math.max(...dated.map(p => Date.parse(p.date)));
    const current = dated.filter(p => Date.parse(p.date) === latest);
    const statuses = [...new Set(current.map(p => normalize(p.status)))];
    if (statuses.length !== 1) return unknown('Conflicting current injury statuses; verify before using the projection.');
    const status = statuses[0];
    if (['out','injured reserve','ir','inactive'].includes(status))
      return {blocked:true,state:'unavailable',reason:`Latest provider report: ${status}. Projection and line comparison withheld; not treated as a zero-yard under.`};
    return {blocked:false,state:'conditional',reason:`Latest provider report: ${status || 'unknown'}. Projection assumes normal workload if the player participates; no playing probability is inferred.`};
  }
  function workloadProjection(baseline, percent) {
    if (!Number.isFinite(baseline) || !Number.isFinite(percent) || percent < 0 || percent > 100)
      throw new Error('Workload must be between 0 and 100 percent.');
    return baseline * percent / 100;
  }
  function teamSummary(data, game, teamId, now = Date.now()) {
    const team = data?.teams?.find(t => String(t.id) === String(teamId));
    if (!data?.current || !team || !Number.isFinite(game?.kickoff) || game.kickoff <= now || game.kickoff > now + 7 * day)
      return {unavailable:[],conditional:[],unknown:[],reason:'Current reports cannot establish availability for this matchup.'};
    const players = new Map();
    for (const p of team.injuries?.rows || []) if (p.id && (!p.teamId || String(p.teamId) === String(teamId))) players.set(String(p.id),p);
    for (const p of team.roster?.rows || []) if (p.id && /\binjured reserve\b/.test(normalize(p.group))) players.set(String(p.id),p);
    const result = {unavailable:[],conditional:[],unknown:[],reason:'Reported players only; missing entries do not confirm health. Starting roles and replacement quality are unverified.'};
    for (const [id,p] of players) {
      const status = assess(data,game,teamId,id,now);
      result[status.blocked ? 'unavailable' : status.state === 'conditional' ? 'conditional' : 'unknown']
        .push({id,name:p.name || 'Unknown player',reason:status.reason});
    }
    return result;
  }
  const api = {assess, workloadProjection,teamSummary};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Unit501InjuryModel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
