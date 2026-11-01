'use strict';
const fs=require('node:fs'),path=require('node:path');
const DAY=86400000;
 function summary(directory,files,now,kickoff){
  const groups={};
  for(const n of files){
   const f=JSON.parse(fs.readFileSync(path.join(directory,n),'utf8')),id=[f.league,f.market,f.revision].join('/');
   const g=groups[id]||={league:f.league,market:f.market,revision:f.revision,captured:0,pending:0,unverified:0,win:0,loss:0,push:0,noLean:0,dnp:0};
   g.captured++;const file=path.join(directory,n+'.result');
   if(!fs.existsSync(file))g[now-kickoff(f)>21*DAY?'unverified':'pending']++;else g[JSON.parse(fs.readFileSync(file,'utf8')).outcome]++;
  }
  return {configured:!!directory,groups:Object.values(groups)};
 }
module.exports={summary};
