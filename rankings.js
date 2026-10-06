'use strict';
// Season-to-date context and pre-kickoff opponent scoring history.
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const membership = require('./fbs-2026.json');
const normalize = name => String(name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
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
const metrics = [
  ['rushFor', 'Rushing offense', false], ['passFor', 'Passing offense', false],
  ['pointsFor', 'Scoring offense', false], ['rushAgainst', 'Run defense', true],
  ['passAgainst', 'Pass defense', true], ['pointsAgainst', 'Scoring defense', true]
];
const number = value => typeof value === 'number' && Number.isFinite(value) ? value
  : typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value.trim()) ? Number(value) : null;
const time = game => number(game.game?.date?.timestamp) * 1000;
function eligible(g, query) {
  return String(g.league?.id) === query.league && String(g.league?.season) === query.season &&
    ['FT', 'AOT', 'FINAL'].includes(String(g.game?.status?.short).toUpperCase()) &&
    time(g) > 0 && time(g) < query.before &&
    (query.league !== '1' || g.game?.stage === 'Regular Season');
}
function readYards(row) {
  const stats = row?.statistics;
  return { rush: number(stats?.rushings?.total), pass: number(stats?.passing?.total) };
}
function summarize(games, boxes, query, roster) {
  const teams = new Map(roster.map(team => [String(team.id), {
    id: String(team.id), name: team.name, fbsName: fbsName(team, query.season), games: 0, opponents: [],
    metrics: Object.fromEntries(metrics.map(([key]) => [key, {sum:0, games:0}]))
  }]));
  const seen = new Set();
  for (const game of games) {
    const id = String(game.game?.id);
    if (!eligible(game, query) || seen.has(id)) continue;
    seen.add(id);
    const away = game.teams?.away || game.teams?.visitors;
    const home = game.teams?.home;
    const rows = boxes.get(id) || [];
    for (const [own, opponent, side, other] of [[away,home,'away','home'],[home,away,'home','away']]) {
      const team = teams.get(String(own?.id));
      if (!team) continue;
      team.games++;
      team.opponents.push({id:String(opponent?.id || ''),
        scored:number(game.scores?.[side]?.total), allowed:number(game.scores?.[other]?.total)});
      const ownStats = readYards(rows.find(row => String(row.team?.id) === String(own.id)));
      const against = readYards(rows.find(row => String(row.team?.id) === String(opponent?.id)));
      const values = {
        rushFor: ownStats.rush, passFor: ownStats.pass,
        rushAgainst: against.rush, passAgainst: against.pass,
        pointsFor: number(game.scores?.[side]?.total), pointsAgainst: number(game.scores?.[other]?.total)
      };
      for (const [key, value] of Object.entries(values)) if (value !== null) {
        team.metrics[key].sum += value;
        team.metrics[key].games++;
      }
    }
  }
  const result = [...teams.values()];
  for (const team of result) for (const [key] of metrics) {
    const item = team.metrics[key];
    item.average = item.games ? item.sum / item.games : null;
    item.rank = null;
    item.pool = 0;
  }
  const college = query.league === '2';
  const verifiedSeason = college && query.season === membership.season;
  const pool = college ? result.filter(team => team.fbsName) : result;
  const expected = college ? membership.teams.length : 32;
  const uniqueNames = new Set(pool.map(team => team.fbsName));
  const rosterComplete = pool.length === expected && (!college || (verifiedSeason && uniqueNames.size === expected));
  const coverage = {};
  for (const [key, , defense] of metrics) {
    const completeTeams = pool.filter(team => team.games > 0 && team.metrics[key].games === team.games);
    coverage[key] = { complete: completeTeams.length, expected, ranked: false };
    // A national rank needs the entire verified field and complete metric coverage.
    if (!rosterComplete || completeTeams.length !== expected) continue;
    coverage[key].ranked = true;
    const sorted = [...pool].sort((a,b) => (a.metrics[key].average - b.metrics[key].average) * (defense ? 1 : -1));
    sorted.forEach((team, index) => {
      const item = team.metrics[key];
      const previous = sorted[index - 1]?.metrics[key];
      item.rank = previous && Math.abs(previous.average - item.average) < 1e-9 ? previous.rank : index + 1;
      item.pool = sorted.length;
    });
  }
  const missingTeams = verifiedSeason ? membership.teams.filter(team => !uniqueNames.has(team.name)).map(team => team.name) : [];
  return { teams: result, metrics, coverage, missingTeams, before: query.before, season: query.season,
    scope: college ? (verifiedSeason ? 'College season • FBS rankings' : 'College season • team averages only') : 'NFL regular season',
    explanation: college
      ? (verifiedSeason
        ? 'Rank 1 is best among the 138 verified 2026 FBS programs, including transitioning teams. Each category requires complete data for the entire field. FCS teams receive averages only. Games against all opponents count.' + (missingTeams.length ? ' Provider team names could not be matched for: ' + missingTeams.join(', ') + '.' : '')
        : 'FBS membership has not been verified for this season. Team averages remain available; national ranks are withheld.')
      : 'Rank 1 is best: most yards/points on offense, fewest allowed on defense. Rankings appear only with complete data for all 32 teams.',
    builtAt: new Date().toISOString() };
}

