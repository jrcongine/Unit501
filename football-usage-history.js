'use strict';
const fs = require('node:fs');
const path = require('node:path');

// Each reserved outbound attempt appends exactly one byte. Writers sharing the
// volume can append without overwriting another process's daily total.
function createUsageHistory(directory) {
  if (!directory) return null;
  function record(date) {
    fs.mkdirSync(directory, {recursive: true});
    fs.appendFileSync(path.join(directory, date + '.count'), '.', {mode: 0o600});
  }
  function recent() {
    let names;
    try { names = fs.readdirSync(directory); }
    catch (error) { if (error.code === 'ENOENT') return []; throw error; }
    return names.filter(name => /^\d{4}-\d{2}-\d{2}\.count$/.test(name))
      .sort().reverse().slice(0, 14).map(name => ({
        dateUTC: name.slice(0, 10),
        attempts: fs.statSync(path.join(directory, name)).size
      }));
  }
  return {record, recent};
}
module.exports = {createUsageHistory};
