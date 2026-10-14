'use strict';
const {compare}=require('./public/injury-backtest');
if (require.main === module) {
  try {
    const fs = require('node:fs');
    if (!process.argv[2]) throw new Error('Usage: node injury-backtest.js archive.json');
    const archive=JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
    const records=Array.isArray(archive)?archive:archive?.schema===1&&Array.isArray(archive.snapshots)?archive.snapshots.filter(s=>!s.selection).flatMap(s=>s.records||[]):null;
    console.log(JSON.stringify(compare(records), null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = {compare};