function createRankings(api, options = {}) {
  const jobs = new Map();
  const cache = new Map();
  let queue = Promise.resolve();
  const disk = options.cacheDir || path.join(os.tmpdir(), 'unit501-team-boxes-v1');
  const delay = options.delayMs ?? 1000;
  async function request(endpoint) {
    const work = queue.then(async () => {
      const data = await api(endpoint);
      if (data.errors && Object.keys(data.errors).length) throw new Error('The stats provider returned an error. Check data access or request quota.');
      if (data.paging?.total > 1) throw new Error('The provider returned a paginated schedule; rankings need all pages.');
      if (!Array.isArray(data.response)) throw new Error('Stats response was not a list.');
      return data.response;
    });
    queue = work.catch(() => {}).then(() => new Promise(resolve => setTimeout(resolve, delay)));
    return work;
  }
  async function box(id) {
    const entry = cache.get(id);
    if (entry && Date.now() - entry.at < 24 * 3600000) return entry.rows;
    const file = path.join(disk, `${id}.json`);
    try {
      const saved = JSON.parse(await fs.readFile(file, 'utf8'));
      if (Date.now() - saved.at < 24 * 3600000 && Array.isArray(saved.rows)) {
        cache.set(id, saved); return saved.rows;
      }
    } catch { /* An absent cache is normal after a new deployment. */ }
    const rows = await request('/games/statistics/teams?id=' + id);
    if (rows.length && rows.some(row => { const y = readYards(row); return y.rush !== null || y.pass !== null; })) {
      const saved = { at: Date.now(), rows };
      cache.set(id, saved);
      try { await fs.mkdir(disk, {recursive:true}); await fs.writeFile(file, JSON.stringify(saved)); } catch { /* Memory cache still works. */ }
    }
    return rows;
  }
  async function build(job, query) {
    try {
      let games;
      const nationalCollege = query.league === '2' && query.season === membership.season;
      if (query.league === '1' || nationalCollege) {
        games = await request(`/games?league=${query.league}&season=${query.season}`);
      } else {
        const a = await request(`/games?team=${query.away}&season=${query.season}`);
        const h = await request(`/games?team=${query.home}&season=${query.season}`);
        games = [...new Map([...a,...h].map(g => [String(g.game?.id),g])).values()];
      }
      const roster = new Map();
      for (const g of games) {
        if (String(g.league?.id) !== query.league || (query.league === '1' && g.game?.stage !== 'Regular Season')) continue;
        for (const team of [g.teams?.away || g.teams?.visitors,g.teams?.home]) {
          if (team?.id && (query.league === '1' || (nationalCollege && fbsName(team, query.season)) || [query.away, query.home].includes(String(team.id)))) roster.set(String(team.id), team);
        }
      }
      const past = [...new Map(games.filter(g => eligible(g, query) &&
        [g.teams?.away || g.teams?.visitors, g.teams?.home].some(team => roster.has(String(team?.id))))
        .map(g => [String(g.game?.id), g])).values()];
      const selectedGame = g => [g.teams?.away || g.teams?.visitors, g.teams?.home].some(team => [query.away,query.home].includes(String(team?.id)));
      past.sort((a,b) => Number(selectedGame(b)) - Number(selectedGame(a)));
      const selectedCount = past.filter(selectedGame).length;
      const boxes = new Map();
      job.total = past.length;
      for (const g of past) {
        const id = String(g.game?.id);
        if (!/^\d+$/.test(id)) continue;
        boxes.set(id, await box(id));
        job.completed++;
        if (job.completed === selectedCount) {
          // Publish the selected teams' complete averages while national coverage loads.
          job.data = summarize(past, boxes, query, [...roster.values()]);
        }
      }
      job.data = summarize(past, boxes, query, [...roster.values()]);
      job.state = 'ready';
    } catch (error) {
      job.state = 'error';
      job.message = error.message;
    }
    job.finishedAt = Date.now();
  }
  return function get(query) {
    const key = [query.league,query.season,query.before,...(query.league === '2' ? [query.away,query.home].sort() : [])].join(':');
    for (const [id, item] of jobs) if (item.state !== 'loading' && Date.now() - item.finishedAt > (item.state === 'error' ? 60000 : 3600000)) jobs.delete(id);
    let job = jobs.get(key);
    if (!job) {
      if ([...jobs.values()].some(item => item.state === 'loading')) return {state:'loading', completed:0, total:0, message:'Another season comparison is loading. This matchup will follow.'};
      job = {state:'loading',completed:0,total:0};
      jobs.set(key,job);
      void build(job,query);
    }
    return job;
  };
}
module.exports = {createRankings,summarize,eligible,readYards,fbsName};
