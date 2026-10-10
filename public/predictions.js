/* UNIT 501 player projections: transparent recent-game averages, not betting advice. */
(() => {
  'use strict';
  const el = id => document.getElementById(id);
  const button = el('predict');
  const status = el('predict-status');
  const picker = el('predict-player');
  const results = el('predict-results');
  let loadedFor = null;
  let choices = [];
  let opponentDefense = new Map();
  let matchupTeams = [];
  const enteredLines = new Map();
  const workloadScenarios = new Map();
  let lineScope = '';
  let sequence = 0;
  let propSequence = 0;
  const propStatus = document.createElement('p');
  const refreshProps = document.createElement('button');
  refreshProps.type = 'button';
  refreshProps.textContent = 'Refresh FanDuel props';
  refreshProps.disabled = true;
  results.before(refreshProps, propStatus);
  const playerName = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  async function loadProps() {
    if (!loadedFor || !selected) return;
    const task = ++propSequence;
    const selection = sequence;
    const game = selected;
    refreshProps.disabled = true;
    propStatus.textContent = 'Loading FanDuel prop lines…';
    // Clear old automatic quotes, keeping all manual entries.
    for (const [key, entry] of enteredLines) if (entry.source === 'auto') enteredLines.delete(key);
    showPlayer();
    try {
      const params = new URLSearchParams({away:game.a,home:game.h,league:game.league || el('league').value,kickoff:game.kickoff});
      const res = await fetch('/api/fanduel-props?' + params, {signal:AbortSignal.timeout(20000)});
      const data = await res.json();
      if (task !== propSequence || selection !== sequence) return;
      if (!res.ok || data.error) throw new Error(data.error || 'FanDuel props unavailable.');
      let count = 0;
      for (const record of choices) {
        // Never guess abbreviated names or select between duplicate player names.
        if (choices.filter(p => playerName(p.name) === playerName(record.name)).length !== 1) continue;
        for (const def of definitions) {
          const quotes = (data.props || []).filter(p => p.stat === def.key && playerName(p.name) === playerName(record.name));
          if (quotes.length !== 1) continue;
          const quote = quotes[0];
          if (!Number.isFinite(quote.line) || Date.now() - quote.updatedAt > 1800000) continue;
          const key = lineKey(record, def);
          const entry = readLine(key);
          if (entry.value !== '') continue;
          enteredLines.set(key, {value:String(quote.line),savedAt:quote.updatedAt,persisted:false,source:'auto'});
          count++;
        }
      }
      propStatus.textContent = `${data.message || ''} ${count} player lines filled. Manual entries are kept. Feed requests are cached for five minutes.`;
      showPlayer();
    } catch (e) {
      if (task === propSequence && selection === sequence) propStatus.textContent = e.message + ' You can enter lines manually.';
    } finally {
      if (task === propSequence && selection === sequence) refreshProps.disabled = false;
    }
  }
  refreshProps.addEventListener('click', loadProps);
  const n = v => {
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    if (typeof v !== 'string' || !/^-?\d+(?:\.\d+)?$/.test(v.trim())) return null;
    const x = Number(v); return Number.isFinite(x) ? x : null;
  };
  const json = async url => {
    const res = await fetch(url, {signal:AbortSignal.timeout(20000)});
    const x = await res.json();
    if (!res.ok || x.error || (x.errors && Object.keys(x.errors).length)) {
      throw new Error(x.error || JSON.stringify(x.errors) || 'Data could not be loaded');
    }
    if (x.paging?.total > 1) throw new Error('Season data is paginated and incomplete. Projections withheld.');
    if (!Array.isArray(x.response)) throw new Error('The data provider did not return a list.');
    return x.response;
  };
  const gameTime = g => n(g.game?.date?.timestamp) || Date.parse(g.game?.date?.date || '') / 1000;
  const mean = values => values.reduce((sum, value) => sum + value, 0) / values.length;
  const {definitions,teamYards,accumulate,completeCalendar} = Unit501PlayerStats;
  const lineKey = (record, def) => `unit501:player-line:v1:${lineScope}:${record.teamId}:${record.playerId}:${def.key}`;
  function readLine(key) {
    let entry = enteredLines.get(key);
    if (entry?.source === 'auto' && Date.now() - entry.savedAt > 1800000) {
      enteredLines.delete(key);
      entry = null;
    }
    if (!entry) {
      entry = { value: '', savedAt: null, persisted: false };
      try {
        const saved = JSON.parse(localStorage.getItem(key));
        if (saved && typeof saved.value === 'string' && n(saved.value) !== null &&
            Number.isFinite(saved.savedAt) && saved.savedAt > 0 &&
            Number.isFinite(new Date(saved.savedAt).getTime())) {
          entry = { value: saved.value, savedAt: saved.savedAt, persisted: true };
        }
      } catch { /* Missing, blocked or damaged storage must not stop projections. */ }
      enteredLines.set(key, entry);
    }
    return entry;
  }
  const board = document.createElement('section');
  board.id = 'saved-line-comparisons';
  results.before(board);
  function renderComparisons() {
    board.replaceChildren();
    if (!loadedFor) return;
    const title = document.createElement('h3');
    title.textContent = 'Player line comparisons';
    const note = document.createElement('p');
    note.textContent = 'Selected game only. Historical comparisons, not ranked picks or win probabilities. Players reported unavailable are withheld. Other projections assume participation; workload scenarios are your inputs. Recheck current FanDuel lines.';
    note.style.cssText = 'font-size:.9em;opacity:.8';
    board.append(title, note);
    const rows = [];
    for (const record of choices) {
      if (window.Unit501Availability?.assess(record.teamId, record.playerId).blocked) continue;
      for (const def of definitions) {
        const entry = readLine(lineKey(record, def));
        const line = n(entry.value);
        if (line === null || !Number.isInteger(line * 2) || (!def.key.endsWith('Yds') && line < 0)) continue;
        const model = projectionFor(record, def);
        if (!model) continue;
        rows.push({record, def, entry, line, ...model});
      }
    }
    if (board.dataset.scope !== lineScope) {
  board.dataset.scope = lineScope;
  board.dataset.team = '';
  board.dataset.stat = '';
}

const filters = document.createElement('div');
filters.style.cssText = 'display:flex;gap:12px;flex-wrap:wrap;margin:12px 0';

function addFilter(key, title, options) {
  const label = document.createElement('label');
  label.textContent = title + ' ';
  const select = document.createElement('select');

  for (const [value, text] of options) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = text;
    select.append(option);
  }

  select.value = board.dataset[key] || '';
  select.addEventListener('change', () => {
    board.dataset[key] = select.value;
    renderComparisons();
  });

  label.append(select);
  filters.append(label);
}

addFilter('team', 'Team', [
  ['', 'Both teams'],
  ...matchupTeams.map(team => [team.id, team.name])
]);

addFilter('stat', 'Stat', [
  ['', 'All stats'],
  ...definitions.map(def => [def.key, def.title])
]);

board.append(filters);

for (let i = rows.length - 1; i >= 0; i--) {
  if ((board.dataset.team && rows[i].record.teamId !== board.dataset.team) ||
      (board.dataset.stat && rows[i].def.key !== board.dataset.stat)) {
    rows.splice(i, 1);
  }
}
    if (!rows.length) {
      const empty = document.createElement('p');
     empty.textContent = 'No lines match these filters. Try Both teams / All stats, or enter a line on a player card below.';
     board.append(empty); return;
    }
    const wrap = document.createElement('div');
    wrap.style.cssText = 'overflow-x:auto;margin-bottom:18px';
    wrap.tabIndex = 0;
    wrap.setAttribute('role', 'region');
    wrap.setAttribute('aria-label', 'Saved player line comparisons');
    const table = document.createElement('table');
    table.style.cssText = 'width:100%;border-collapse:collapse;text-align:left;font-size:.9em';
    const caption = document.createElement('caption');
    caption.textContent = `${rows.length} entered ${rows.length === 1 ? 'line' : 'lines'} — ${matchupTeams.map(t => t.name).join(' vs ')}`;
    caption.style.cssText = 'text-align:left;padding:8px 0;font-weight:bold';
    table.append(caption);
    const head = document.createElement('thead');
    const header = document.createElement('tr');
    for (const name of ['Player / team', 'Stat', 'Projection', 'Median', 'Line', 'Difference', 'Recent above / below / equal', 'Source / time (CT)']) {
      const cell = document.createElement('th');
      cell.scope = 'col';
      cell.textContent = name;
      cell.style.cssText = 'padding:10px;border-bottom:1px solid #45495b';
      header.append(cell);
    }
    head.append(header);
    table.append(head);
    const body = document.createElement('tbody');
    for (const row of rows) {
      const tr = document.createElement('tr');
      const projection = Number(row.adjusted.toFixed(1));
      const diff = Number((projection - row.line).toFixed(1));
      const above = row.values.filter(v => v > row.line).length;
      const below = row.values.filter(v => v < row.line).length;
      const equal = row.values.length - above - below;
      const sorted = [...row.values].sort((a, b) => a - b); const mid = Math.floor(sorted.length / 2); const median = sorted.length % 2   ? sorted[mid]   : (sorted[mid - 1] + sorted[mid]) / 2;  const fields = [null, row.def.title, projection.toFixed(1) + ` (${row.workload}% workload)` + (row.workloadWarning ? ' • Check role' : ''), median.toFixed(1), String(row.line),
        diff === 0 ? 'Equal' : `${Math.abs(diff).toFixed(1)} ${diff > 0 ? 'above' : 'below'}`,
        `${above} / ${below} / ${equal} (${row.values.length} games)`,
        row.entry.source === 'auto' ? 'FanDuel • ' + new Date(row.entry.savedAt).toLocaleTimeString('en-US', {timeZone:'America/Chicago',hour:'numeric',minute:'2-digit'}) : row.entry.persisted && row.entry.savedAt ? new Date(row.entry.savedAt).toLocaleString('en-US', {timeZone:'America/Chicago', month:'short', day:'numeric', hour:'numeric', minute:'2-digit'}) : 'Session only'];
      fields.forEach((value, index) => {
        const cell = document.createElement('td');
        cell.style.cssText = 'padding:10px;border-bottom:1px solid #293142;vertical-align:top';
        if (index === 0) {
          const open = document.createElement('button');
          open.type = 'button';
          open.textContent = `${row.record.name} — ${row.record.team}`;
          open.addEventListener('click', () => {
            picker.value = row.record.id;
            showPlayer();
            const input = el(`line-${row.record.id}-${row.def.key}`);
            input?.scrollIntoView?.({block:'center', behavior:'smooth'});
            input?.focus({preventScroll:true});
          });
          cell.append(open);
          const availabilityText = window.Unit501Availability?.describe(
  row.record.teamId, row.record.playerId
) || 'Availability not checked yet.';

const details = document.createElement('details');
details.style.cssText = 'margin-top:8px;font-size:.85em;color:#e8b95b';

const summary = document.createElement('summary');
summary.textContent = /AVAILABILITY WARNING|Reported /i.test(availabilityText)
  ? '⚠ Review roster / injury report'
  : 'Playing status unconfirmed';

const explanation = document.createElement('p');
explanation.textContent = availabilityText;
details.append(summary, explanation);
cell.append(details);
        } else cell.textContent = value;
        tr.append(cell);
      });
      body.append(tr);
    }
    table.append(body);
    wrap.append(table);
    board.append(wrap);
  }
  function addLineComparison(card, record, def, projection, values) {
    const key = lineKey(record, def);
    let entry = readLine(key);
    const label = document.createElement('label');
    label.style.cssText = 'display:block;margin-top:12px';
    label.textContent = 'FanDuel line (automatic when available; editable)';
    const input = document.createElement('input');
    input.type = 'number';
    input.step = '0.5';
    input.placeholder = 'Enter line';
    input.id = `line-${record.id}-${def.key}`;
    input.style.cssText = 'display:block;box-sizing:border-box;width:100%;max-width:220px;margin-top:6px';
    input.value = entry.value;
    if (!def.key.endsWith('Yds')) input.min = '0';
    label.appendChild(input);
    const comparison = document.createElement('p');
    comparison.id = `comparison-${record.id}-${def.key}`;
    comparison.setAttribute('aria-live', 'polite');
    comparison.style.cssText = 'margin:8px 0 0';
    const savedInfo = document.createElement('p');
    savedInfo.id = `saved-line-${record.id}-${def.key}`;
    savedInfo.style.cssText = 'margin:6px 0 0;font-size:.85em;opacity:.8';
    function update(persist = false) {
      const line = n(input.value);
      const valid = !input.validity?.badInput && line !== null &&
        Number.isInteger(line * 2) && (def.key.endsWith('Yds') || line >= 0);
      if (persist) {
        entry = { value: input.value, savedAt: valid ? Date.now() : null, persisted: false };
        try {
          if (valid) localStorage.setItem(key, JSON.stringify({ value: entry.value, savedAt: entry.savedAt }));
          else localStorage.removeItem(key);
          entry.persisted = true;
        } catch { /* Continue with this session's entry if saving is unavailable. */ }
        enteredLines.set(key, entry);
        renderComparisons();
      }
      savedInfo.textContent = entry.source === 'auto' && valid
        ? `FanDuel feed updated ${new Date(entry.savedAt).toLocaleString('en-US', {timeZone:'America/Chicago',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})} CT. Refresh to check for changes.`
        : entry.persisted && valid
        ? `Saved in this browser ${new Date(entry.savedAt).toLocaleString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} CT. Recheck the current FanDuel line.`
        : persist && !entry.persisted
          ? 'Browser saving is unavailable. This change lasts only until you leave or refresh.'
          : input.value === '' ? 'Enter a line to save it in this browser.' : 'Enter a valid line to save it.';
      if (input.validity?.badInput) {
        comparison.textContent = 'Enter a valid number.';
        return;
      }
      if (input.value.trim() === '') {
        comparison.textContent = 'Enter the current line to compare with this projection.';
        return;
      }
      if (line === null || !Number.isInteger(line * 2) || (!def.key.endsWith('Yds') && line < 0)) {
        comparison.textContent = 'Use a whole number or half point' + (def.key.endsWith('Yds') ? '.' : ', zero or higher.');
        return;
      }
      // Compare the same rounded projection that is visible in the card heading.
      const difference = Number((Number(projection.toFixed(1)) - line).toFixed(1));
      const above = values.filter(value => value > line).length;
      const below = values.filter(value => value < line).length;
      const equal = values.length - above - below;
      const summary = difference === 0
        ? 'Projection equals the line.'
        : `Projection is ${Math.abs(difference).toFixed(1)} ${difference > 0 ? 'above' : 'below'} the line.`;
      comparison.textContent = `${summary} Recorded season games: ${above} above, ${below} below, ${equal} equal (${values.length} games). Historical comparison only; not a win probability.`;
    }
    input.addEventListener('input', () => update(true));
    card.append(label, savedInfo, comparison);
    update();
  }
  function projectionFor(record, def) {
    const history = Array.from(record.games.values()).sort((a, b) => b.gameDate - a.gameDate);
    const opponent = matchupTeams.find(team => team.id !== record.teamId);
    const opponentStats = opponentDefense.get(opponent?.id);
    const form = Unit501PlayerForm.project(history,def.key);
    if (!form || form.withheld) return null;
    const {values,gameDetails,average,weighted} = form;
    let adjusted = form.baseline;
    let adjustment = null;
    let matchupDefense = null;
    if (def.key === 'rushYds' || def.key === 'passYds' || def.key === 'recYds') {
        const metricKey = def.key === 'rushYds' ? 'rushAgainst' : 'passAgainst';
        const context = typeof scoringContext !== 'undefined' && scoringContext?.game === selected ? scoringContext.data : null;
        const league = (context?.teams || []).filter(t => t.metrics?.[metricKey]?.rank !== null && t.metrics?.[metricKey]?.games === t.games).map(t => t.metrics[metricKey].average).filter(Number.isFinite);
        const defense = context?.teams.find(t=>t.id===opponent?.id)?.metrics[metricKey];
        if (league.length === (selected.league === '1' ? 32 : 138) && defense?.games >= 2 && Number.isFinite(defense.average) && mean(league) > 0) {
          // A cautious heuristic, capped at +/-7.5%; not a calibrated forecast.
          const factor = Math.max(0.85, Math.min(1.15, defense.average / mean(league)));
          adjustment = (factor - 1) * 0.5;
          adjusted = form.baseline * (1 + adjustment);
          matchupDefense={average:defense.average,games:defense.games,rank:defense.rank,pool:defense.pool};
        }
      }
    const lineup=window.Unit501Lineups?.evaluate();
    const lineupChange=lineup?.props?.[record.teamId+':'+record.playerId];
    if(window.Unit501LineupModel)adjusted=Unit501LineupModel.adjustProp(adjusted,def.key,lineupChange);
    const workload = workloadScenarios.get(record.id) ?? 100;
    adjusted = Unit501InjuryModel.workloadProjection(adjusted, workload);
    return {values, gameDetails, average, weighted, adjusted, adjustment, opponent, opponentStats, matchupDefense, workload,form,workloadWarning:Unit501PlayerForm.workloadWarning(history,def.key)};
  }
  function showPlayer() {
    renderComparisons();
    results.replaceChildren();
    const record = choices.find(x => x.id === picker.value);
    if (!record) return;
    const title = document.createElement('h3');
    title.textContent = `${record.name} — ${record.team}`;
    results.appendChild(title);
    const availability = document.createElement('p');
    availability.textContent = window.Unit501Availability?.describe(record.teamId, record.playerId) || 'Availability unknown.';
    availability.style.cssText = 'border-left:3px solid #e8b95b;padding:10px';
    results.appendChild(availability);
    const assessment = window.Unit501Availability?.assess(record.teamId, record.playerId);
    if (assessment?.blocked) {
      const withheld = document.createElement('p');
      withheld.textContent = assessment.reason;
      withheld.setAttribute('role', 'status');
      results.appendChild(withheld);
      return;
    }
    const scenarioLabel = document.createElement('label');
    scenarioLabel.textContent = 'Expected workload scenario (% of normal): ';
    const scenario = document.createElement('select');
    scenario.setAttribute('aria-label', 'Expected workload scenario');
    for (const percent of [100, 75, 50, 25, 0]) {
      const option = document.createElement('option');
      option.value = String(percent);
      option.textContent = percent + '%';
      scenario.appendChild(option);
    }
    scenario.value = String(workloadScenarios.get(record.id) ?? 100);
    scenario.onchange = () => {
      workloadScenarios.set(record.id, Number(scenario.value));
      showPlayer();
    };
    scenarioLabel.appendChild(scenario);
    results.appendChild(scenarioLabel);
    const scenarioNote = document.createElement('p');
    scenarioNote.textContent = 'Your scenario scales this player’s stats linearly, not their chance of playing. It does not redistribute touches or adjust team scores. A 0% scenario is not an under recommendation; check sportsbook participation rules.';
    results.appendChild(scenarioNote);
    const workload = document.createElement('p');
const history = Array.from(record.games.values())
  .sort((a, b) => b.gameDate - a.gameDate);

const workloadParts = [];
for (const [key, label] of [['attempts', 'Pass attempts'], ['carries', 'Carries'], ['targets', 'Targets']]) {
  const values = history.map(g => g[key]).filter(Number.isFinite);
  if (!values.length) continue;
  workloadParts.push(
    `${label}: ${values.join(', ')} (newest first) — ` +
    `${mean(values).toFixed(1)} average across ${values.length} recorded games`
  );
}

workload.textContent = workloadParts.length
  ? workloadParts.join(' • ')
  : 'Pass attempts, carries and targets unavailable in the recent box scores.';
results.appendChild(workload);
    let shown = 0;
    for (const def of definitions) {
      const coverageReview=Unit501PlayerForm.project(history,def.key);
      if(coverageReview?.withheld) {
        const explanation=document.createElement('p');
        explanation.style.color='#e8b95b';
        explanation.textContent=def.title+': '+coverageReview.reason;
        results.append(explanation);
        continue;
      }
      const model = projectionFor(record, def);
      if (!model) continue;
      const {values, gameDetails, average, weighted, adjusted, adjustment, opponent, opponentStats, workload} = model;
      const trend = model.form.trend + ' • ' + model.form.sample;
      const card = document.createElement('div');
      card.style.cssText = 'border:1px solid #45495b;border-radius:12px;padding:12px;margin:10px 0';
      if (model.workloadWarning) {
        const warning = document.createElement('p');
        warning.style.cssText = 'color:#e8b95b;margin:8px 0;';
        warning.textContent = model.workloadWarning;
        card.appendChild(warning);
      }
      if(model.form.usage) {
        const usage=document.createElement('p');
        usage.textContent=`Usage estimate: ${model.form.usage.workload.toFixed(1)} ${model.form.usage.key==='rec'?'receptions':model.form.usage.key} × ${model.form.usage.efficiency.toFixed(1)} yards each (${model.form.usage.games} paired games).`;
        card.append(usage);
      }
      if(model.form.coverage.missing) {
        const coverage=document.createElement('p');
        coverage.style.color='#e8b95b';
        coverage.textContent=`${model.form.coverage.recorded} recorded stat games out of ${model.form.coverage.total} completed team games. Missing records are not zeros; this estimate is conditional on recorded stats.${model.form.coverage.latestMissing?' The latest team game has no recorded stat for this market; verify the current role.':''}`;
        card.append(coverage);
      }
      const heading = document.createElement('b');
  const sortedValues = [...values].sort((a, b) => a - b); const middle = Math.floor(sortedValues.length / 2); const median = sortedValues.length % 2   ? sortedValues[middle]   : (sortedValues[middle - 1] + sortedValues[middle]) / 2;  heading.textContent =   `${def.title}: ${adjusted.toFixed(1)} projected (${workload}% workload) | ` +   `${average.toFixed(1)} average | ${median.toFixed(1)} median`;  if (values.length < 5) {   const warning = document.createElement('p');   warning.style.cssText = 'color:#e8b95b;margin:8px 0;';   warning.textContent =     `Small sample: ${values.length} recorded games. ` +     'One unusually high or low game can strongly affect the projection.';   card.appendChild(warning); }
      const context = document.createElement('p');
      context.style.cssText = 'margin:6px 0 0;opacity:.82';
     context.textContent = `Recorded season games (${values.length}, newest first): ${gameDetails.map(g => `${new Date(g.gameDate * 1000).toLocaleDateString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric' })} vs ${g.opponent}: ${g[def.key]}`).join(' • ')} • observed range ${Math.min(...values)}–${Math.max(...values)} • ${trend}`;
      card.append(heading, context); results.appendChild(card);
     if (def.key === 'rushYds' || def.key === 'passYds' || def.key === 'recYds') {
  const allowed = opponentStats?.[
    def.key === 'rushYds' ? 'rushAllowed' : 'passAllowed'
  ] || [];

  if(model.matchupDefense) {
    const defense=document.createElement('p');
    const metric=model.matchupDefense;
    defense.textContent=`${opponent?.name || 'Opponent'} defense: ${metric.average.toFixed(1)} team yards allowed per game (${metric.games} games), rank ${metric.rank}/${metric.pool}. Matchup compares this with the same league metric.`;
    card.appendChild(defense);
  } else if (allowed.length) {
    const avgAllowed = allowed.reduce((a, b) => a + b, 0) / allowed.length;
    const defense = document.createElement('p');
    defense.textContent = `${opponent?.name || 'Opponent'} defense: ${avgAllowed.toFixed(1)} team yards allowed per game (${allowed.length} ${allowed.length === 1 ? 'game' : 'games'}, from recorded player stats).`;
    card.appendChild(defense);
  }
  const explanation = document.createElement('p');
  explanation.textContent = adjustment === null
    ? `Usage/form baseline: ${model.form.baseline.toFixed(1)}. No defense adjustment: need complete league yardage rankings and at least two opponent games.`
    : `Usage/form baseline: ${model.form.baseline.toFixed(1)}. Matchup adjustment: ${adjustment >= 0 ? '+' : ''}${(adjustment * 100).toFixed(1)}% (limited to ±7.5%).`;
  card.appendChild(explanation);
}
      addLineComparison(card, record, def, adjusted, values);
      shown++;
    }
    if (!shown) {
      const empty=document.createElement('p');empty.textContent='No supported projection available from this player’s recorded stats.';results.append(empty);
    }
    const note = document.createElement('p');
    note.style.opacity = '.8';
    note.textContent = 'Workload blends season and recent form; yardage uses workload × efficiency when at least two paired records exist, blending pooled and median efficiency to limit single-game spikes. Otherwise it uses season/form yardage. Missing statistics are omitted, not treated as zero. This is an experimental assumption, not a player overall rating; confirmed replacement scenarios adjust transferred workload and team scores when coverage permits. Any workload percentage entered here is additional to the lineup scenario. Confirm current roster, injury status, weather and expected playing time before comparing with a betting line.';
    results.appendChild(note);
  }
  function reset() {
    sequence++;
    propSequence++;
    refreshProps.disabled = true;
    propStatus.textContent = '';
    loadedFor = null;
    choices = [];
    opponentDefense.clear();
    matchupTeams = [];
    enteredLines.clear();
    workloadScenarios.clear();
    lineScope = '';
    board.replaceChildren();
    picker.disabled = true;
    picker.replaceChildren();
    results.replaceChildren();
    status.textContent = 'Tap Load Player Projections for this matchup.';
    button.disabled = typeof selected === 'undefined' || !selected;
  }
  document.addEventListener('unit501:selection-changed', reset);
  button.addEventListener('click', async () => {
    if (typeof selected === 'undefined' || !selected || !selected.id) {
      status.textContent = 'Choose a game first.'; return;
    }
    const task = ++sequence;
    const game = selected;
    const gameId = String(game.id);
    if (loadedFor === gameId && choices.length) {
      status.textContent = 'Projections loaded. Choose a player below.'; return;
    }
    button.disabled = true;
    picker.disabled = true;
    picker.replaceChildren();
    results.replaceChildren();
    status.textContent = 'Finding completed season games…';
    try {
      const date = el('date').value;
      const season = date.slice(0, 4);
      const league = el('league').value;
      const slate = await json(`/api/games?date=${encodeURIComponent(date)}&league=${encodeURIComponent(league)}&season=${encodeURIComponent(season)}`);
      const target = slate.find(g => String(g.game?.id || g.id) === gameId);
      if (!target) throw new Error('Selected game not found on this date. Reload the slate and try again.');
      const teams = [target.teams?.away || target.teams?.visitors, target.teams?.home];
      const teamIds = teams.map(team => String(team?.id));
      if (teamIds.some(x => !/^\d+$/.test(x))) throw new Error('Team IDs were not provided for this game.');
      const kickoff = gameTime(target);
      if (!Number.isFinite(kickoff) || kickoff <= 0) throw new Error('Kickoff time is missing for this game.');
      const history = await Promise.all(teamIds.map(team => json(`/api/team-games?team=${team}&season=${season}`)));
      const past = new Map();
      history.forEach((list, i) => {
        const previous = list.filter(g => {
const stage = String(g.game?.stage || '').toLowerCase();
if (/pre[\s-]*season|exhibition/i.test(stage)) return false;
if (String(g.league?.id) !== league || String(g.league?.season) !== season) return false;
if (league === '1' && stage !== 'regular season') return false;
          const id = g.game?.id || g.id;
          const time = gameTime(g);
          const code = String(g.game?.status?.short || '').toUpperCase();
          return id && time < kickoff && (['FT', 'AOT', 'FINAL'].includes(code) || /finish|final|after overtime/i.test(g.game?.status?.long || ''));
        }).sort((a, b) => gameTime(b) - gameTime(a));
        previous.forEach(g => {
          const away = g.teams?.away || g.teams?.visitors;
          const home = g.teams?.home;
          const opponent = String(home?.id) === teamIds[i] ? away : home;
          if (![String(away?.id), String(home?.id)].includes(teamIds[i])) return;
          const id = String(g.game?.id || g.id);
          if (!past.has(id)) past.set(id, { date: gameTime(g), teams: new Map() });
          past.get(id).teams.set(teamIds[i], {
            id: String(opponent?.id || ''), name: opponent?.name || 'Opponent unknown'
          });
        });
      });
      if (!past.size) throw new Error('No completed games available this season for these teams yet.');
      if (task !== sequence) return;
      status.textContent = `Reading player stats from ${past.size} season team games…`;
      const ids = Array.from(past.keys());
      const map = new Map();
      matchupTeams = teams.map(team => ({ id: String(team.id), name: team.name || 'Opponent' }));
      opponentDefense = new Map(teamIds.map(id => [
  id, { rushAllowed: [], passAllowed: [] }
]));
     // Sequential requests are intentionally gentler on rate limits.
         for (const id of ids) {
        status.textContent = `Reading player stats: ${ids.indexOf(id)+1} of ${ids.length} season games…`;
        const rows = await json(`/api/player-stats?game=${id}`);
        if (task !== sequence) return;
        const pastGame = past.get(id);
        for (const [teamId, opponent] of pastGame.teams) {
          const teamEntry = rows.find(row => String(row.team?.id) === teamId);
          const opponentBox = rows.find(row => String(row.team?.id) === opponent.id);
          if (!teamEntry || !opponentBox) throw new Error('A completed game is missing a team box score; projections withheld.');
          if (teamEntry) accumulate(map, teamEntry, id, pastGame.date, opponent.name);
          for (const category of ['rushing', 'passing']) {
            const allowedYards = teamYards(opponentBox, category);
            if (allowedYards !== null) opponentDefense.get(teamId)[category === 'rushing' ? 'rushAllowed' : 'passAllowed'].push(allowedYards);
          }
        }
      }
      completeCalendar(map,past);
      choices = Array.from(map.values()).filter(x => x.games.size >= 2 &&
        Array.from(x.games.values()).some(line => definitions.some(d => line[d.key] !== undefined))
      ).sort((a, b) => a.team.localeCompare(b.team) || a.name.localeCompare(b.name));
      if (!choices.length) throw new Error('Player box scores are missing or too sparse for recent-game projections.');
      for (const player of choices) {
        const option = document.createElement('option');
        option.value = player.id;
        option.textContent = `${player.name} — ${player.team}`;
        picker.appendChild(option);
      }
      loadedFor = gameId;
      lineScope = `${league}:${season}:${date}:${gameId}`;
      picker.disabled = false;
      status.textContent = `${choices.length} players with recent stats. Select a player.`;
      showPlayer();
      loadProps();
    } catch (e) {
      if (task === sequence) status.textContent = 'Could not load projections: ' + e.message;
    } finally {
      if (task === sequence) button.disabled = false;
    }
  });
  document.addEventListener('unit501:team-context-updated', () => { if (loadedFor) showPlayer(); });
  document.addEventListener('unit501:lineup-updated', () => { if (loadedFor) showPlayer(); });
  document.addEventListener('unit501:availability-updated', () => { if (loadedFor) showPlayer(); });
  picker.addEventListener('change', () => {   showPlayer();   results.scrollIntoView({     behavior: 'smooth',     block: 'start'   }); });
  reset();
})();
