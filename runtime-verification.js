'use strict';
// Authenticated loopback checks only. No paid feeds, exposed diagnostics route,
// credential logging, or production-data writes. Failures never stop the app.
const {createHash}=require('node:crypto');
const fs=require('node:fs/promises'),path=require('node:path');
const assets=['injury-changes.js','buy-the-hook.js','worth-a-look.js','api-usage.js','index.html','sport-layout.js','sport-layout.css','league-pulse.js','outside-picks.js','unit501-shared-ui.js','nba.js','ncaab.js','player-stats.js','football-position.js','auto-injury.js','nba.html','ncaab.html','basketball-injury-model.js','basketball-history-comparison.js','nba-win-calibration.js','nba-player-model.js','nba-markets.js','last-opponent.js'];
const hash=s=>createHash('sha256').update(s).digest('hex');
const states=new Set(['working','empty','partial','failed','unavailable','loading','stale','unchecked']);
async function verify({port,password,commit,fetcher=fetch,readFile=fs.readFile}={}){
 const result={commit:/^[a-f0-9]{40}$/.test(commit||'')?commit:null,assets:[],feeds:[]};
 if(!Number.isInteger(Number(port))||Number(port)<1||Number(port)>65535||typeof password!=='string'||password.length<16)return {...result,status:'skipped'};
 const options={headers:{Authorization:'Basic '+Buffer.from('jr:'+password).toString('base64')},redirect:'error',signal:AbortSignal.timeout(15000)};
 for(const file of assets){
  try{
   const r=await fetcher(`http://127.0.0.1:${Number(port)}/${file}`,options);
   if(!r.ok){result.assets.push({file,status:'http-failed'});continue;}
   const served=await r.text(),expected=await readFile(path.join(__dirname,'public',file),'utf8');
   result.assets.push({file,status:hash(served)===hash(expected)?'verified':'mismatch'});
  }catch{result.assets.push({file,status:'unavailable'});}
 }
 try{
  const r=await fetcher(`http://127.0.0.1:${Number(port)}/api/data-health`,options);
  if(!r.ok)throw Error();const data=await r.json();if(!Array.isArray(data.feeds))throw Error();
  result.feeds=data.feeds.filter(f=>/^(nfl|ncaaf|nba|ncaab):(injuries|props|context|player-history)$/.test(f?.id)&&states.has(f.status)).map(f=>({id:f.id,status:f.status}));
  result.feedHealth='read';
  result.footballUsageHistory=Array.isArray(data.footballUsage?.recentDays)?'read':'unavailable';
 }catch{result.feedHealth='unavailable';}
 for(const sport of ['football','basketball']){
  const field=sport+'Learning';
  try{
   const response=await fetcher('http://127.0.0.1:'+Number(port)+'/api/'+sport+'/model-review',options);
   if(!response.ok)throw Error();
   const review=await response.json();
   result[field]=review.configured===true && Array.isArray(review.groups)?'configured':'unconfigured';
   if(result[field]==='configured')result[sport+'Graded']=review.groups.reduce((sum,g)=>sum+g.graded,0);
  }catch{result[field]='unavailable';}
 }
 result.status=result.assets.every(a=>a.status==='verified')&&result.feedHealth==='read'?'verified':'partial';
 return result;
}
module.exports={verify};
