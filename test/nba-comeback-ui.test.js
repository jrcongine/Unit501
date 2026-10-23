'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../public/nba.html'),'utf8');
const js=fs.readFileSync(path.join(__dirname,'../public/nba-comeback-alerts.js'),'utf8');
const server=fs.readFileSync(path.join(__dirname,'../server.js'),'utf8');
const tracking=fs.readFileSync(path.join(__dirname,'../public/nba-comeback-history-ui.js'),'utf8');
test('NBA page exposes an opt-in 20-point watch with a functional alert script',()=>{
 assert.match(html,/id="nba-comeback-enabled"/);
 assert.match(html,/id="nba-comeback-check"/);
 assert.match(html,/id="nba-comeback-permission"/);
 assert.match(html,/src="nba-comeback-alerts\.js"/);
 assert.match(html,/20\+ points during Q1 or Q2/);
 assert.match(html,/only while this NBA page remains open/);
 assert.match(js,/toggle\.addEventListener\('change',start\)/);
 assert.match(js,/new Notification\(/);
 assert.match(js,/localStorage\.setItem\(SEEN/);
 assert.match(js,/const INTERVAL=120000;/);
});
test('NBA live-score endpoint is separate from existing cached season-game schedule',()=>{
 assert.match(server,/require\('\.\/nba-comeback-watch'\)\.createWatch\(\)/);
 assert.match(server,/u\.pathname==='\/api\/nba\/comeback-watch'/);
 assert.match(server,/nbaComebackWatch\(\)/);
 assert.match(server,/u\.pathname==='\/api\/nba\/games'/);
});
test('observed comeback history records first 20-point trigger and grades NBA finals without inventing odds',()=>{
 assert.match(html,/src="nba-comeback-history\.js"/);
 assert.match(html,/src="nba-comeback-history-ui\.js"/);
 assert.match(html,/id="nba-comeback-grade"/);
 assert.match(html,/id="nba-comeback-records"/);
 assert.match(js,/Unit501ComebackTracker\?\.observe\(a\)/);
 assert.match(tracking,/model\.add\(records,alert,Date\.now\(\),date\)/);
 assert.match(tracking,/model\.applyFinals\(records,data\.games\)/);
 assert.match(tracking,/No completed observations with recorded live prices/);
});
