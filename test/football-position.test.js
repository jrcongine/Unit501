'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {normalize,compatible}=require('../public/football-position');
test('shared football position labels preserve specific identities and accept only explicit broad families',()=>{
 for(const [a,b] of [['RCB','CB'],['OT','LT'],['EDG','DE'],['EDGE','DE'],['WR-X','WR'],['DB','CB'],['DB','SS'],['S','FS'],['DL','DT'],['DL','EDGE'],['LB','OLB'],['LB','ILB'],['WLB','OLB'],['MLB','LB']]){
  assert.equal(compatible(a,b),true,a+'/'+b);assert.equal(compatible(b,a),true,b+'/'+a);
 }
 for(const [a,b] of [['CB','S'],['FS','SS'],['DE','DT'],['WR','TE'],['T','G'],['DL','LB'],['QB','RB'],['',''],[null,'CB']])assert.equal(compatible(a,b),false,a+'/'+b);
 assert.equal(normalize(' cb '),'CB');
});
test('browser loads shared position rules before automatic injury scoring',()=>{
 const html=require('node:fs').readFileSync(require('node:path').join(__dirname,'../public/index.html'),'utf8');
 const first=html.indexOf('<script src="football-position.js">'),second=html.indexOf('<script src="auto-injury.js">');
 assert.ok(first>=0&&second>first);
});
