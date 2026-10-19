/* 501 War Room: manual, auditable board decisions. No automatic pick feeds. */
(function (root) {
  'use strict';
  const KEY = 'unit501:war-room:v1';
  const MEMBERS = ['jr', 'aria', 'unit501'];
  const ADVISERS = ['covers', 'wagertalk', 'sbr', 'ev'];
  const VALID_VOTES = ['for', 'against', 'pending'];
  const VALID_RESULTS = ['pending', 'won', 'lost', 'push', 'void'];
  function decision(votes) {
    const values = MEMBERS.map(member => VALID_VOTES.includes(votes && votes[member]) ? votes[member] : 'pending');
    const yes = values.filter(value => value === 'for').length;
    const no = values.filter(value => value === 'against').length;
    return {yes, no, missing:3 - yes - no, status:yes >= 2 ? 'approved' : no >= 2 ? 'rejected' : 'undecided'};
  }
  function cleanText(value, max) { return String(value || '').trim().slice(0, max); }
  function normalize(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const votes = {};
    for (const m of MEMBERS) votes[m] = VALID_VOTES.includes(raw.votes && raw.votes[m]) ? raw.votes[m] : 'pending';
    const sources = {};
    for (const s of [...ADVISERS, 'juicereel']) sources[s] = cleanText(raw.sources && raw.sources[s], 400); // Preserve archived notes but accept no new Juice Reel entries.
    const result = VALID_RESULTS.includes(raw.result) ? raw.result : 'pending';
    const matchup = cleanText(raw.matchup, 140);
    const pick = cleanText(raw.pick, 180);
    if (!matchup || !pick || !/^\d{4}-\d\d-\d\d$/.test(raw.date || '')) return null;
    return {
      id:cleanText(raw.id, 100) || String(Date.now()),
      date:raw.date,
      matchup, pick, votes, sources,
      notes:cleanText(raw.notes, 600),
      createdAt:cleanText(raw.createdAt, 50) || new Date().toISOString(),
      result
    };
  }
  function load(storage) {
    try {
      const parsed = JSON.parse(storage.getItem(KEY) || '[]');
      return Array.isArray(parsed) ? parsed.slice(0, 250).map(normalize).filter(Boolean) : [];
    } catch { return []; }
  }
  function save(storage, rows) {
    if (!Array.isArray(rows)) return false;
    try {
      storage.setItem(KEY, JSON.stringify(rows.slice(0, 250).map(normalize).filter(Boolean)));
      return true;
    } catch { return false; }
  }
  function summary(rows) {
    const approved = rows.filter(row => decision(row.votes).status === 'approved');
    return {
      logged:rows.length,
      approved:approved.length,
      wins:approved.filter(row => row.result === 'won').length,
      losses:approved.filter(row => row.result === 'lost').length,
      pushes:approved.filter(row => row.result === 'push').length,
      pending:approved.filter(row => row.result === 'pending').length
    };
  }
  const api = {KEY, MEMBERS, ADVISERS, decision, normalize, load, save, summary};
  if (root) root.Unit501WarRoomCore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window === 'undefined' ? null : window);
