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
    return x.response || [];
  };
  const normalize = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
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
  function accumulate(map, teamEntry, gameId, gameDate) {
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
        if (!record.games.has(gameId)) record.games.set(gameId, { gameDate });
        const line = record.games.get(gameId);
        for (const def of definitions) {
          if (normalize(def.group) !== groupName) continue;
          const value = extract(item.statistics, groupName, def.keys);
          if (value !== null) line[def.key] = value;
        }
      }
    }
  }
  function showPlayer() {
    results.replaceChildren();
    const record = choices.find(x => x.id === picker.value);
    if (!record) return;
    const title = document.createElement('h3');
    title.textContent = `${record.name} — ${record.team}`;
    results.appendChild(title);
    const history = Array.from(record.games.values()).sort((a, b) => b.gameDate - a.gameDate);
    let shown = 0;
    for (const def of definitions) {
      const values = history.map(x => x[def.key]).filter(x => x !== undefined);
      if (values.length < 2) continue;
      const average = values.reduce((a, b) => a + b, 0) / values.length;
      const card = document.createElement('div');
      card.style.cssText = 'border:1px solid #45495b;border-radius:12px;padding:12px;margin:10px 0';
      const heading = document.createElement('b');
      heading.textContent = `${def.title}: ${average.toFixed(def.key.endsWith('Yds') ? 0 : 1)}`;
      const context = document.createElement('p');
      context.style.cssText = 'margin:6px 0 0;opacity:.82';
      context.textContent = `Recent games (${values.length}): ${values.join(', ')} • observed range ${Math.min(...values)}–${Math.max(...values)}`;
      card.append(heading, context); results.appendChild(card);
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
    picker.disabled = true;
    picker.replaceChildren();
    results.replaceChildren();
    status.textContent = 'Tap Get player projections for this matchup.';
    button.disabled = false;
  }
  el('games').addEventListener('click', event => {
    if (event.target.closest('.game')) reset();
  });
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
      const teamIds = [target.teams?.away?.id || target.teams?.visitors?.id, target.teams?.home?.id].map(String);
      if (teamIds.some(x => !/^\d+$/.test(x))) throw new Error('Team IDs were not provided for this game.');
      const kickoff = target.game?.date?.timestamp ? target.game.date.timestamp * 1000 : new Date(`${date}T23:59:59`).getTime();
      const history = await Promise.all(teamIds.map(team => json(`/api/team-games?team=${team}&season=${season}`)));
      const past = new Map();
      history.forEach((list, i) => {
        const previous = list.filter(g => {
          const id = g.game?.id || g.id;
          const time = g.game?.date?.timestamp ? g.game.date.timestamp * 1000 : Date.parse(g.game?.date?.date || '');
          const code = String(g.game?.status?.short || '').toUpperCase();
          return id && time < kickoff && (['FT', 'AOT', 'FINAL'].includes(code) || /finish|final|after overtime/i.test(g.game?.status?.long || ''));
        }).sort((a, b) => (b.game?.date?.timestamp || 0) - (a.game?.date?.timestamp || 0)).slice(0, 4);
        previous.forEach(g => past.set(String(g.game?.id || g.id), {
          date: g.game?.date?.timestamp || 0, teamId: teamIds[i]
        }));
      });
      if (!past.size) throw new Error('No completed games available this season for these teams yet.');
      if (task !== sequence) return;
      status.textContent = `Reading player stats from ${past.size} recent team games…`;
      const ids = Array.from(past.keys());
      const map = new Map();
      // Sequential requests are intentionally gentler on rate limits.
      for (const id of ids) {
        const rows = await json(`/api/player-stats?game=${id}`);
        if (task !== sequence) return;
        for (const teamEntry of rows) {
          if (teamIds.includes(String(teamEntry.team?.id))) {
            accumulate(map, teamEntry, id, past.get(id).date);
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
