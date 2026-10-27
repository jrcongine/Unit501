'use strict';
const {test} = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const {createHistory, footballTarget, nbaTarget} = require('../line-history');
const {createTrackedOdds} = require('../tracked-odds');
function fixture(t, options = {}) {
  let clock = Date.parse('2026-10-26T18:00:00Z');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'unit501-lines-'));
  t.after(() => fs.rmSync(dir, {recursive: true, force: true}));
  const settings = {file: path.join(dir, 'history.json'), now: () => clock, enabled: true, ...options};
  const q = {league: '1', away: 'Away', home: 'Home', kickoff: clock + 2 * 86400000};
  const target = footballTarget(q, 'game');
  const quote = (line = 45.5, at = clock) => ({available: true, total: line, totalUpdated: new Date(at).toISOString()});
  return {settings, q, target, quote, now: () => clock, advance: ms => { clock += ms; }, h: createHistory(settings)};
}
test('server history survives restart and records a move away and back instead of unchanged', t => {
  const f = fixture(t);
  const first = f.h.capture(f.target, f.quote()).history.total;
  assert.equal(first.persisted, true); assert.equal(first.observations, 1);
  assert.equal(f.h.capture(f.target, f.quote()).history.total.observations, 1); // cached source timestamp
  f.advance(60000); f.h.capture(f.target, f.quote(46.5));
  const secondDevice = createHistory(f.settings);
  f.advance(60000);
  const h = secondDevice.capture(f.target, f.quote(45.5)).history.total;
  assert.equal(h.firstLine, 45.5); assert.equal(h.observations, 3); assert.equal(h.changes, 2);
  assert.equal(h.delta, 0); assert.equal(h.max, 46.5); assert.equal(h.timeline.length, 3);
  assert.equal(h.scope, 'server');
});
test('stale, future, out-of-order and conflicting same-timestamp quotes cannot become movement', t => {
  const f = fixture(t);
  f.h.capture(f.target, f.quote()); f.advance(1000);
  f.h.capture(f.target, f.quote(46.5));
  for (const [line, at] of [[47.5, f.now() - 1000], [47.5, f.now()], [47.5, f.now() + 60001], [47.5, f.now() - 1800001], [null, f.now()]]) {
    assert.equal(f.h.capture(f.target, f.quote(line, at)).history.total, null);
  }
  assert.equal(f.h.capture(f.target, f.quote(46.5)).history.total.line, 46.5);
});
test('history separates leagues, kickoff, player/stat and moneyline sides', t => {
  const f = fixture(t);
  f.h.capture(f.target, f.quote()); f.advance(1000);
  assert.equal(f.h.capture({...f.target, league: '2'}, f.quote(50)).history.total.firstLine, 50);
  assert.equal(f.h.capture({...f.target, kickoff: f.target.kickoff + 86400000}, f.quote(51)).history.total.firstLine, 51);
  const props = footballTarget(f.q, 'props');
  const data = {props: [{name: 'A', stat: 'rec', line: 0, updatedAt: f.now()}, {name: 'A', stat: 'recYds', line: 15.5, updatedAt: f.now()}, {name: 'B', stat: 'rec', line: 3.5, updatedAt: f.now()}]};
  assert.deepEqual(f.h.capture(props, data).props.map(p => p.history.firstLine), [0, 15.5, 3.5]);
  const ml = f.h.capture(f.target, {moneyline: {away: 150, home: -175, updatedAt: f.now()}}).history;
  assert.equal(ml.awayMoneyline.firstLine, 150); assert.equal(ml.homeMoneyline.firstLine, -175);
});
test('watcher runs without clients, serializes refreshes and restores its budget on restart', async t => {
  const f = fixture(t, {dailyBudget: 6});
  f.h.capture(f.target, f.quote()); f.h.noteQuota({remaining: 100, status: 200});
  f.advance(900000);
  let release, calls = 0;
  const fetcher = () => { calls++; return new Promise(resolve => { release = () => resolve(f.quote(46)); }); };
  const pending = f.h.tick(fetcher); await f.h.tick(fetcher); assert.equal(calls, 1); release(); await pending;
  assert.equal(f.h.status().budget.spent, 3);
  const restarted = createHistory(f.settings);
  assert.equal(restarted.status().budget.spent, 3);
  f.advance(900000); await restarted.tick(async () => { calls++; return f.quote(47); });
  f.advance(900000); await restarted.tick(async () => { calls++; return f.quote(48); });
  assert.equal(calls, 2); assert.equal(restarted.status().budget.spent, 6);
  assert.match(restarted.status().message, /daily odds-credit limit/);
});
test('no storage, unknown allowance, reserved credits and provider errors pause background requests', async t => {
  const f = fixture(t); f.h.capture(f.target, f.quote()); f.advance(900000);
  let calls = 0; const fetcher = async () => { calls++; return f.quote(); };
  await f.h.tick(fetcher); assert.equal(calls, 0);
  f.h.noteQuota({remaining: 51, status: 200}); await f.h.tick(fetcher); assert.equal(calls, 0);
  // A late response cannot refund known allowance.
  f.h.noteQuota({remaining: 1000, status: 200}); assert.equal(f.h.status().remaining, 51);
  const memory = createHistory({...f.settings, file: ''}); memory.capture(f.target, f.quote()); memory.noteQuota({remaining: 1000, status: 200});
  f.advance(900000); await memory.tick(fetcher); assert.equal(calls, 0); assert.equal(memory.status().persistent, false);
  const other = fixture(t); other.h.capture(other.target, other.quote()); other.h.noteQuota({remaining: 1000, status: 429}); other.advance(900000);
  await other.h.tick(fetcher); assert.equal(calls, 0); assert.match(other.h.status().message, /provider error/);
});
test('failed refreshes retain recorded history and stop at kickoff', async t => {
  const f = fixture(t); f.h.capture(f.target, f.quote()); f.h.noteQuota({remaining: 1000, status: 200}); f.advance(900000);
  await f.h.tick(async () => { throw Error('network failed'); });
  assert.equal(f.h.status(f.h.targetKey(f.target)).message, 'Last background refresh failed');
  f.advance(1000); assert.equal(f.h.capture(f.target, f.quote(46)).history.total.firstLine, 45.5);
  f.advance(3 * 86400000); let calls = 0; await f.h.tick(async () => { calls++; });
  assert.equal(calls, 0); assert.equal(f.h.status().watchedMarkets, 0);
  assert.equal(f.h.capture(f.target, f.quote()).history.total, null);
});
test('disk failure prevents paid polling and a corrupt archive is not overwritten', async t => {
  const f = fixture(t); f.h.capture(f.target, f.quote()); f.h.noteQuota({remaining: 1000, status: 200});
  fs.unlinkSync(f.settings.file); fs.mkdirSync(f.settings.file);
  f.advance(900000); let calls = 0; await f.h.tick(async () => { calls++; });
  assert.equal(calls, 0); assert.equal(f.h.status().persistent, false);
  fs.rmSync(f.settings.file, {recursive: true}); fs.writeFileSync(f.settings.file, 'broken');
  assert.throws(() => createHistory(f.settings)); assert.equal(fs.readFileSync(f.settings.file, 'utf8'), 'broken');
});
test('persisted watch limits and retention bound unattended storage', t => {
  const f = fixture(t, {maxWatches: 1}); f.h.capture(f.target, f.quote());
  f.h.capture({...f.target, away: 'Other'}, f.quote()); assert.equal(f.h.status().watchedMarkets, 1);
  assert.equal(f.h.watch({...f.target, kickoff: f.now() + 8 * 86400000}), null);
  f.advance(10 * 86400000); createHistory(f.settings);
  const disk = JSON.parse(fs.readFileSync(f.settings.file)); assert.deepEqual(disk.series, {}); assert.deepEqual(disk.watches, {});
});
test('football and NBA routes return shared history while comparison books stay separate', async t => {
  const f = fixture(t);
  const game = {id: 9, away: 'Away', home: 'Home', tipoff: new Date(f.q.kickoff).toISOString(), status: 'Scheduled'};
  let line = 45.5;
  const routes = createTrackedOdds({history: f.h, footballLines: async () => f.quote(line), footballProps: async () => ({props: [{name: 'A', stat: 'rec', line: 2.5, updatedAt: f.now()}]}),
    nbaOdds: async (_, kind) => kind === 'comparison' ? {bookmaker: 'Multiple', books: []} : {spread: {away: 3.5, updatedAt: f.now()}, total: {line: 222.5, updatedAt: f.now()}}});
  await routes.football(f.q, 'game'); line = 46.5; f.advance(1000);
  assert.equal((await routes.football(f.q, 'game')).history.total.delta, 1);
  assert.equal((await routes.football(f.q, 'props')).props[0].history.line, 2.5);
  assert.equal((await routes.nba(game, 'game')).history.total.firstLine, 222.5);
  assert.equal((await routes.nba(game, 'comparison')).history, undefined);
  assert.notEqual(f.h.targetKey(nbaTarget(game, 'game')), f.h.targetKey(f.target));
});
