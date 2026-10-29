'use strict';
const fs = require('node:fs');
const path = require('node:path');
const normalize = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const DAY = 86400000, INTERVAL = 15 * 60000;
// Preserve the daily cap: spend fewer background checks on distant games.
function nextCheck(kickoff, at) {
  const remaining = kickoff - at;
  if (remaining > DAY) return Math.min(at + 6 * 3600000, kickoff - DAY);
  if (remaining > 6 * 3600000) return Math.min(at + 3600000, kickoff - 6 * 3600000);
  return at + INTERVAL;
}
const finite = Number.isFinite;
function targetKey(t) {
  if (!t || !['1', '2', 'nba', 'ncaab'].includes(t.league) || !['game', 'props'].includes(t.kind) ||
      typeof t.away !== 'string' || typeof t.home !== 'string' || !normalize(t.away) || !normalize(t.home) ||
      t.away.length > 120 || t.home.length > 120 || !finite(t.kickoff) || t.kickoff <= 0) return null;
  if (t.league === 'nba' && (!Number.isSafeInteger(t.game?.id) || t.game.away !== t.away ||
      t.game.home !== t.home || Date.parse(t.game.tipoff) !== t.kickoff || t.game.status !== 'Scheduled')) return null;
  if (t.league === 'ncaab' && (!/^\d+$/.test(String(t.game?.id || '')) || !t.game.timeKnown || t.game.away !== t.away || t.game.home !== t.home || Date.parse(t.game.tipoff) !== t.kickoff || t.game.status !== 'Scheduled')) return null;
  return JSON.stringify([t.league, normalize(t.away), normalize(t.home), t.kickoff, t.kind]);
}
function createHistory({file = '', now = Date.now, enabled = false, dailyBudget = 240, maxWatches = 24} = {}) {
  if (!Number.isSafeInteger(dailyBudget) || dailyBudget < 0 || dailyBudget > 10000) throw Error('Invalid line history budget');
  let state = {version: 1, series: {}, watches: {}, budget: {}, quota: {}};
  let healthy = true, busy = false, timer = null, running = false;
  if (file && fs.existsSync(file)) {
    if (fs.statSync(file).size > 32 * 1024 * 1024) throw Error('Line history file exceeds limit');
    state = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (state.version !== 1 || !state.series || !state.watches || !state.budget || !state.quota) throw Error('Invalid line history file');
    if (state.budget.spent !== undefined && (!Number.isSafeInteger(state.budget.spent) || state.budget.spent < 0)) throw Error('Invalid persisted credit budget');
    if (state.quota.remaining != null && (!Number.isSafeInteger(state.quota.remaining) || state.quota.remaining < 0)) throw Error('Invalid persisted odds allowance');
    for (const [key, w] of Object.entries(state.watches)) {
      if (targetKey(w.target) !== key || !finite(w.nextAt)) throw Error('Invalid persisted line watch');
    }
    for (const s of Object.values(state.series)) {
      if (![s.firstLine, s.firstAt, s.lastLine, s.lastAt, s.kickoff, s.observations, s.changes, s.min, s.max].every(finite) ||
          !Array.isArray(s.timeline) || s.timeline.length > 256 || s.timeline.some(p => !finite(p.line) || !finite(p.at))) throw Error('Invalid persisted line series');
    }
  }
  function prune() {
    const at = now();
    for (const [k, w] of Object.entries(state.watches)) if (w.target.kickoff <= at || w.target.kickoff > at + 7 * DAY) delete state.watches[k];
    for (const [k, s] of Object.entries(state.series)) if (s.kickoff < at - 7 * DAY) delete state.series[k];
    const entries = Object.entries(state.series).sort((a, b) => a[1].lastAt - b[1].lastAt);
    for (const [k] of entries.slice(0, Math.max(0, entries.length - 4000))) delete state.series[k];
  }
  function save() {
    if (!file) return false;
    try {
      prune();
      fs.mkdirSync(path.dirname(file), {recursive: true});
      const tmp = file + '.tmp';
      const fd = fs.openSync(tmp, 'w', 0o600);
      try { fs.writeFileSync(fd, JSON.stringify(state)); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
      fs.renameSync(tmp, file);
      healthy = true;
    } catch { healthy = false; }
    return healthy;
  }
  function rollover() {
    const day = new Date(now()).toISOString().slice(0, 10), period = day.slice(0, 7);
    if (state.budget.day !== day) state.budget = {day, spent: 0};
    if (state.quota.period !== period) state.quota = {period, remaining: null, at: null};
  }
  function noteQuota({remaining, status}) {
    rollover();
    if (Number.isSafeInteger(remaining) && remaining >= 0) {
      state.quota.remaining = finite(state.quota.remaining) ? Math.min(state.quota.remaining, remaining) : remaining;
      state.quota.at = now();
    }
    if ([401, 403, 429].includes(status)) state.quota.pauseUntil = now() + 60 * 60000;
    save();
  }
  function watch(target) {
    prune();
    const key = targetKey(target);
    if (!key || target.kickoff <= now() || target.kickoff > now() + 7 * DAY) return null;
    if (!state.watches[key] && Object.keys(state.watches).length < maxWatches) {
      state.watches[key] = {target: JSON.parse(JSON.stringify(target)), nextAt: nextCheck(target.kickoff, now()), lastSuccess: null, error: null};
      save();
    }
    return key;
  }
  function observation(key, market, line, at, kickoff) {
    if (!key || !finite(line) || !Number.isInteger(line * 2) || !finite(at) || at > now() + 60000 || now() - at > 1800000 || kickoff <= now()) return null;
    const id = key + ':' + market;
    let s = state.series[id];
    if (s && (at < s.lastAt || (at === s.lastAt && line !== s.lastLine))) return null;
    if (!s) {
      s = state.series[id] = {firstLine: line, firstAt: at, lastLine: line, lastAt: at, kickoff,
        observations: 1, changes: 0, min: line, max: line, timeline: [{at, line}]};
    } else if (at > s.lastAt) {
      s.observations++;
      if (line !== s.lastLine) { s.changes++; s.timeline.push({at, line}); }
      s.lastLine = line; s.lastAt = at;
      s.min = Math.min(s.min, line); s.max = Math.max(s.max, line);
      if (s.timeline.length > 256) s.timeline.splice(1, s.timeline.length - 256);
    }
    return {firstLine: s.firstLine, firstAt: s.firstAt, line: s.lastLine, lastAt: s.lastAt,
      delta: Math.round((s.lastLine - s.firstLine) * 100) / 100, changed: s.lastLine !== s.firstLine,
      observations: s.observations, changes: s.changes, min: s.min, max: s.max,
      timeline: s.timeline.slice(-20), scope: 'server', persisted: Boolean(file && healthy)};
  }
  function capture(target, result) {
    const key = watch(target), out = {...result}, movements = [];
    function add(market, line, at) {
      const value = observation(key, market, line, at, target.kickoff);
      if (value) movements.push(value);
      return value;
    }
    if (target.kind === 'props') {
      out.props = (result.props || []).map(p => ({...p, history: add('prop:' + normalize(p.name) + ':' + (p.stat || p.market), p.line, p.updatedAt)}));
    } else {
      const nba = ['nba', 'ncaab'].includes(target.league);
      out.history = {
        spread: add('spread', nba ? result.spread?.away : result.awaySpread, nba ? result.spread?.updatedAt : Date.parse(result.spreadUpdated)),
        total: add('total', nba ? result.total?.line : result.total, nba ? result.total?.updatedAt : Date.parse(result.totalUpdated)),
        awayMoneyline: add('moneyline:away', result.moneyline?.away, result.moneyline?.updatedAt),
        homeMoneyline: add('moneyline:home', result.moneyline?.home, result.moneyline?.updatedAt)
      };
    }
    const w = state.watches[key];
    if (w) {
      w.nextAt = nextCheck(w.target.kickoff, now());
      if (movements.length) { w.lastSuccess = now(); w.error = null; }
      else w.error = 'No fresh quotes returned';
    }
    const persisted = save();
    for (const m of movements) m.persisted = persisted;
    out.tracking = status(key);
    return out;
  }
  function reason(key) {
    rollover();
    if (!enabled) return 'Background tracking off';
    if (!file || !healthy) return 'Background paused: persistent storage unavailable';
    if (key && !state.watches[key]) return 'Not watched: game started, outside seven days, or watch limit reached';
    if (state.quota.pauseUntil > now()) return 'Background paused after an odds-provider error';
    if (!finite(state.quota.remaining) || !finite(state.quota.at) || now() - state.quota.at > DAY) return 'Background paused: odds allowance needs a fresh check';
    const target = state.watches[key]?.target;
    const cost = target ? target.kind === 'game' ? 3 : ['nba', 'ncaab'].includes(target.league) ? 4 : 8 : 3;
    if (state.quota.remaining - cost < 50) return 'Background paused to preserve odds credits';
    if (state.budget.spent + cost > dailyBudget) return 'Background paused: daily odds-credit limit reached';
    return null;
  }
  function status(key) {
    prune(); rollover();
    const w = state.watches[key], paused = reason(key);
    const count = Object.keys(state.watches).length;
    return {persistent: Boolean(file && healthy), background: !paused && count > 0, message: paused || w?.error || (count ? 'Server watch active · refreshes depend on queue and odds allowance' : 'Load a matchup to start server tracking'),
      lastSuccess: w?.lastSuccess || null, nextAt: w?.nextAt || null, watchedMarkets: Object.keys(state.watches).length,
      budget: {...state.budget, limit: dailyBudget}, remaining: state.quota.remaining ?? null};
  }
  async function tick(fetchTarget) {
    if (busy) return;
    busy = true;
    try {
      prune(); rollover();
      if (reason()) return;
      // One serial market request per tick; nearest kickoff among due watches first, no overlapping sweeps.
      const due = Object.entries(state.watches).filter(([, w]) => w.nextAt <= now()).sort((a, b) => a[1].target.kickoff - b[1].target.kickoff || a[1].nextAt - b[1].nextAt);
      for (const [key, w] of due) {
        const cost = w.target.kind === 'game' ? 3 : ['nba', 'ncaab'].includes(w.target.league) ? 4 : 8;
        if (state.budget.spent + cost > dailyBudget || state.quota.remaining - cost < 50) {
          w.error = 'Background paused to preserve odds credits'; w.nextAt = nextCheck(w.target.kickoff, now()); save(); continue;
        }
        state.budget.spent += cost; state.quota.remaining -= cost;
        w.nextAt = nextCheck(w.target.kickoff, now());
        // Persist reservation before making a paid request. Fail closed on disk errors.
        if (!save()) return;
        try { capture(w.target, await fetchTarget(w.target)); }
        catch { w.error = 'Last background refresh failed'; save(); }
        break;
      }
    } finally { busy = false; }
  }
  function start(fetchTarget) {
    if (running) return;
    running = true;
    const loop = async () => {
      try { await tick(fetchTarget); } catch { healthy = false; }
      if (running) { timer = setTimeout(loop, 60000); timer.unref?.(); }
    };
    timer = setTimeout(loop, 1000); timer.unref?.();
  }
  prune(); rollover(); if (file) save();
  return {capture, watch, noteQuota, status, tick, start, stop() { running = false; clearTimeout(timer); }, targetKey};
}
function footballTarget(q, kind) { return {league: String(q.league), kind, away: q.away, home: q.home, kickoff: Number(q.kickoff)}; }
function nbaTarget(game, kind) { return {league: 'nba', kind, away: game.away, home: game.home, kickoff: Date.parse(game.tipoff), game: {id: game.id, away: game.away, home: game.home, tipoff: game.tipoff, status: game.status}}; }
function ncaabTarget(game, kind) { return {...nbaTarget(game, kind), league: 'ncaab', game: {...game}}; }
module.exports = {createHistory, footballTarget, nbaTarget, ncaabTarget, targetKey};
