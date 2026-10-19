'use strict';
// Real network smoke check of the same public-only feed used by the 501 War Room.
// Informational: upstream sites can legitimately have zero picks or block requests.
// Invalid rows fail, but empty/unavailable sources must NEVER be mistaken for picks.
const fs=require('node:fs');
const {createFeed}=require('../outside-picks');

const leagues=['nfl','ncaaf','mlb'];
const SOURCES=['covers','wagertalk','boyds','pickswise'];
const LIMIT=80;
const start=new Date();
const feed=createFeed();
const lines=[
  '# 501 War Room public-feed check',
  '',
  'Checked '+start.toISOString()+' — source sites may change without warning.',
  '',
  '| League | Source | Result | Upcoming readable picks |',
  '| --- | --- | --- | ---: |'
];
let invalid=0,total=0;
(async()=>{
  const all=await Promise.all(leagues.map(async league=>{
    try{return await feed(league);}
    catch(error){return {league,sources:[],error:String(error?.message||error)};}
  }));
  for(const data of all){
    if(data.error){lines.push('| '+data.league+' | Feed error | Unavailable | 0 |');continue;}
    for(const key of SOURCES){
      const s=data.sources?.find(x=>x.source===key);
      if(!s){invalid++;lines.push('| '+data.league+' | '+key+' | Missing source | 0 |');continue;}
      const picks=Array.isArray(s.picks)?s.picks:[];
      total+=picks.length;
      for(const pick of picks){
        const valid=pick&&typeof pick.author==='string'&&pick.author.trim()&&
          typeof pick.pick==='string'&&pick.pick.trim()&&
          typeof pick.url==='string'&&/^https:\/\/(www\.)?/.test(pick.url)&&
          typeof pick.league==='string'&&pick.league===data.league&&
          typeof pick.source==='string'&&pick.source===key;
        if(!valid)invalid++;
      }
      const status=s.status==='available'&&!picks.length?'past/filtered':s.status;
      lines.push('| '+data.league+' | '+s.name+' | '+status+' | '+picks.length+' |');
      console.log(data.league,s.name,status,'readable='+picks.length);
      for(const p of picks.slice(0,2)){
        console.log('  example:',JSON.stringify({author:p.author,pick:p.pick,matchup:p.matchup,event:p.eventLabel}).slice(0,500));
      }
    }
  }
  lines.push('','Total public selections returned: **'+total+'**.');
  if(!total)lines.push('','**No selections loaded.** Investigate source connectivity or changed page structure; do not create placeholder picks.');
  if(invalid)lines.push('','**'+invalid+' invalid record(s) detected.**');
  const summary=lines.join('\n')+'\n';
  console.log(summary);
  if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,summary);
  if(invalid)process.exitCode=1;
})().catch(error=>{
  console.error('War Room smoke check error:',error?.message||error);
  process.exitCode=1;
});
