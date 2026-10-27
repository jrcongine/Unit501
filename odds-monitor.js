'use strict';
// Only usage headers are observed. Never retain provider URLs, keys or payloads.
let observer = null;
function observe(response) {
  if (!observer) return;
  const raw = response?.headers?.get?.('x-requests-remaining');
  const remaining = typeof raw === 'string' && /^\d+$/.test(raw) ? Number(raw) : null;
  observer({remaining, status: response?.status});
}
module.exports = {observe, setObserver(fn) { observer = fn; }};
