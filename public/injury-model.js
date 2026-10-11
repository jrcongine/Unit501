/* Availability gates, not estimates of injury severity or playing probability. */
(function (root) {
  'use strict';
  const day = 86400000;
  const normalize = value => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  function refreshDue(data, game, now = Date.now()) {
    if (!Number.isFinite(game?.kickoff) || game.kickoff <= now || game.kickoff > now + 7 * day) return false;
    if (!data?.current || !data.teams?.length) return true;
    return data.teams.some(team => [[team.injuries,900000],[team.roster,3600000]].some(([report,age]) =>
      !report?.available || !Number.isFinite(report.checkedAt) || report.checkedAt > now || now-report.checkedAt >= age));
  }
  function assess(data, game, teamId, playerId, now = Date.now(), requireMembership = false) {
    const unknown = reason => ({blocked:false, state:'unknown', reason});
    if (!game || !Number.isFinite(game.kickoff) || game.kickoff <= now || game.kickoff > now + 7 * day)
      return unknown('Current reports cannot establish availability for a past game or a matchup more than seven days away.');
    if (!data?.current) return unknown('Current injury reports have not been verified.');
    const team = data.teams?.find(t => String(t.id) === String(teamId));
    if (!team) return unknown('Team availability is unknown.');
    const roster = team.roster?.rows?.find(p => String(p.id) === String(playerId));
    const fresh = (time, age) => Number.isFinite(time) && time <= now && now - time <= age;
    if(requireMembership && team.roster?.available && team.roster.rows?.length && fresh(team.roster.checkedAt,3600000) && !roster)
      return {blocked:true,state:'team-unconfirmed',reason:'Player is absent from this team’s current provider roster. Projection withheld; verify a trade or roster change before using older team stats.'};
    const ownership=data.rosterOwnership;
    if(ownership?.available&&String(ownership.league)===String(game.league)&&String(ownership.season)===String(game.season)&&fresh(ownership.checkedAt,3600000)&&
       (ownership.conflicts||[]).some(p=>String(p.id)===String(playerId)&&new Set(p.teamIds?.map(String)).size>1&&p.teamIds.map(String).includes(String(teamId))))
      return {blocked:true,state:'conflict',reason:'Player appears on multiple current NFL team rosters, including a team outside this matchup. Projection and replacement scenario withheld until ownership is resolved; no trade is inferred.'};
    const rosterOwners = new Set((data.teams || []).filter(t => t.roster?.available && fresh(t.roster.checkedAt,3600000) &&
      t.roster.rows?.some(p => String(p.id) === String(playerId))).map(t => String(t.id)));
    if(rosterOwners.size > 1)
      return {blocked:true,state:'conflict',reason:'Player appears on multiple current team rosters. Projection and replacement scenario withheld until team membership is resolved; no trade or injury is inferred.'};
    const moves=team.transactions;
    if(moves?.available&&String(moves.league)===String(game.league)&&String(moves.season)===String(game.season)&&String(moves.gameId)===String(game.id)&&moves.kickoff===game.kickoff&&fresh(moves.checkedAt,900000)){
      const matching=(moves.rows||[]).filter(r=>String(r.id)===String(playerId)&&String(r.teamId)===String(teamId)&&fresh(r.sourceCheckedAt,900000)&&fresh(Date.parse(r.reviewedAt),86400000));
      if(matching.length===1)return {blocked:true,state:'team-unconfirmed',reason:`Reviewed official move to ${matching[0].destination}; current destination roster rechecked. Former-team projection withheld while the provider listing is stale. Stats and workload are not transferred.`,source:matching[0].url};
    }
    const starters=team.starters;
    if(roster?.position==='QB' && team.roster?.available && fresh(team.roster.checkedAt,3600000) &&
       String(starters?.gameId)===String(game.id) && starters?.kickoff===game.kickoff && fresh(starters.checkedAt,900000)) {
      const named=starters.rows.filter(r=>r.position==='QB' && fresh(Date.parse(r.publishedAt),7*day));
      if(named.length===1 && String(named[0].id)!==String(playerId))
        return {blocked:true,state:'nonstarter',reason:`${named[0].publisher} announced ${named[0].name} as starting QB for this matchup. Normal full-game props for another QB are withheld; this does not mean the player is injured or inactive.`};
    }
    if (team.roster?.available && fresh(team.roster.checkedAt, 3600000) && roster &&
        /\binjured reserve\b/.test(normalize(roster.group)))
      return {blocked:true,state:'unavailable',reason:'Provider roster lists injured reserve. Projection withheld until the roster changes; this is not a confirmed game-day inactive list.'};
    const official = team.official;
    const officialRows = official?.available && String(official.gameId) === String(game.id) && official.kickoff === game.kickoff &&
      fresh(official.checkedAt,900000) ? official.rows.filter(p => String(p.id) === String(playerId) && String(p.teamId) === String(teamId)) : [];
    const officialStatuses = [...new Set(officialRows.map(p=>normalize(p.status)).filter(Boolean))];
    if(officialStatuses.length > 1)
      return {blocked:true,state:'conflict',reason:'Conflicting official game statuses. Projection and line comparison withheld until resolved.'};
    const officialStatus=officialStatuses[0];
    if(officialStatus === 'out' || officialStatus === 'inactive')
      return {blocked:true,state:'unavailable',reason:`${official.publisher || `Official NFL Week ${official.week}`}: ${officialStatus}. Projection and line comparison withheld; not treated as a zero-yard under.`};
    if (officialStatus && (!team.injuries?.available || !fresh(team.injuries.checkedAt,900000)))
      return {blocked:false,state:'conditional',reason:`${official.publisher || 'Official NFL'} report: ${officialStatus}. Starting role and workload remain unconfirmed; no participation probability is inferred.`};
    if (!team.injuries?.available || !fresh(team.injuries.checkedAt, 900000))
      return unknown('Injury feed unavailable or fetch expired. Refresh the reports.');
    const reports = team.injuries.rows.filter(p => String(p.id) === String(playerId) &&
      (!p.teamId || String(p.teamId) === String(teamId)));
    const dated = reports.filter(p => fresh(Date.parse(p.date), 7 * day));
    if (!dated.length && officialStatus) return {blocked:false,state:'conditional',reason:`${official.publisher || 'Official NFL'} report: ${officialStatus}. Starting role and workload remain unconfirmed; no participation probability is inferred.`};
    if (!dated.length) return unknown(reports.length ? 'Injury report is stale or undated; playing status is unconfirmed.' : 'No injury entry returned; playing status is unconfirmed.');
    const latest = Math.max(...dated.map(p => Date.parse(p.date)));
    const current = dated.filter(p => Date.parse(p.date) === latest);
    const statuses = [...new Set(current.map(p => normalize(p.status)))];
    if (statuses.length !== 1) return {blocked:true,state:'conflict',reason:'Conflicting current injury statuses. Projection and line comparison withheld until resolved.'};
    if (officialStatus && statuses[0] && officialStatus !== statuses[0])
      return {blocked:true,state:'conflict',reason:`${official.publisher || 'Official NFL'} report (${officialStatus}) conflicts with provider (${statuses[0]}). Projection and line comparison withheld; starter and workload need verification.`};
    const status = statuses[0];
    if (['out','injured reserve','ir','inactive','sidelined','i l','pup','physically unable to perform','suspended'].includes(status))
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
    const ownership=data.rosterOwnership;
    if(ownership?.available&&String(ownership.league)===String(game.league)&&String(ownership.season)===String(game.season)&&Number.isFinite(ownership.checkedAt)&&ownership.checkedAt<=now&&now-ownership.checkedAt<=3600000)
      for(const p of team.roster?.rows||[])if((ownership.conflicts||[]).some(c=>String(c.id)===String(p.id)&&c.teamIds?.map(String).includes(String(teamId))))players.set(String(p.id),p);
    if(team.starters?.rows?.length)for(const p of team.roster?.rows || [])if(p.id && p.position==='QB')players.set(String(p.id),p);
    for(const p of team.transactions?.rows||[])if(p.id)players.set(String(p.id),p);
    for (const p of team.official?.rows || []) if (p.id && p.status) players.set(String(p.id),p);
    for (const p of team.injuries?.rows || []) if (p.id && (!p.teamId || String(p.teamId) === String(teamId))) players.set(String(p.id),p);
    for (const p of team.roster?.rows || []) if (p.id && /\binjured reserve\b/.test(normalize(p.group))) players.set(String(p.id),p);
    const result = {unavailable:[],conditional:[],unknown:[],conflicts:[],nonstarters:[],reason:'Reported players only; missing entries do not confirm health. Starting roles and replacement quality are unverified.'};
    for (const [id,p] of players) {
      const status = assess(data,game,teamId,id,now);
      result[status.state === 'nonstarter' ? 'nonstarters' : status.state === 'conflict' ? 'conflicts' : status.blocked ? 'unavailable' : status.state === 'conditional' ? 'conditional' : 'unknown']
        .push({id,name:p.name || 'Unknown player',reason:status.reason});
    }
    return result;
  }
  function impactReview(data, game, lineup, now=Date.now()) {
    const scoped=lineup && String(lineup.gameId)===String(game?.id) && lineup.kickoff===game?.kickoff;
    const teams=[];
    for(const id of [game?.awayId,game?.homeId]) {
      if(!id)continue;
      const summary=teamSummary(data,game,id,now);
      const applied=[],unvalued=[];
      for(const player of [...summary.unavailable,...(summary.nonstarters||[])]) {
        const props=scoped?lineup.props?.[String(id)+':'+player.id]:null;
        const reduced=props && Object.values(props).some(p=>p.scale<1);
        (reduced && lineup.teams?.[String(id)]?.scoreReady===true ? applied : unvalued).push(player);
      }
      const team=data?.teams?.find(t=>String(t.id)===String(id));
      const fresh=(r,age)=>r?.available&&Number.isFinite(r.checkedAt)&&r.checkedAt<=now&&now-r.checkedAt<=age;
      const inWindow=data?.current&&Number.isFinite(game?.kickoff)&&game.kickoff>now&&game.kickoff<=now+7*day;
      const reportsVerified=!!(inWindow&&fresh(team?.roster,3600000)&&fresh(team?.injuries,900000));
      teams.push({id:String(id),applied,unvalued,conflicts:summary.conflicts||[],unknown:summary.unknown,conditional:summary.conditional,nonstarters:summary.nonstarters||[],reportsVerified,reason:summary.reason});
    }
    return {teams,reason:'Only reported entries are reviewed. Missing reports do not establish health. Applied score scenarios use confirmed role and workload assumptions; previous games may already reflect an absence.'};
  }
  const api = {assess, workloadProjection,teamSummary,refreshDue,impactReview};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Unit501InjuryModel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
