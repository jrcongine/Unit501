'use strict';
const fs=require('node:fs'),path=require('node:path');
const {randomUUID}=require('node:crypto');
const {grade}=require('./market-grades');
const {metrics}=require('./probability-audit');
// Publish complete files only. Multiple refreshes or service instances cannot
// overwrite the first pregame forecast or publish a half-written observation.
function publish(file, value) {
  const temp = file + '.' + randomUUID() + '.tmp';
  try {
    fs.writeFileSync(temp, JSON.stringify(value), {flag:'wx', mode:0o600});
    try { fs.linkSync(temp, file); return true; } catch (error) { if (error.code !== 'EEXIST') throw error; return false; }
  } finally { fs.rmSync(temp, {force:true}); }
}
function saveForecast(file,value,marketRecorder){
  if(!publish(file,value)||!marketRecorder)return;
  marketRecorder.forecast(value,(market,snapshot)=>publish(file+'.'+market,snapshot));
}
function counts(){return {wins:0,losses:0,pushes:0,noLean:0,noQuote:0};}
function summarize(directory,records,key,scope){
    const groups=new Map();
    for(const f of records){
      const id=[f.game.league,f.revision,f.modelVersion].join('/');
      if(!groups.has(id))groups.set(id,{league:f.game.league,revision:f.revision,modelVersion:f.modelVersion,captured:0,graded:0,ties:0,error:0,rows:[],spread:counts(),total:counts()});
      const group=groups.get(id);group.captured++;
      const file=path.join(directory,key(f.game)+'.final');if(!fs.existsSync(file))continue;
      const final=JSON.parse(fs.readFileSync(file,'utf8'));group.graded++;
      for(const market of ['spread','total']){
        const quoteFile=path.join(directory,key(f.game)+'.forecast.'+market);
        if(!fs.existsSync(quoteFile)){group[market].noQuote++;continue;}
        const quote=JSON.parse(fs.readFileSync(quoteFile,'utf8'));
        group[market][grade(market,quote,final)]++;
      }
      group.error+=Math.abs(f.away-final.away)+Math.abs(f.home-final.home);
      if(final.away===final.home)group.ties++;
      else if(Number.isFinite(f.awayWinIfDecided))group.rows.push({p:1-f.awayWinIfDecided,y:Number(final.home>final.away)});
    }
    return {marketGradesVersion:1,configured:Boolean(directory),scope,groups:[...groups.values()].map(({rows,error,...g})=>({...g,meanTeamScoreError:g.graded?error/(2*g.graded):null,homeWin:metrics(rows)}))};
}
module.exports={publish,summarize,saveForecast};
