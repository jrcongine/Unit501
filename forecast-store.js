'use strict';
const fs=require('node:fs'),path=require('node:path');
const {randomUUID}=require('node:crypto');
const {metrics}=require('./probability-audit');
// Publish complete files only. Multiple refreshes or service instances cannot
// overwrite the first pregame forecast or publish a half-written observation.
function publish(file, value) {
  const temp = file + '.' + randomUUID() + '.tmp';
  try {
    fs.writeFileSync(temp, JSON.stringify(value), {flag:'wx', mode:0o600});
    try { fs.linkSync(temp, file); } catch (error) { if (error.code !== 'EEXIST') throw error; }
  } finally { fs.rmSync(temp, {force:true}); }
}
function summarize(directory,records,key,scope){
    const groups=new Map();
    for(const f of records){
      const id=[f.game.league,f.revision,f.modelVersion].join('/');
      if(!groups.has(id))groups.set(id,{league:f.game.league,revision:f.revision,modelVersion:f.modelVersion,captured:0,graded:0,ties:0,error:0,rows:[]});
      const group=groups.get(id);group.captured++;
      const file=path.join(directory,key(f.game)+'.final');if(!fs.existsSync(file))continue;
      const final=JSON.parse(fs.readFileSync(file,'utf8'));group.graded++;
      group.error+=Math.abs(f.away-final.away)+Math.abs(f.home-final.home);
      if(final.away===final.home)group.ties++;
      else if(Number.isFinite(f.awayWinIfDecided))group.rows.push({p:1-f.awayWinIfDecided,y:Number(final.home>final.away)});
    }
    return {configured:Boolean(directory),scope,groups:[...groups.values()].map(({rows,error,...g})=>({...g,meanTeamScoreError:g.graded?error/(2*g.graded):null,homeWin:metrics(rows)}))};
}
module.exports={publish,summarize};
