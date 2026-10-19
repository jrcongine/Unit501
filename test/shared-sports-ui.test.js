'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const shared=require('../public/unit501-shared-ui');

function dom(){
 const children=[];
 class Element{
  constructor(tag){this.tag=tag;this.children=[];this.attrs={};this.handlers={};this.className='';this.textContent='';
   const active=new Set();
   this.classList={
    add:n=>{active.add(n);this.syncClass(active);},
    remove:n=>{active.delete(n);this.syncClass(active);},
    contains:n=>active.has(n)
   };
  }
  syncClass(set){this.className=[...set].join(' ');}
  setAttribute(k,v){this.attrs[k]=String(v);}
  addEventListener(k,fn){this.handlers[k]=fn;}
  append(...nodes){this.children.push(...nodes);}
  querySelectorAll(sel){return this.children.filter(n=>n.className.split(/\s+/).includes(sel.slice(1)));}
 }
 return {doc:{createElement:tag=>new Element(tag)},container:new Element('section')};
}
test('shared cards preserve football and basketball keyboard selection',()=>{
 const {doc,container}=dom();
 let selected='';
 const gameOne=shared.gameCard({doc,container,away:'Chicago Bears',home:'Green Bay Packers',detailText:'Sun 3:25 CT',
  onSelect:()=>{selected='nfl';}});
 const gameTwo=shared.gameCard({doc,container,away:'Chicago Bulls',home:'Milwaukee Bucks',
  detailText:'Wed 7 PM CT',actionLabel:'Open NBA Game Lab →',onSelect:()=>{selected='nba';}});
 container.append(gameOne,gameTwo);
 assert.equal(gameOne.children[0].textContent,'Chicago Bears @ Green Bay Packers');
 assert.equal(gameTwo.children[0].textContent,'Chicago Bulls @ Milwaukee Bucks');
 assert.equal(gameOne.attrs.role,'button');
 assert.equal(gameTwo.attrs['aria-pressed'],'false');
 gameOne.handlers.click();
 assert.equal(selected,'nfl');assert.equal(gameOne.attrs['aria-pressed'],'true');
 let prevented=false;
 gameTwo.handlers.keydown({key:'Enter',preventDefault(){prevented=true;}});
 assert.equal(prevented,true);assert.equal(selected,'nba');
 assert.equal(gameOne.attrs['aria-pressed'],'false');assert.equal(gameTwo.attrs['aria-pressed'],'true');
 assert.equal(gameTwo.children[2].textContent,'Open NBA Game Lab →');
});
test('both sports share Central dates and safely expose unknown tipoffs',()=>{
 assert.equal(shared.dateCentral(new Date('2026-10-20T02:00:00Z')),'2026-10-19');
 assert.match(shared.timeCentral('2026-10-20T23:00:00Z'),/Oct 20/);
 assert.equal(shared.timeCentral('not-a-date'),'Time TBD');
});
test('both sport pages load one shared UI helper; football simulation remains sport-specific',()=>{
 const base=fs.readFileSync(path.join(__dirname,'../public/index.html'),'utf8');
 const nba=fs.readFileSync(path.join(__dirname,'../public/nba.html'),'utf8');
 const football=fs.readFileSync(path.join(__dirname,'../public/app.js'),'utf8');
 const basketball=fs.readFileSync(path.join(__dirname,'../public/nba.js'),'utf8');
 assert.match(base,/<script src="unit501-shared-ui.js"><\/script>\s*<script src="app.js"><\/script>/);
 assert.match(nba,/<script src="unit501-shared-ui.js"><\/script><script src="nba.js"><\/script>/);
 assert.match(football,/Unit501SharedUI\.gameCard/);
 assert.match(basketball,/shared\.gameCard/);
 assert.match(nba,/id="nba-lab"/);
 assert.match(nba,/id="nba-player-lab"/);
 assert.match(nba,/no validated NBA score model yet|NBA model not calibrated/);
 assert.doesNotMatch(basketball,/Unit501TeamModel\.project/);
 assert.doesNotMatch(nba,/<option value="1">NFL<\/option>/);
});
