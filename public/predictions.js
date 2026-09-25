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
  let teamOffense = new Map();
  let matchupTeams = [];
  const enteredLines = new Map();
  let lineScope = '';
  let sequence = 0;
  const n = v => {
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    if (typeof v !== 'string' || !/^-?\d+(?:\.\d+)?$/.test(v.trim())) return null;
    const x = Number(v); return Number.isFinite(x) ? x : null;
  };
  const json = async url => {
    const res = await fetch(url);
    const x = await res.json();
    if (!res.ok || x.error || (x.errors && Object.keys(x.errors).length)) {
      throw new Error(x.error || JSON.stringify(x.errors) || 'Data could not be loaded');
    }
    if (!Array.isArray(x.response)) throw new Error('The data provider did not return a list.');
    return x.response;
  };
  const normalize = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const gameTime = g => n(g.game?.date?.timestamp) || Date.parse(g.game?.date?.date || '') / 1000;
  const mean = values => values.reduce((sum, value) => sum + value, 0) / values.length;
  function teamYards(team, category) {
    const values = (team?.groups || [])
      .filter(group => normalize(group.name) === category)
      .flatMap(group => (group.players || []).map(player => extract(player.statistics, category, ['yards'])))
      .filter(value => value !== null);
    return values.length ? values.reduce((sum, value) => sum + value, 0) : null;
  }
  const definitions = [
    { key: 'passYds', title: 'Passing yards', group: 'passing', keys: ['yards'] },
    { key: 'passTD', title: 'Passing TDs', group: 'passing', keys: ['passing touch downs', 'passing touchdowns'] },
    { key: 'rushYds', title: 'Rushing yards', group: 'rushing', keys: ['yards'] },
    { key: 'rushTD', title: 'Rushing TDs', group: 'rushing', keys: ['rushing touch downs', 'rushing touchdowns'] },
    { key: 'recYds', title: 'Receiving yards', group: 'receiving', keys: ['yards'] },
    { key: 'rec', title: 'Receptions', group: 'receiving', keys: ['receptions', 'total receptions'] },
    { key: 'recTD', title: 'Receiving TDs', group: 'receiving', keys: ['receiving touch downs', 'receiving touchdowns'] }
  ];
  const extract = (stats, group, keys) => {
    if (!Array.isArray(stats)) return null;
    const row = stats.find(item => keys.includes(normalize(item.name)));
    return row ? n(row.value) : null;
  };
  function accumulate(map, teamEntry, gameId, gameDate, opponent) {
    const team = teamEntry.team || {};
   
    for (const group of teamEntry.groups || []) {
      const groupName = normalize(group.name);
      for (const item of group.players || []) {
        const person = item.player || {};
        if (!person.id || !person.name) continue;
        const id = String(person.id);
        if (!map.has(id)) map.set(id, {
          id, name: person.name, team: team.name || 'Team',
          teamId: String(team.id || ''), games: new Map()
        });
        const record = map.get(id);
       if (!record.games.has(gameId)) record.games.set(gameId, { gameDate, opponent });
        const line = record.games.get(gameId);
        for (const def of definitions) {
          if (normalize(def.group) !== groupName) continue;
          const value = extract(item.statistics, groupName, def.keys);
          if (value !== null) line[def.key] = value;
        }
      }
    }
  }
  const lineKey = (record, def) => `unit501:player-line:v1:${lineScope}:${record.teamId}:${record.id}:${def.key}`;
  function readLine(key) {
    let entry = enteredLines.get(key);
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
    title.textContent = 'Saved line comparisons';
    const note = document.createElement('p');
    note.textContent = 'Selected game only. Historical comparisons, not ranked picks or win probabilities. Recheck current FanDuel lines.';
    note.style.cssText = 'font-size:.9em;opacity:.8';
    board.append(title, note);
    const rows = [];
    for (const record of choices) {
      for (const def of definitions) {
        const entry = readLine(lineKey(record, def));
        const line = n(entry.value);
        if (line === null || !Number.isInteger(line * 2) || (!def.key.endsWith('Yds') && line < 0)) continue;
        const model = projectionFor(record, def);
        if (!model) continue;
        rows.push({record, def, entry, line, ...model});
      }
    }
    if (!rows.length) {
      const empty = document.createElement('p');
      empty.textContent = 'Enter a line on any player card below. Your comparisons will appear here together.';
      board.append(empty);
      return;
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
    for (const name of ['Player / team', 'Stat', 'Projection', 'Line', 'Difference', 'Recent above / below / equal', 'Saved (CT)']) {
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
      const fields = [null, row.def.title, projection.toFixed(1), String(row.line),
        diff === 0 ? 'Equal' : `${Math.abs(diff).toFixed(1)} ${diff > 0 ? 'above' : 'below'}`,
        `${above} / ${below} / ${equal} (${row.values.length} games)`,
        row.entry.persisted && row.entry.savedAt ? new Date(row.entry.savedAt).toLocaleString('en-US', {timeZone:'America/Chicago', month:'short', day:'numeric', hour:'numeric', minute:'2-digit'}) : 'Session only'];
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
    label.textContent = 'FanDuel line (enter manually)';
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
      savedInfo.textContent = entry.persisted && valid
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
      comparison.textContent = `${summary} Recent recorded games: ${above} above, ${below} below, ${equal} equal (${values.length} games). Historical comparison only; not a win probability.`;
    }
    input.addEventListener('input', () => update(true));
    card.append(label, savedInfo, comparison);
    update();
  }
  function projectionFor(record, def) {
    const history = Array.from(record.games.values()).sort((a, b) => b.gameDate - a.gameDate);
    const opponent = matchupTeams.find(team => team.id !== record.teamId);
    const opponentStats = opponentDefense.get(opponent?.id);
    const ownOffense = teamOffense.get(record.teamId);
      const values = history.map(x => x[def.key]).filter(x => x !== undefined);
      const gameDetails = history.filter(x => x[def.key] !== undefined);
      if (values.length < 2) return null;
      const average = values.reduce((a, b) => a + b, 0) / values.length;
      const weighted = values.reduce((sum, value, index) =>
        sum + value * (values.length - index), 0
      ) / (values.length * (values.length + 1) / 2);
      let adjusted = weighted;
      let adjustment = null;
      if (def.key === 'rushYds' || def.key === 'passYds') {
        const offenseKey = def.key === 'rushYds' ? 'rushYards' : 'passYards';
        const defenseKey = def.key === 'rushYds' ? 'rushAllowed' : 'passAllowed';
        const offense = ownOffense?.[offenseKey] || [];
        const defense = opponentStats?.[defenseKey] || [];
        if (offense.length >= 2 && defense.length >= 2 && mean(offense) > 0) {
          // A cautious heuristic, capped at +/-7.5%; not a calibrated forecast.
          const factor = Math.max(0.85, Math.min(1.15, mean(defense) / mean(offense)));
          adjustment = (factor - 1) * 0.5;
          adjusted = weighted * (1 + adjustment);
        }
      }
    return {values, gameDetails, average, weighted, adjusted, adjustment, opponent, opponentStats};
  }
  function showPlayer() {
    renderComparisons();
    results.replaceChildren();
    const record = choices.find(x => x.id === picker.value);
    if (!record) return;
    const title = document.createElement('h3');
    title.textContent = `${record.name} — ${record.team}`;
    results.appendChild(title);
    let shown = 0;
    for (const def of definitions) {
      const model = projectionFor(record, def);
      if (!model) continue;
      const {values, gameDetails, average, weighted, adjusted, adjustment, opponent, opponentStats} = model;
      const recent = values.slice(0, Math.min(2, values.length));
const earlier = values.slice(Math.min(2, values.length));
const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
const earlierAvg = earlier.length
  ? earlier.reduce((a, b) => a + b, 0) / earlier.length
  : null;

const trend = earlierAvg === null
  ? 'Not enough games to determine a trend'
  : recentAvg > earlierAvg
    ? 'Trending up'
    : recentAvg < earlierAvg
      ? 'Trending down'
      : 'Holding steady';
      const card = document.createElement('div');
      card.style.cssText = 'border:1px solid #45495b;border-radius:12px;padding:12px;margin:10px 0';
      const heading = document.createElement('b');
  heading.textContent = `${def.title}: ${adjusted.toFixed(1)} projected | ${average.toFixed(1)} average`;
      const context = document.createElement('p');
      context.style.cssText = 'margin:6px 0 0;opacity:.82';
     context.textContent = `Recent games (${values.length}, newest first): ${gameDetails.map(g => `${new Date(g.gameDate * 1000).toLocaleDateString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric' })} vs ${g.opponent}: ${g[def.key]}`).join(' • ')} • observed range ${Math.min(...values)}–${Math.max(...values)} • ${trend}`;
      card.append(heading, context); results.appendChild(card);
      if (def.key === 'rushYds' || def.key === 'passYds') {
  const allowed = opponentStats?.[
    def.key === 'rushYds' ? 'rushAllowed' : 'passAllowed'
  ] || [];

  if (allowed.length) {
    const avgAllowed = allowed.reduce((a, b) => a + b, 0) / allowed.length;
    const defense = document.createElement('p');
    defense.textContent = `${opponent?.name || 'Opponent'} defense: ${avgAllowed.toFixed(1)} team yards allowed per game (${allowed.length} ${allowed.length === 1 ? 'game' : 'games'}, from recorded player stats).`;
    card.appendChild(defense);
  }
  const explanation = document.createElement('p');
  explanation.textContent = adjustment === null
    ? `Recent weighted baseline: ${weighted.toFixed(1)}. No defense adjustment: need at least two games of offense and defense yardage, with a positive offense average.`
    : `Recent weighted baseline: ${weighted.toFixed(1)}. Matchup adjustment: ${adjustment >= 0 ? '+' : ''}${(adjustment * 100).toFixed(1)}% (limited to ±7.5%).`;
  card.appendChild(explanation);
}
      addLineComparison(card, record, def, adjusted, values);
      shown++;
    }
    if (!shown) results.textContent = 'Not enough recent games with this player’s recorded stats to estimate a projection.';
    const note = document.createElement('p');
    note.style.opacity = '.8';
    note.textContent = 'Simple historical baseline only. Confirm current roster, injury status, weather and expected playing time before comparing with a betting line.';
    results.appendChild(note);
  }
  function reset() {
    sequence++;
    loadedFor = null;
    choices = [];
    opponentDefense.clear();
    teamOffense.clear();
    matchupTeams = [];
    enteredLines.clear();
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
    status.textContent = 'Finding recent games…';
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
          const id = g.game?.id || g.id;
          const time = gameTime(g);
          const code = String(g.game?.status?.short || '').toUpperCase();
          return id && time < kickoff && (['FT', 'AOT', 'FINAL'].includes(code) || /finish|final|after overtime/i.test(g.game?.status?.long || ''));
        }).sort((a, b) => gameTime(b) - gameTime(a)).slice(0, 4);
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
      status.textContent = `Reading player stats from ${past.size} recent team games…`;
      const ids = Array.from(past.keys());
      const map = new Map();
      matchupTeams = teams.map(team => ({ id: String(team.id), name: team.name || 'Opponent' }));
      opponentDefense = new Map(teamIds.map(id => [
  id, { rushAllowed: [], passAllowed: [] }
]));
    teamOffense = new Map(teamIds.map(id => [
  id, { rushYards: [], passYards: [] }
]));  
     // Sequential requests are intentionally gentler on rate limits.
         for (const id of ids) {
        const rows = await json(`/api/player-stats?game=${id}`);
        if (task !== sequence) return;
        const pastGame = past.get(id);
        for (const [teamId, opponent] of pastGame.teams) {
          const teamEntry = rows.find(row => String(row.team?.id) === teamId);
          const opponentBox = rows.find(row => String(row.team?.id) === opponent.id);
          if (teamEntry) accumulate(map, teamEntry, id, pastGame.date, opponent.name);
          for (const category of ['rushing', 'passing']) {
            const ownYards = teamYards(teamEntry, category);
            const allowedYards = teamYards(opponentBox, category);
            if (ownYards !== null) teamOffense.get(teamId)[category === 'rushing' ? 'rushYards' : 'passYards'].push(ownYards);
            if (allowedYards !== null) opponentDefense.get(teamId)[category === 'rushing' ? 'rushAllowed' : 'passAllowed'].push(allowedYards);
          }
        }
      }
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
    } catch (e) {
      if (task === sequence) status.textContent = 'Could not load projections: ' + e.message;
    } finally {
      if (task === sequence) button.disabled = false;
    }
  });
  picker.addEventListener('change', showPlayer);
  reset();
})();
