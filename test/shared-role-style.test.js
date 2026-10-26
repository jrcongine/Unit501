'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const css=fs.readFileSync(path.join(__dirname,'../public/style.css'),'utf8');
const nba=fs.readFileSync(path.join(__dirname,'../public/nba.html'),'utf8');
function contrast(a,b){
 const lum=hex=>{
  const n=hex.replace('#','').match(/.{2}/g).map(v=>parseInt(v,16)/255)
    .map(v=>v<=0.04045?v/12.92:Math.pow((v+0.055)/1.055,2.4));
  return n[0]*0.2126+n[1]*0.7152+n[2]*0.0722;
 };
 const x=lum(a),y=lum(b);
 return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05);
}
test('shared role-highlight rows are light ivory with legible dark text, including Shortlist',()=>{
 const row=css.match(/tbody tr\.prop-role-alert\{background:(#[0-9a-f]{6});color:(#[0-9a-f]{6})\}/);
 assert.ok(row,'expected explicit shared row and foreground colors');
 assert.equal(row[1],'#faf7e3','highlight should be approximately half as yellow as the previous cream');
 assert.ok(contrast(row[1],row[2])>=7,'row text must have enhanced contrast');
 assert.match(css,/tbody tr\.prop-role-alert td,\s*tbody tr\.prop-role-alert td label\{color:#13263a\}/);
 assert.match(css,/tbody tr\.prop-role-alert \.prop-shortlist-label\{color:#13263a;font-weight:850\}/);
 assert.ok(contrast('#faf7e3','#13263a')>=7,'Shortlist label must have enhanced contrast');
});
test('warm alert badges use dark high-contrast text and styles are shared with NBA',()=>{
 const badge=css.match(/\.prop-role-badge\{color:(#[0-9a-f]{6});[^}]*background:(#[0-9a-f]{6});/);
 assert.ok(badge,'expected explicit badge foreground and background');
 assert.ok(contrast(badge[1],badge[2])>=7,'alert badge must be readable');
 assert.match(nba,/<link rel="stylesheet" href="style\.css">/);
});

test('visible prop table separates distinct players but keeps their market rows together',()=>{
 const projections=fs.readFileSync(path.join(__dirname,'../public/predictions.js'),'utf8');
 assert.match(projections,/let previousPlayerId = null;/);
 assert.match(projections,/previousPlayerId !== null && row\.record\.id !== previousPlayerId/);
 assert.match(projections,/tr\.className \+= \(tr\.className \? ' ' : ''\)\+'prop-player-group-start'/);
 assert.match(projections,/if\(row\.role\.active\)tr\.className='prop-role-alert'/);
 assert.match(css,/#saved-line-comparisons tbody tr\.prop-player-group-start > td\{\s*border-top:8px solid #15283d;/);
});
