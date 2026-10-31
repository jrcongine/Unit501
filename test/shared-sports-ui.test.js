'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const shared=require('../public/unit501-shared-ui');

function dom(){
 const children=[];
 class Element{
  constructor(tag){this.tag=tag;this.children=[];this.attrs={};this.handlers={};this.className='';this.textContent='';
   const tokens=()=>new Set(this.className.split(/\s+/).filter(Boolean));
   this.classList={
    add:n=>{const names=tokens();names.add(n);this.syncClass(names);},
    remove:n=>{const names=tokens();names.delete(n);this.syncClass(names);},
    contains:n=>tokens().has(n)
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
 assert.equal(gameOne.children[0].className,'game-title');
 assert.equal(gameTwo.children[0].className,'game-title');
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
 assert.match(nba,/<script src="unit501-shared-ui.js"><\/script><script src="nba-alerts.js"><\/script><script src="nba-model.js"><\/script><script src="nba-player-model.js"><\/script><script src="basketball-injury-model.js"><\/script><script src="nba.js"><\/script>/);
 assert.match(football,/Unit501SharedUI\.gameCard/);
 assert.match(basketball,/shared\.gameCard/);
 assert.match(nba,/id="nba-lab"/);
 assert.match(nba,/id="nba-player-lab"/);
 assert.match(nba,/Experimental score estimate/);
 assert.doesNotMatch(basketball,/Unit501TeamModel\.project/);
 assert.doesNotMatch(nba,/<option value="1">NFL<\/option>/);
});

test('all game cards have white matchup bars with contrasting dark text and clear game details',()=>{
 const css=fs.readFileSync(path.join(__dirname,'../public/style.css'),'utf8');
 const nbaCss=fs.readFileSync(path.join(__dirname,'../public/nba.css'),'utf8');
 assert.match(css,/\.game \.game-title\{[^}]*background:#f7f9fc;color:#152332/);
 assert.match(css,/\.game p\{[^}]*color:var\(--muted\)/);
 assert.match(css,/\.game \.open-game\{[^}]*background:#14374a/);
 assert.match(nbaCss,/\.nba-game \.open-game\{[^}]*top:auto;bottom:12px/);
});

test('game-card records require exact identities and disappear on expiry or failed refresh',()=>{
 const {doc,container}=dom(),now=Date.parse('2026-10-30T20:00Z');
 const card=shared.gameCard({doc,container,away:'Chicago Bulls',home:'Boston Celtics',onSelect(){},seasonRecord:{league:'nba',season:2027,date:'2026-10-30'}});
 container.append(card);const record=card.children[3];
 const report={league:'nba',season:2027,power:{available:true,asOf:new Date(now).toISOString(),teams:[{id:1,name:'Chicago Bulls',record:'4-1'},{id:2,name:'Boston Celtics',record:'2-2'}]}};
 shared.updateGameRecords(report,'nba',now);assert.match(record.textContent,/Chicago Bulls 4-1.*Boston Celtics 2-2/);assert.equal(record.hidden,false);
 shared.updateGameRecords(undefined,undefined,now+3600001);assert.equal(record.hidden,true);assert.equal(record.textContent,'');
 shared.updateGameRecords(report,'nba',now);shared.updateGameRecords(null,'nba',now);assert.equal(record.hidden,true);
 const ambiguous=structuredClone(report);ambiguous.power.teams.push({name:'Chicago Bulls',record:'0-0'});
 shared.updateGameRecords(ambiguous,'nba',now);assert.match(record.textContent,/Chicago Bulls unavailable/);
});

test('matchup headings use supplied provider logos and keep team names when images fail',()=>{
 const {doc}=dom();
 const title=shared.matchupHeading('Bears','Packers','https://a.espncdn.com/i/teamlogos/nfl/500/chi.png','javascript:alert(1)',doc);
 assert.equal(title.children[0].children[0].tag,'img');
 const img=title.children[0].children[0];assert.equal(img.alt,'');assert.equal(img.referrerPolicy,'no-referrer');
 img.handlers.error();assert.equal(img.hidden,true);
 assert.equal(title.children[0].children[1].textContent,'Bears');
 assert.equal(title.children[2].children.length,1);assert.equal(title.children[2].children[0].textContent,'Packers');
 const rejected=shared.matchupHeading('Away','Home','https://espncdn.com.evil.test/logo.png',null,doc);
 assert.equal(rejected.textContent,'Away @ Home');
});
