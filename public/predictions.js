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
  const roleReviews = new Map();
  const starScenarios = new Map(); // Manually selected per player; default OFF.
  const shortlisted = new Set();
  let lineScope = '';
  let sequence = 0;
  let propSequence = 0;
  const propStatus = document.createElement('p');
  propStatus.id = 'prop-feed-status';
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
    propStatus.textContent = 'Loading FanDuel prop lines… Existing quotes stay visible unless a new response succeeds.';
    try {
      const params = new URLSearchParams({away:game.a,home:game.h,league:game.league || el('league').value,kickoff:game.kickoff});
      const res = await fetch('/api/fanduel-props?' + params, {signal:AbortSignal.timeout(30000)});
      const data = await res.json();
      if (task !== propSequence || selection !== sequence) return;
      if (!res.ok || data.error) throw new Error(data.error || 'FanDuel props unavailable.');
      if (!Array.isArray(data.props)) throw new Error('FanDuel prop response had no valid list of quotes.');
      // Replace previous automatic quotes only after a successful feed response.
      // A 401, exhausted quota, network failure or invalid response must not erase them.
      for (const [key, entry] of enteredLines) if (entry.source === 'auto') enteredLines.delete(key);
      let count = 0;
      for (const record of choices) {
        // Never guess abbreviated names or select between duplicate player names.
        if (choices.filter(p => playerName(p.name) === playerName(record.name)).length !== 1) continue;
        for (const def of definitions) {
          const quotes = (data.props || []).filter(p => p.stat === def.key && playerName(p.name) === playerName(record.name));
          if (quotes.length !== 1) continue;
          const quote = quotes[0];
          if (!Number.isFinite(quote.line) || !Number.isFinite(quote.updatedAt) || quote.updatedAt > Date.now()+60000 || Date.now() - quote.updatedAt > 1800000) continue;
          const key = lineKey(record, def);
          const entry = readLine(key);
          if (entry.value !== '') continue;
          const movement=window.Unit501LineWatch?.fromServer(quote.history,quote.line,quote.updatedAt);
          enteredLines.set(key, {value:String(quote.line),savedAt:quote.updatedAt,persisted:false,source:'auto',
            over:quote.over,under:quote.under,movement});
          count++;
        }
      }
      const coverage = Array.isArray(data.coverage) ? data.coverage : [];
      const covered = coverage.filter(m=>m.lines>0).length;
      const missing = coverage.filter(m=>m.lines===0).map(m=>definitions.find(d=>d.key===m.stat)?.title).filter(Boolean);
      const detail = coverage.length ? ` ${covered}/${coverage.length} modeled markets returned usable lines.${missing.length ? ' No usable lines returned for: '+missing.join(', ')+'.' : ''}` : '';
      const unmatched=[...new Set(data.props.filter(q=>choices.filter(p=>playerName(p.name)===playerName(q.name)).length!==1).map(q=>q.name))];
      const matchingDetail=` ${data.props.length} usable quotes returned by the feed.${unmatched.length?' Unmatched or ambiguous player names: '+unmatched.join(', ')+'.':''}`;
      propStatus.textContent = `${data.message || ''}${detail}${matchingDetail} ${count} player lines filled. ${data.tracking?.message||'Shared tracking status unavailable.'}`;
      showPlayer();
    } catch (e) {
      if (task === propSequence && selection === sequence) propStatus.textContent = e.message + ' Existing fresh quotes were kept; you can also enter lines manually.';
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
    const res = await fetch(url, {signal:AbortSignal.timeout(url.startsWith('/api/football/participation?')?90000:20000)});
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
  const scenarioControls=document.createElement('section');
  scenarioControls.id='player-scenario-controls';
  scenarioControls.className='player-scenario-controls';
  scenarioControls.hidden=true;
  board.before(scenarioControls);
  function roleFor(record,key){
    const team=window.Unit501Availability?.snapshot()?.teams?.find(t=>String(t.id)===String(record.teamId));
    return Unit501PlayerForm.roleContext(Array.from(record.games.values()),key,team,record.playerId,selected,roleReviews.get(record.id)||'');
  }
  function roleBadges(parent,role){
    for(const alert of role.alerts){
      const badge=document.createElement('div');badge.className='prop-role-badge';
      const label=document.createElement('strong');label.textContent=alert.label;
      const detail=document.createElement('span');
      detail.className='prop-role-detail';detail.textContent=alert.detail;
      badge.append(label,detail);parent.append(badge);
    }
  }
  function renderComparisons() {
    board.replaceChildren();
    if (!loadedFor) return;
    const title = document.createElement('h3');
    title.textContent = 'Our projections vs FanDuel';
    const note = document.createElement('p');
    note.textContent = 'Selected game • Our projection, FanDuel line and difference. Unavailable players are excluded. Open Report details for sources and missing data; no injury listed does not confirm participation.';
    note.style.cssText = 'font-size:.9em;opacity:.8';
    board.append(title, note);
    if (starScenarios.size) {
      const flag=document.createElement('p');
      flag.textContent='🎮 Manual game-day scenarios active for '+starScenarios.size+' player(s). Experimental +10% Star Power / −10% Rivalry Dud / −5% Short-week Fatigue, not calibrated; automatic research queue excludes altered projections.';
      flag.style.cssText='color:#b0eaff;font-weight:600';
      board.append(flag);
    }
    const rows = [];
    for (const record of choices) {
      if (window.Unit501Availability?.assess(record.teamId, record.playerId).blocked) continue;
      for (const def of definitions) {
        const entry = readLine(lineKey(record, def));
        const line = n(entry.value);
        if (line === null || !Number.isInteger(line * 2) || (!def.key.endsWith('Yds') && line < 0)) continue;
        const model = projectionFor(record, def);
        if (!model) continue;
        if(window.Unit501ForecastArchive && !model.starPower.applied)Unit501ForecastArchive.save(localStorage,propSnapshot(record,def,model));
        const availability = window.Unit501Availability?.assess(record.teamId, record.playerId);
        const checks = Unit501PlayerForm.reviewChecks(model, entry, availability);
        if(model.role.changed)checks.push('Role / usage change: verify current workload; season baseline may lag');
        const support = Unit501PlayerForm.dataSupport(model, availability);
        rows.push({record, def, entry, line, checks, support, ...model});
      }
    }
    if (board.dataset.scope !== lineScope) {
  shortlisted.clear();
  board.dataset.shortlist = '';
  board.dataset.scope = lineScope;
  board.dataset.team = '';
  board.dataset.stat = '';
  board.dataset.review = '';
  board.dataset.support = '';
  board.dataset.direction = '';
  board.dataset.sort = '';
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

  select.id = `prop-filter-${key}`;
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

addFilter('shortlist', 'Show', [
  ['', 'All comparisons'],
  ['selected', 'My shortlist'],
   ['automatic', 'Automatic research queue']
]);

addFilter('stat', 'Stat', [
  ['', 'All stats'],
  ...definitions.map(def => [def.key, def.title])
]);

addFilter('review', 'Review', [
  ['', 'All comparisons'],
  ['workload', 'Recorded workload without warnings'],
  ['refresh', 'Lines needing refresh']
]);

addFilter('support', 'Data support', [
  ['', 'All samples'],
  ['review', 'Needs data review'],
  ['clean', 'No extra statistical flags (5+ games)'],
  ['thin', 'Thin sample (<5 games)']
]);

addFilter('direction', 'Projection', [
  ['', 'Above and below line'],
  ['above', 'Above line'],
  ['below', 'Below line']
]);
addFilter('sort', 'Order', [
  ['', 'Player order'],
  ['reviewed-gap', 'Cleaner data first — biggest difference'],
  ['gap', 'Largest discrepancy overall'],
  ['stat-gap', 'Largest difference within each stat'],
  ['above-desc', 'Highest Above %'],
  ['above-asc', 'Lowest Above %'],
  ['below-desc', 'Highest Below %'],
  ['below-asc', 'Lowest Below %'],
  ['most-covers', 'Most Covers'],
  ['least-covers', 'Least Covers'],
  ['sample', 'Most recorded games']
]);
board.append(filters);
const shortlistNote = document.createElement('p');
shortlistNote.textContent = `${shortlisted.size} shortlisted for this matchup. My shortlist follows all active filters; unavailable players and expired automatic lines are omitted. This is not a ranked recommendation.`;
const clearShortlist = document.createElement('button');
clearShortlist.id = 'clear-prop-shortlist';
clearShortlist.type = 'button';
clearShortlist.textContent = 'Clear shortlist';
clearShortlist.disabled = !shortlisted.size;
clearShortlist.addEventListener('click', () => { shortlisted.clear(); renderComparisons(); });
board.append(shortlistNote, clearShortlist);
const researchNote = document.createElement('p');
 researchNote.textContent = 'Automatic research queue only: fresh FanDuel lines with at least one quoted side, 5+ recorded games, no model data-review flags, full recorded workload and a projection different from the line. Players still require independent starter, injury and price verification. This is not a betting edge, prediction confidence or automatic board vote.';
 researchNote.style.cssText='font-size:.9em;opacity:.85';
 if(board.dataset.shortlist==='automatic')board.append(researchNote);
 const orderingNote = document.createElement('p');
orderingNote.textContent = /^(above|below)-(asc|desc)$/.test(board.dataset.sort)
   ? 'Sorted by percentage '+(board.dataset.sort.startsWith('above')?'above':'below')+' the line, '+(board.dataset.sort.endsWith('desc')?'highest':'lowest')+' first. Incomplete stat histories are unverified and rank last. Equal results are non-hits; ties use more recorded games.'
   : ['most-covers','least-covers'].includes(board.dataset.sort)
   ? 'Sorted across visible props by percentage above the current line. Equal results remain separate; ties favor more below-line results for Least Covers, then more recorded games. Historical frequency, not win probability.'
   : board.dataset.sort === 'reviewed-gap'
   ? 'Cleaner data first sorts props with at least five recorded games and no statistical or workload flags ahead of those needing review, then orders by absolute projection-versus-line difference. It is not a betting-edge ranking; playing status, odds and model calibration still need verification.'
   : board.dataset.sort === 'gap'
   ? 'Largest discrepancy overall ranks every visible prop by the absolute distance between projection and line, biggest first. It mixes yards, attempts and counts, so this is a raw numerical comparison, not betting value or a win probability.'
   : 'Largest difference within each stat keeps stat categories separate and sorts by absolute projection-versus-line distance inside each category. Neither sort predicts the chance of winning; verify participation, prices and model reliability.';
orderingNote.style.cssText = 'font-size:.85em;opacity:.8';
board.append(orderingNote);

for (let i = rows.length - 1; i >= 0; i--) {
  if ((board.dataset.team && rows[i].record.teamId !== board.dataset.team) ||
      (board.dataset.shortlist === 'selected' && !shortlisted.has(lineKey(rows[i].record, rows[i].def))) ||
       (board.dataset.shortlist === 'automatic' && (
        rows[i].entry.source!=='auto'||!Number.isFinite(rows[i].entry.savedAt)||
        Date.now()-rows[i].entry.savedAt>1800000||rows[i].entry.savedAt>Date.now()||
        !['over','under'].some(side=>Number.isInteger(rows[i].entry[side])&&Math.abs(rows[i].entry[side])>=100)||
        rows[i].support.count<5||rows[i].support.needsReview||rows[i].checks.length>0||
        rows[i].form.usageUnavailable||rows[i].workloadWarning||rows[i].workloadHistory.missing>0||
        rows[i].workload!==100||rows[i].lineupChange||rows[i].starPower.applied||
        Number(rows[i].adjusted.toFixed(1))===rows[i].line)) ||
      (board.dataset.stat && rows[i].def.key !== board.dataset.stat) ||
      (board.dataset.review === 'workload' && (rows[i].values.length < 5 || rows[i].workloadWarning || rows[i].form.usageUnavailable || rows[i].workloadHistory.missing > 0 || rows[i].form.coverage.missing > 0 || rows[i].workload !== 100 || rows[i].lineupChange)) ||
      (board.dataset.review === 'refresh' && !rows[i].checks.includes('Refresh line')) ||
      (board.dataset.support === 'review' && !rows[i].support.needsReview) ||
      (board.dataset.support === 'clean' && rows[i].support.needsReview) ||
      (board.dataset.support === 'thin' && rows[i].support.count >= 5) ||
      (board.dataset.direction === 'above' && Number((Number(rows[i].adjusted.toFixed(1)) - rows[i].line).toFixed(1)) <= 0) ||
      (board.dataset.direction === 'below' && Number((Number(rows[i].adjusted.toFixed(1)) - rows[i].line).toFixed(1)) >= 0)) {
    rows.splice(i, 1);
  }
}
    if (['gap','stat-gap','reviewed-gap'].includes(board.dataset.sort)) {
      const statOrder = new Map(definitions.map((def, index) => [def.key, index]));
      const gap = row => Math.abs(Number((Number(row.adjusted.toFixed(1)) - row.line).toFixed(1)));
      rows.sort((a, b) => (board.dataset.sort === 'stat-gap'
        ? statOrder.get(a.def.key) - statOrder.get(b.def.key) || gap(b) - gap(a)
        : board.dataset.sort === 'reviewed-gap'
        ? Number(a.support.needsReview) - Number(b.support.needsReview) || gap(b) - gap(a)
        : gap(b) - gap(a)) || statOrder.get(a.def.key) - statOrder.get(b.def.key) ||
        a.record.name.localeCompare(b.record.name));
    } else if (['most-covers','least-covers'].includes(board.dataset.sort)) {
      rows.sort((a,b)=>Unit501PlayerForm.compareCovers(a,b,board.dataset.sort));
    } else if (/^(above|below)-(asc|desc)$/.test(board.dataset.sort)) {
      rows.sort((a,b)=>Unit501PlayerForm.compareRecent(a,b,board.dataset.sort));
    } else if (board.dataset.sort === 'sample') {
      rows.sort((a, b) => b.values.length - a.values.length);
    }
    const copy = document.createElement('button');
    copy.id = 'copy-prop-board';
    copy.type = 'button';
    copy.textContent = board.dataset.shortlist === 'selected' ? 'Copy filtered shortlist' : board.dataset.shortlist==='automatic'?'Copy research queue':'Copy filtered board';
    copy.disabled = !rows.length;
    const copyStatus = document.createElement('p');
    copyStatus.id = 'copy-prop-board-status';
    copyStatus.setAttribute('role', 'status');
    copy.addEventListener('click', async () => {
      // Reassess availability and line age at the click, not the last render.
      const scope = lineScope;
      const report = renderComparisons();
      const feedback = el('copy-prop-board-status');
      if (!report) { feedback.textContent = 'No current lines match these filters.'; return; }
      try {
        await navigator.clipboard.writeText(report);
        if (lineScope === scope && el('copy-prop-board-status') === feedback) feedback.textContent = 'Filtered board copied.';
      } catch {
        if (lineScope !== scope || el('copy-prop-board-status') !== feedback) return;
        feedback.textContent = 'Clipboard unavailable. Select and copy the text below.';
        const fallback = document.createElement('textarea');
        fallback.id = 'prop-board-copy-text';
        fallback.readOnly = true;
        fallback.rows = 10;
        fallback.style.cssText = 'width:100%;box-sizing:border-box';
        fallback.setAttribute('aria-label', 'Filtered prop board text');
        fallback.value = report;
        feedback.after(fallback);
        fallback.focus();
        fallback.select?.();
      }
    });
    board.append(copy, copyStatus);
    if (!rows.length) {
      const empty = document.createElement('p');
     empty.textContent = 'No lines match these filters. Reset the filters, or enter a line on a player card below.';
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
    for (const name of ['Player / team', 'Stat', 'Status', 'Stat games', 'Projection', 'Median', 'Line', 'Difference', 'Recent above / below / equal', 'Recorded workload', 'Observed line movement']) {
      const cell = document.createElement('th');
      cell.scope = 'col';
      if(name==='Recent above / below / equal'){
        const heading=document.createElement('span');heading.textContent='Recent ';
        cell.append(heading);
        for(const [index,side] of ['above','below'].entries()){
          if(index)cell.append(' / ');
          const sort=document.createElement('button');sort.type='button';
          sort.id='sort-recent-'+side;
          const active=board.dataset.sort.startsWith(side+'-');
          const ascending=board.dataset.sort===side+'-asc';
          sort.textContent=side[0].toUpperCase()+side.slice(1)+(active?(ascending?' ↑':' ↓'):'');
          sort.setAttribute('aria-label','Sort by '+side+' percentage, '+(active&&!ascending?'lowest':'highest')+' first');
          sort.setAttribute('aria-pressed',String(active));
          sort.addEventListener('click',()=>{
            board.dataset.sort=active&&!ascending?side+'-asc':side+'-desc';
            renderComparisons();
            el('sort-recent-'+side)?.focus({preventScroll:true});
          });
          cell.append(sort);
          if(active)cell.setAttribute('aria-sort',ascending?'ascending':'descending');
        }
        cell.append(' / Equal');
      }else cell.textContent = name;
      cell.style.cssText = 'padding:10px;border-bottom:1px solid #45495b';
      header.append(cell);
    }
    head.append(header);
    table.append(head);
    const body = document.createElement('tbody');
    const report = [
      board.dataset.shortlist === 'selected' ? 'Unit 501 — my filtered prop shortlist' : board.dataset.shortlist==='automatic'?'Unit 501 — automatic research queue (not betting recommendations)':'Unit 501 — filtered prop comparisons',
      `${matchupTeams.map(t => t.name).join(' vs ')} | ${el('date').value} | Game ${selected.id}`,
      `Copied ${new Date().toLocaleString('en-US', {timeZone:'America/Chicago'})} CT`,
      'Historical comparisons only; not ranked picks or win probabilities. Verify participation, role, current line and price.',
      ''
    ];
    for (const row of rows) {
      const tr = document.createElement('tr');
      if(row.role.active)tr.className='prop-role-alert';
      const projection = Number(row.adjusted.toFixed(1));
      const diff = Number((projection - row.line).toFixed(1));
      const above = row.values.filter(v => v > row.line).length;
      const below = row.values.filter(v => v < row.line).length;
      const equal = row.values.length - above - below;
      const sorted = [...row.values].sort((a, b) => a - b); const mid = Math.floor(sorted.length / 2); const median = sorted.length % 2   ? sorted[mid]   : (sorted[mid - 1] + sorted[mid]) / 2;  const fields = [null, row.def.title, Unit501InjuryModel.statusLabel(window.Unit501Availability?.assess(row.record.teamId, row.record.playerId)), row.form.coverage.recorded+'/'+row.form.coverage.total, projection.toFixed(1), median.toFixed(1), String(row.line),
        diff === 0 ? 'Equal' : `${Math.abs(diff).toFixed(1)} ${diff > 0 ? 'above' : 'below'}`,
        `${above} / ${below} / ${equal} (${row.values.length} games; Above ${row.values.length?(100*above/row.values.length).toFixed(1)+'%':'—'}, Below ${row.values.length?(100*below/row.values.length).toFixed(1)+'%':'—'})`,
        row.workloadHistory.text];
      const observed=row.entry.source==='auto'?row.entry.movement:null;
      const movement=observed?window.Unit501LineWatch.describe(observed)+' · '+window.Unit501LineWatch.detail(observed):'No automatic line history';
      fields.push(movement);
      const source = row.entry.source === 'auto' ? 'FanDuel automatic' : 'Manual entry';
      const lineTime = row.entry.savedAt ? new Date(row.entry.savedAt).toLocaleString('en-US', {timeZone:'America/Chicago'}) + ' CT' : 'Time unavailable';
      report.push(`${row.record.name} — ${row.record.team} | ${row.def.title} | Line ${row.line} | Projection ${projection.toFixed(1)} (${row.workload}% workload) | Data support: ${row.support.label} | ${fields[7]} | Median ${median.toFixed(1)} | Above/below/equal: ${fields[8]} | ${source}: ${lineTime} | ${movement}`);
      report.push(row.workloadHistory.text);
      for(const alert of row.role.alerts)report.push(alert.label+': '+alert.detail);
      report.push(`Review: ${row.checks.join('; ')}. ${window.Unit501Availability?.describe(row.record.teamId, row.record.playerId) || 'Availability not checked yet.'}`, '');
      fields.forEach((value, index) => {
        const cell = document.createElement('td');
        cell.style.cssText = 'padding:10px;border-bottom:1px solid #293142;vertical-align:top';
        if (index === 0) {
          const shortlistLabel = document.createElement('label');
          shortlistLabel.className = 'prop-shortlist-label';
          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.id = `shortlist-${row.record.id}-${row.def.key}`;
          const key = lineKey(row.record, row.def);
          checkbox.checked = shortlisted.has(key);
          checkbox.setAttribute('aria-label', `Shortlist ${row.record.name}, ${row.record.team}, ${row.def.title}`);
          checkbox.addEventListener('change', () => {
            if (checkbox.checked) shortlisted.add(key); else shortlisted.delete(key);
            renderComparisons();
          });
          shortlistLabel.append(checkbox, ' Shortlist ');
          cell.append(shortlistLabel);
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
          roleBadges(cell,row.role);
          const availabilityText = window.Unit501Availability?.describe(
  row.record.teamId, row.record.playerId
) || 'Availability not checked yet.';

const details = document.createElement('details');
details.style.cssText = 'margin-top:8px;font-size:.85em;color:#e8b95b';

const summary = document.createElement('summary');
summary.textContent = 'Report details';

const explanation = document.createElement('p');
explanation.textContent = [availabilityText, row.support.label, `${row.workload}% workload.`, row.weather.reason, row.checks.join(' • ')].join(' ');
details.append(summary, explanation);
cell.append(details);
        } else if (index === 8) {
          const recent=document.createElement('div');recent.className='prop-recent';
          const largest=Math.max(above,below,equal);
          for(const [label,count,tone] of [['Above',above,'above'],['Below',below,'below'],['Equal',equal,'equal']]){
            const item=document.createElement('span');
            item.className='prop-recent-item prop-recent-'+tone+(count===largest&&largest>0?' is-leading':'');
            const number=document.createElement('strong');number.textContent=String(count);
            const caption=document.createElement('span');caption.textContent=label+(row.form.coverage.missing?' · unverified':row.values.length?' · '+(100*count/row.values.length).toFixed(1)+'%':' · —');
            item.append(number,caption);recent.append(item);
          }
          cell.append(recent);
          if(row.form.coverage.missing){
            const warning=document.createElement('small');
            warning.style.cssText='display:block;margin-top:4px;color:#ffc184;font-size:11px';
            warning.textContent=row.form.coverage.missing+' missing stat '+(row.form.coverage.missing===1?'game':'games')+' — hit % unverified';
            warning.title='Missing box-score entries may hide zero catches or yards. A recorded-only hit rate is not a season hit rate.';
            cell.append(warning);
          }
        } else cell.textContent = value;
        tr.append(cell);
      });
      body.append(tr);
    }
    table.append(body);
    wrap.append(table);
    board.append(wrap);
    return report.join('\n');
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
        price.value = '';
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
    const direction=document.createElement('select');direction.id=`pick-direction-${record.id}-${def.key}`;
    for(const side of ['over','under']){const option=document.createElement('option');option.value=side;option.textContent=side;direction.append(option);}
    direction.setAttribute('aria-label',def.title+' pick direction');
    const price=document.createElement('input');price.id=`pick-price-${record.id}-${def.key}`;price.type='number';price.step='1';price.placeholder='American price (optional)';price.setAttribute('aria-label',def.title+' American price');
    const fillPrice=()=>{const value=entry.source==='auto'&&Date.now()-entry.savedAt<=1800000?entry[direction.value]:null;price.value=Number.isInteger(value)&&Math.abs(value)>=100?String(value):'';};
    direction.addEventListener('change',fillPrice);fillPrice();
    const pick=document.createElement('button');pick.type='button';pick.id=`save-pick-${record.id}-${def.key}`;pick.textContent='Save selected pick';
    const pickStatus=document.createElement('p');pickStatus.setAttribute('role','status');
    const game=selected;
    pick.addEventListener('click',()=>{
      if(selected!==game||window.Unit501Availability?.assess(record.teamId,record.playerId).blocked){pickStatus.textContent='Selection changed or player unavailable. Reload the projection.';return;}
      const model=projectionFor(record,def);
      const snapshot=model?propSnapshot(record,def,model):null;
      pickStatus.textContent=Unit501ForecastArchive.select(localStorage,snapshot,{market:def.key,direction:direction.value,line:n(input.value),price:price.value.trim()===''?null:Number(price.value)}).message;
    });
    input.addEventListener('input', () => update(true));
    card.append(label, savedInfo, comparison,direction,price,pick,pickStatus);
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
          // Apply this factor after replacement touches are included.
          matchupDefense={average:defense.average,games:defense.games,rank:defense.rank,pool:defense.pool};
        }
      }
    const lineup=window.Unit501Lineups?.evaluate();
    const lineupChange=lineup?.props?.[record.teamId+':'+record.playerId];
    if(window.Unit501LineupModel)adjusted=Unit501LineupModel.adjustProp(adjusted,def.key,lineupChange);
    if(adjustment!==null)adjusted*=1+adjustment;
    const workload = workloadScenarios.get(record.id) ?? 100;
    adjusted = Unit501InjuryModel.workloadProjection(adjusted, workload);
    const weather=window.Unit501WeatherModel?.effect(selected,typeof forecastContext!=='undefined'&&forecastContext?.game===selected?forecastContext.data:null,def.key,el('weatherEnabled')?.checked!==false) || {factor:1,reason:'Weather unavailable.'};
    const preWeather=adjusted;
    adjusted*=weather.factor;
    const beforeScenario=adjusted;
    const starPower=window.Unit501StarPower?.adjust(adjusted,starScenarios.get(record.id) || 'off',selected) ||
      {adjusted,applied:false,label:'Standard projection',factor:1,warning:'Modifier unavailable.'};
    adjusted=starPower.adjusted;
    return {role:roleFor(record,def.key),starPower,beforeScenario,weather,preWeather,baseline:form.baseline*(1+(adjustment??0)),lineupChange,values, gameDetails, average, weighted, adjusted, adjustment, opponent, opponentStats, matchupDefense, workload,form,workloadHistory:Unit501PlayerForm.workloadSummary(history,def.key),workloadWarning:Unit501PlayerForm.workloadWarning(history,def.key)};
  }
  function propSnapshot(record,def,model){
    const entry=readLine(lineKey(record,def));
    return Unit501ForecastArchive.captureProp({game:selected,teamId:record.teamId,playerId:record.playerId,market:def.key,baseline:model.baseline,adjusted:model.adjusted,
      inputs:{weather:model.weather,preWeather:model.preWeather,weatherForecast:typeof forecastContext!=='undefined'&&forecastContext?.game===selected?forecastContext.data:null,playerName:record.name,team:record.team,history:Array.from(record.games.values()),form:model.form,matchupDefense:model.matchupDefense,matchupAdjustment:model.adjustment,workload:model.workload,lineupChange:model.lineupChange,starPower:model.starPower,
        quote:{line:n(entry.value),over:Number.isFinite(entry.over)?entry.over:null,under:Number.isFinite(entry.under)?entry.under:null,source:entry.source||'manual',updatedAt:entry.savedAt},
        availability:window.Unit501Availability?.snapshot(),lineupInputs:window.Unit501Lineups?.snapshot()}},Date.now());
  }
  function showPlayer() {
    for (const option of Array.from(picker.children)) {
      const player=choices.find(p=>p.id===option.value);
      if(!player)continue;
      const assessment=window.Unit501Availability?.assess(player.teamId,player.playerId);
      option.textContent=`${player.name} — ${player.team}${assessment?.blocked?' — Projection withheld':assessment?' — '+Unit501InjuryModel.statusLabel(assessment):''}`;
    }
    renderComparisons();
    results.replaceChildren();
    scenarioControls.replaceChildren();scenarioControls.hidden=true;
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
    scenarioControls.hidden=false;
    const scenarioTitle=document.createElement('h3');
    scenarioTitle.textContent='Player controls — '+record.name+' — '+record.team;
    scenarioControls.append(scenarioTitle);
    const scopeNote=document.createElement('p');scopeNote.textContent='These controls apply to this selected player. Changes update their rows in the table below.';
    scenarioControls.append(scopeNote);
    const roleLabel=document.createElement('label');roleLabel.textContent='Role review: ';
    const roleSelect=document.createElement('select');roleSelect.id='player-role-review';
    for(const [value,label] of [['','Automatic evidence'],['new','New starter'],['returning','Back to starter role'],['primary','Primary option'],['increase','Significant usage increase']]){
      const option=document.createElement('option');option.value=value;option.textContent=label;roleSelect.append(option);
    }
    roleSelect.value=roleReviews.get(record.id)||'';
    roleSelect.addEventListener('change',()=>{
      if(roleSelect.value)roleReviews.set(record.id,roleSelect.value);else roleReviews.delete(record.id);
      showPlayer();
    });
    roleLabel.append(roleSelect);scenarioControls.append(roleLabel);
    const roleNote=document.createElement('p');roleNote.textContent='Role review highlights the player; their projection still uses recorded history. Season averages can lag a new or larger role.';
    scenarioControls.append(roleNote);
    const scenarioLabel = document.createElement('label');
    scenarioLabel.textContent = 'Workload scenario (% of recorded baseline): ';
    const scenario = document.createElement('select');
    scenario.id='player-workload-scenario';
    scenario.setAttribute('aria-label', 'Expected workload scenario');
    for (const percent of [100, 125, 150, 200, 75, 50, 25, 0]) {
      const option = document.createElement('option');
      option.value = String(percent);
      option.textContent = percent + '%' + (percent===100?' — recorded baseline':percent>100?' — larger role':' — reduced role');
      scenario.appendChild(option);
    }
    scenario.value = String(workloadScenarios.get(record.id) ?? 100);
    scenario.onchange = () => {
      workloadScenarios.set(record.id, Number(scenario.value));
      showPlayer();
    };
    scenarioLabel.appendChild(scenario);
    scenarioControls.appendChild(scenarioLabel);
    const scenarioNote = document.createElement('p');
    scenarioNote.textContent = '100% keeps the recorded baseline. For a new starter or expanded role, 125%, 150% and 200% model 25%, 50% and 100% more workload. These are manual assumptions, not an automatic promotion or a chance of playing. This scales this player’s props linearly without redistributing teammates’ touches or changing team scores. Avoid adding another increase for work already transferred in a confirmed replacement scenario. A 0% scenario is not an under recommendation; check sportsbook participation rules.';
    scenarioControls.appendChild(scenarioNote);
    // Manual player scenario switches affect only the selected player's props, not team scores.
    const powerPanel=document.createElement('div');
    powerPanel.id='player-power-controls';
    powerPanel.style.cssText='border:1px solid #55c8ec;border-radius:12px;background:#122c40;padding:12px;margin:12px 0';
    const powerHeading=document.createElement('strong');
    powerHeading.textContent='🎮 Player scenarios';
    powerPanel.append(powerHeading);
    const powerButtons=document.createElement('div');
    powerButtons.style.cssText='display:flex;flex-wrap:wrap;gap:8px;margin:12px 0';
    const activeMode=starScenarios.get(record.id) || 'off';
    for (const [mode,label] of [['off','Normal 0%'],['boost','⚡ Star Power +10%'],
      ['dud','⚡ Rivalry Dud −10%'],['fatigue','😴 Fatigue −5%']]) {
      const control=document.createElement('button');
      control.type='button';control.textContent=label;
      control.setAttribute('aria-pressed',String(activeMode===mode));
      control.style.cssText='padding:8px 10px;border-radius:9px;border:1px solid #55c8ec;cursor:pointer;'+
        (activeMode===mode?'background:#087b70;color:white;font-weight:bold':'background:#19384a;color:#e2f5ff');
      control.addEventListener('click',()=>{
        if(mode==='off')starScenarios.delete(record.id);else starScenarios.set(record.id,mode);
        showPlayer();
      });
      powerButtons.append(control);
    }
    const enhanceLabel=document.createElement('label');enhanceLabel.className='prime-time-toggle';
    const enhance=document.createElement('input');enhance.type='checkbox';enhance.id='prime-time-enhance';
    enhance.checked=activeMode==='boost';
    enhance.addEventListener('change',()=>{
      if(enhance.checked)starScenarios.set(record.id,'boost');else starScenarios.delete(record.id);
      showPlayer();
    });
    enhanceLabel.append(enhance,' Prime-Time Enhance — '+(enhance.checked?'ON':'OFF'));
    powerPanel.append(enhanceLabel,powerButtons);
    const powerNote=document.createElement('p');
    const preview=window.Unit501StarPower?.adjust(100,activeMode,selected) ||
      {applied:false,label:'Standard projection',factor:1,warning:'Game-day modifiers unavailable.'};
    powerNote.textContent=(preview.applied?preview.label+' changes only this player’s projected stats by '+
      Math.round((preview.factor-1)*100)+'%. ':'Standard projections active. ')+preview.warning+
      ' Experimental scenario only; not a validated betting edge or automatic player boost. Changes do not affect team totals.';
    powerNote.style.cssText='font-size:.9em;color:#c8dbe6;margin:0';
    powerPanel.append(powerNote);
    scenarioControls.append(powerPanel);
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
      if(window.Unit501ForecastArchive && !model.starPower.applied){
        const saved=Unit501ForecastArchive.save(localStorage,propSnapshot(record,def,model));
        const info=document.createElement('p');info.textContent=def.title+': '+saved.message;results.append(info);
      }
      const trend = model.form.trend + ' • ' + model.form.sample;
      const card = document.createElement('div');
      card.style.cssText = 'border:1px solid #45495b;border-radius:12px;padding:12px;margin:10px 0';
      const support = Unit501PlayerForm.dataSupport(model, window.Unit501Availability?.assess(record.teamId, record.playerId));
      const supportInfo = document.createElement('p');
      supportInfo.textContent = 'Data support: ' + support.label + '. Not a win probability; verify current participation, role and price.';
      card.append(supportInfo);
      const comparisonPanel=document.createElement('div');comparisonPanel.className='scenario-comparison';
      for(const [label,value] of [['Original',model.beforeScenario],['Adjusted',adjusted]]){
        const metric=document.createElement('div');
        const heading=document.createElement('span');heading.textContent=label;
        const amount=document.createElement('strong');amount.textContent=value.toFixed(1);
        metric.append(heading,amount);comparisonPanel.append(metric);
      }
      card.append(comparisonPanel);
      if(model.starPower.applied){
        const effect=document.createElement('p');
        effect.textContent=model.starPower.label+' · Manual scenario; original model kept separate.';
        card.append(effect);
      }
      if (model.workloadWarning) {
        const warning = document.createElement('p');
        warning.style.cssText = 'color:#e8b95b;margin:8px 0;';
        warning.textContent = model.workloadWarning;
        card.appendChild(warning);
      }
      if(model.form.usageUnavailable){const warning=document.createElement('p');warning.textContent=model.form.usageUnavailable;card.append(warning);}
      if(model.form.outlierAdjustment?.count){
        const warning=document.createElement('p');
        warning.style.cssText='color:#e8b95b;margin:8px 0';
        warning.textContent=`Outlier safeguard: ${model.form.outlierAdjustment.count} unusually high yardage game(s) limited to ${model.form.outlierAdjustment.cap.toFixed(1)} in the fallback estimate. Raw form baseline ${model.form.outlierAdjustment.originalBaseline.toFixed(1)} → guarded ${model.form.outlierAdjustment.adjustedBaseline.toFixed(1)}. Actual box scores unchanged; not a validated betting edge.`;
        card.append(warning);
      }
      if(model.form.usage) {
        const usage=document.createElement('p');
        usage.textContent=`Usage estimate: ${model.form.usage.workload.toFixed(1)} ${model.form.usage.key==='rec'?'receptions':model.form.usage.key} × ${model.form.usage.efficiency.toFixed(1)} yards each (${model.form.usage.games} paired games).`;
        card.append(usage);
        if(model.form.usage.dampened){const note=document.createElement('p');note.textContent=`Efficiency outlier adjustment: ${model.form.usage.dampened} unusually high game(s) reduced in the estimate. Actual historical stats are unchanged. This rule has not been calibrated to betting outcomes.`;card.append(note);}
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
      card.append(heading, context);
      if(model.form.coverage.dnp){const note=document.createElement('p');note.textContent=`${model.form.coverage.dnp} verified DNP game(s) excluded from averages, medians and Above/Below percentages; ${model.form.coverage.teamGames} completed team games checked.`;card.append(note);}
      const audit=Unit501PlayerBacktest.validate(history,def.key);
      const historical=document.createElement('p');
      historical.style.cssText='margin:8px 0;opacity:.82';
      historical.textContent=audit.count
        ? `Historical baseline check: ${audit.count} replayed games${audit.count<30?' — limited evidence':''}. Average absolute miss ${audit.mae.toFixed(1)}; bias ${audit.bias>=0?'+':''}${audit.bias.toFixed(1)} (positive means too high). Earlier-game mean miss ${audit.meanMAE.toFixed(1)}.`
        : 'Historical baseline check: not enough eligible earlier games to measure error.';
      historical.textContent+=` Skipped: ${audit.dnp} verified DNP, ${audit.insufficient} insufficient history, ${audit.withheld} withheld, ${audit.missingActual} missing actual stats, ${audit.ambiguous} ambiguous dates. Uses only games starting more than 24 hours earlier. Recorded appearances only; missing stats are not zeros. Excludes matchup, injury and lineup adjustments; no historical betting lines or profit measurement.`;
      card.append(historical);
      const band=Unit501PlayerBacktest.range(history,def.key,selected?.kickoff/1000);
      const uncertainty=document.createElement('p');
      uncertainty.textContent=band.available
        ? `Historical-error range for the unadjusted baseline: ${band.low.toFixed(1)}–${band.high.toFixed(1)} (baseline ${band.baseline.toFixed(1)}, ${band.count} earlier replay errors). Uses the 10th–90th percentiles of earlier errors; future coverage is unvalidated. Actual results can fall outside this range. Excludes matchup, injury and workload adjustments; it is not the range for the adjusted projection above.`
        : `Historical-error range unavailable: ${band.reason}${Number.isFinite(band.count)?' Available replay errors: '+band.count+'.':''}`;
      card.append(uncertainty);
      const rangeAudit=Unit501PlayerBacktest.validateRanges(history,def.key,selected?.kickoff/1000);
      const rangeCheck=document.createElement('p');
      rangeCheck.textContent=rangeAudit.available
        ? `Historical range check: ${rangeAudit.covered}/${rangeAudit.count} later recorded outcomes inside the range (${(rangeAudit.coverage*100).toFixed(0)}%); ${rangeAudit.below} below, ${rangeAudit.above} above. Average range width ${rangeAudit.meanWidth.toFixed(1)}. Each range uses only earlier errors, with the same 24-hour buffer. ${rangeAudit.count<30?'Limited evidence: fewer than 30 evaluated outcomes. ':''}Observed coverage is not a probability for this prop or proof of future accuracy.`
        : `Historical range check unavailable: ${rangeAudit.reason}`;
      card.append(rangeCheck);results.appendChild(card);
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
      const weatherNote=document.createElement('p');weatherNote.textContent=model.weather.reason+` Before weather: ${model.preWeather.toFixed(1)} → ${model.beforeScenario.toFixed(1)} (before manual game-day scenario).`;card.append(weatherNote);
      addLineComparison(card, record, def, adjusted, values);
      shown++;
    }
    if (!shown) {
      const empty=document.createElement('p');empty.textContent='No supported projection available from this player’s recorded stats.';results.append(empty);
    }
    const note = document.createElement('p');
    note.style.opacity = '.8';
    note.textContent = 'Workload blends season and recent form; yardage uses workload × efficiency when at least two paired records exist, blending pooled and median efficiency to limit single-game spikes. Otherwise it uses a conservative season/form yardage fallback that dampens extreme single-game spikes when at least four recorded games exist. Missing statistics remain unknown, never automatically treated as zero. This is an experimental assumption, not a player overall rating; confirmed replacement scenarios adjust transferred workload and team scores when coverage permits. Any workload percentage entered here is additional to the lineup scenario. Confirm current roster, injury status, weather and expected playing time before comparing with a betting line.';
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
    starScenarios.clear();
    roleReviews.clear();
    scenarioControls.replaceChildren();scenarioControls.hidden=true;
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
      status.textContent = 'Compare our projections with FanDuel below. Select a player for individual details.'; return;
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
            id: String(opponent?.id || ''), name: opponent?.name || 'Opponent unknown',
            scored: Number((String(home?.id)===teamIds[i]?g.scores?.home:g.scores?.away)?.total),
            allowed: Number((String(home?.id)===teamIds[i]?g.scores?.away:g.scores?.home)?.total)
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
      Unit501PlayerStats.applyReviewedHistory(map,past,{league,season});
      let reconciled=0;
      for(const [id,g] of past){
        if(task!==sequence)return;
        status.textContent=`Verifying participation: ${ids.indexOf(id)+1} of ${ids.length} season games…`;
        const day=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(g.date*1000));
        try{
          const reports=await json(`/api/football/participation?game=${id}&league=${league}&season=${season}&date=${day}`);
          if(task!==sequence)return;
          if(reports.length===1)reconciled+=Unit501PlayerStats.applyParticipation(map,past,reports[0],{league,season});
        }catch{/* Original unknown games remain withheld if official evidence is unavailable. */}
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
      status.textContent = `${choices.length} players loaded. ${reconciled} player-game records verified against gamebooks or completed box scores. All supported projections are listed below; select a player for a detailed breakdown.`;
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
  document.addEventListener('unit501:weather-updated',()=>{if(loadedFor)showPlayer();});
  el('weatherEnabled')?.addEventListener('change',()=>{if(loadedFor)showPlayer();});
  document.addEventListener('unit501:availability-updated', () => { if (loadedFor) showPlayer(); });
  picker.addEventListener('change', () => {   showPlayer();   scenarioControls.scrollIntoView({     behavior: 'smooth',     block: 'start'   }); });
  reset();
})();
