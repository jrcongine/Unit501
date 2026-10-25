/* Legacy backup only. The Big 12 Board is tracked in chat, not duplicated in the War Room. */
(function () {
  'use strict';
  const core = window.Unit501WarRoomCore;
  const byId = id => document.getElementById(id);
  const panel = byId('war-archive');
  if (!core || !panel) return;
  const entries = core.load(Unit501Storage);
  if (!entries.length) return; // Keep older decisions intact but never show an empty archive.
  panel.hidden = false;
  byId('war-archive-count').textContent = entries.length + ' saved';
  byId('war-export').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify({version:1,exportedAt:new Date().toISOString(),decisions:core.load(Unit501Storage)}, null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'unit501-previous-board.json';
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    byId('war-message').textContent = 'Previous decisions exported. No saved records were removed.';
  });
})();
