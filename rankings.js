'use strict';
// Season-to-date context. No changes to the projection or simulation models.
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
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
    id: String(team.id), name: team.name, games: 0,
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
  for (const [key, , defense] of metrics) {
    // Do not call incomplete coverage an NFL league ranking.
    const complete = query.league === '1' && result.length === 32 &&
      result.every(team => team.games > 0 && team.metrics[key].games === team.games);
    if (!complete) continue;
    const sorted = [...result].sort((a,b) => (a.metrics[key].average - b.metrics[key].average) * (defense ? 1 : -1));
    sorted.forEach((team, index) => {
      const item = team.metrics[key];
      const previous = sorted[index - 1]?.metrics[key];
      item.rank = previous && Math.abs(previous.average - item.average) < 1e-9 ? previous.rank : index + 1;
      item.pool = sorted.length;
    });
  }
  return { teams: result, metrics, before: query.before, season: query.season,
    scope: query.league === '1' ? 'NFL regular season' : 'College season • team averages only',
    explanation: query.league === '1'
      ? 'Rank 1 is best: most yards/points on offense, fewest allowed on defense. Rankings appear only with complete data for all 32 teams.'
      : 'College national ranks are withheld until division membership is verified. Averages include each team’s completed games against all opponents.',
    builtAt: new Date().toISOString() };
}
function createRankings(api) {
  const jobs = new Map();
  const cache = new Map();
  let queue = Promise.resolve();
  const disk = path.join(os.tmpdir(), 'unit501-team-boxes-v1');
  async function request(endpoint) {
    const work = queue.then(async () => {
      const data = await api(endpoint);
      if (data.errors && Object.keys(data.errors).length) throw new Error('The stats provider returned an error. Check data access or request quota.');
      if (!Array.isArray(data.response)) throw new Error('Stats response was not a list.');
      return data.response;
    });
    queue = work.catch(() => {}).then(() => new Promise(resolve => setTimeout(resolve, 1000)));
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
      if (query.league === '1') {
        games = await request(`/games?league=1&season=${query.season}`);
      } else {
        const a = await request(`/games?team=${query.away}&season=${query.season}`);
        const h = await request(`/games?team=${query.home}&season=${query.season}`);
        games = [...new Map([...a,...h].map(g => [String(g.game?.id),g])).values()];
      }
      const roster = new Map();
      for (const g of games) {
        if (String(g.league?.id) !== query.league || (query.league === '1' && g.game?.stage !== 'Regular Season')) continue;
        for (const team of [g.teams?.away || g.teams?.visitors,g.teams?.home]) {
          if (team?.id && (query.league === '1' || [query.away, query.home].includes(String(team.id)))) roster.set(String(team.id), team);
        }
      }
      const past = games.filter(g => eligible(g, query));
      const boxes = new Map();
      job.total = past.length;
      for (const g of past) {
        const id = String(g.game?.id);
        if (!/^\d+$/.test(id)) continue;
        boxes.set(id, await box(id));
        job.completed++;
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
    for (const [id, item] of jobs) if (item.state !== 'loading' && Date.now() - item.finishedAt > 3600000) jobs.delete(id);
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
module.exports = {createRankings,summarize,eligible,readYards};
