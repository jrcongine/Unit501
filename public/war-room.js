/* Manual research board. Public sources are links, never automatic pick claims. */
(function () {
  'use strict';
  const core = window.Unit501WarRoomCore;
  const byId = id => document.getElementById(id);
  const message = byId('war-message');
  if (!core || !byId('war-form')) return;
  let rows = core.load(localStorage);
  const people = {jr:'J.R.', aria:'Aria', unit501:'Unit 501'};
  const resultNames = {pending:'Not graded', won:'Won', lost:'Lost', push:'Push', void:'Void'};
  function element(tag, text, className) {
    const el = document.createElement(tag);
    if (text !== undefined) el.textContent = text;
    if (className) el.className = className;
    return el;
  }
  function persist(next) {
    if (!core.save(localStorage, next)) {
      message.textContent = 'Could not save War Room data on this device. Check browser storage.';
      return false;
    }
    rows = next;
    return true;
  }
  function render() {
    const s = core.summary(rows);
    byId('war-stats').textContent = s.logged + ' candidates logged • ' +
      s.approved + ' board-approved • ' + s.wins + 'W–' + s.losses + 'L on graded approved picks' +
      (s.pending ? ' • ' + s.pending + ' awaiting results' : '') +
      '. Pushes and voids excluded from W–L.';
    const list = byId('war-list');
    list.replaceChildren();
    if (!rows.length) {
      list.append(element('p', 'No board decisions saved yet. Add a proposed pick and cast the three independent votes.', 'war-muted'));
      return;
    }
    const ordered = rows.slice().sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
    for (const record of ordered) {
      const outcome = core.decision(record.votes);
      const card = element('article', undefined, 'war-record');
      const top = element('div', undefined, 'war-record-head');
      top.append(element('strong', record.matchup + ' — ' + record.pick), element('span', record.date, 'war-muted'));
      card.append(top);
      const status = element('p',
        (outcome.status === 'approved' ? 'APPROVED' : outcome.status === 'rejected' ? 'REJECTED' : 'NO MAJORITY') +
        ' • ' + outcome.yes + ' for / ' + outcome.no + ' against / ' + outcome.missing + ' uncast',
        'war-status ' + outcome.status);
      card.append(status);
      const votes = element('p', core.MEMBERS.map(member =>
        people[member] + ': ' + (record.votes[member] === 'for' ? 'For' : record.votes[member] === 'against' ? 'Against' : 'Not cast')
      ).join(' • '), 'war-muted');
      card.append(votes);
      for (const [name, key] of [['Covers', 'covers'], ['WagerTalk', 'wagertalk'], ['Juice Reel', 'juicereel'], ['EV', 'ev']]) {
        if (record.sources[key]) card.append(element('p', name + ': ' + record.sources[key], 'war-source-note'));
      }
      if (record.notes) card.append(element('p', 'Board notes: ' + record.notes, 'war-source-note'));
      const tools = element('div', undefined, 'war-record-actions');
      const gradeLabel = element('label', 'Result: ');
      const grade = element('select');
      grade.setAttribute('aria-label', 'Result for ' + record.matchup + ' ' + record.pick);
      for (const value of ['pending', 'won', 'lost', 'push', 'void']) {
        const option = element('option', resultNames[value]);
        option.value = value;
        grade.append(option);
      }
      grade.value = record.result;
      grade.addEventListener('change', () => {
        const updated = rows.map(item => item.id === record.id ? {...item, result:grade.value} : item);
        if (persist(updated)) { message.textContent = 'Result saved (manually graded).'; render(); }
        else grade.value = record.result;
      });
      gradeLabel.append(grade);
      const remove = element('button', 'Remove', 'war-remove');
      remove.type = 'button';
      remove.setAttribute('aria-label', 'Remove ' + record.matchup + ' ' + record.pick);
      remove.addEventListener('click', () => {
        if (!window.confirm('Remove this saved War Room decision?')) return;
        if (persist(rows.filter(item => item.id !== record.id))) { message.textContent = 'Decision removed.'; render(); }
      });
      tools.append(gradeLabel, remove);
      card.append(tools);
      list.append(card);
    }
  }
  byId('war-date').value = byId('date').value || new Date().toISOString().slice(0, 10);
  byId('war-use-game').addEventListener('click', () => {
    const lab = byId('lab');
    const matchup = byId('matchup').textContent.trim();
    if (!matchup || matchup === 'Game Lab' || lab.classList.contains('hidden')) {
      message.textContent = 'Select a matchup in Game Lab first, or enter a matchup manually.';
      return;
    }
    byId('war-matchup').value = matchup;
    byId('war-date').value = byId('date').value || byId('war-date').value;
    message.textContent = 'Game Lab matchup copied. Enter the exact pick and price separately.';
  });
  byId('war-form').addEventListener('submit', event => {
    event.preventDefault();
    const raw = {
      id:Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 11),
      createdAt:new Date().toISOString(),
      date:byId('war-date').value,
      matchup:byId('war-matchup').value,
      pick:byId('war-pick').value,
      votes:Object.fromEntries(core.MEMBERS.map(member => [member, byId('war-vote-' + member).value])),
      sources:Object.fromEntries(core.ADVISERS.map(source => [source, byId('war-source-' + source).value])),
      notes:byId('war-notes').value,
      result:'pending'
    };
    const record = core.normalize(raw);
    if (!record) {
      message.textContent = 'Add a game date, matchup, and a specific pick with its line/price.';
      return;
    }
    if (rows.length >= 250) {
      message.textContent = 'This device has reached 250 decisions. Export a backup before removing old records.';
      return;
    }
    if (persist([record, ...rows])) {
      const verdict = core.decision(record.votes).status;
      message.textContent = 'Saved • ' + (verdict === 'approved' ? '2-of-3 board approval' : verdict === 'rejected' ? 'Board rejected' : 'Board undecided');
      byId('war-pick').value = '';
      byId('war-notes').value = '';
      for (const member of core.MEMBERS) byId('war-vote-' + member).value = 'pending';
      for (const source of core.ADVISERS) byId('war-source-' + source).value = '';
      render();
    }
  });
  byId('war-export').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify({version:1, exportedAt:new Date().toISOString(), decisions:rows}, null, 2)], {type:'application/json'});
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href;
    a.download = 'unit501-war-room.json';
    document.body.append(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(href);
    message.textContent = 'War Room backup downloaded.';
  });
  byId('war-import').addEventListener('change', async event => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    try {
      const payload = JSON.parse(await file.text());
      if (!payload || payload.version !== 1 || !Array.isArray(payload.decisions)) throw Error('Invalid backup');
      if (payload.decisions.length > 250) throw Error('Backup has more than 250 decisions');
      const restored = payload.decisions.map(core.normalize);
      if (restored.some(record => !record)) throw Error('Backup contains invalid records');
      const combined = new Map([...rows, ...restored].map(item => [item.id, item]));
      if (combined.size > 250) throw Error('Combined list exceeds 250 decisions; export and remove older records');
      if (persist([...combined.values()])) { message.textContent = 'War Room backup imported; existing IDs merged.'; render(); }
    } catch (error) {
      message.textContent = 'Backup not imported: ' + error.message;
    } finally {
      event.target.value = '';
    }
  });
  render();
})();
