'use strict';
// Authenticated loopback checks only. No paid feeds, exposed diagnostics route,
// credential logging, or production-data writes. Failures never stop the app.
const {createHash}=require('node:crypto');
const fs=require('node:fs/promises'),path=require('node:path');
const assets=['app.js','predictions.js','game-center.js','game-center.css','injury-changes.js','buy-the-hook.js','worth-a-look.js','api-usage.js','index.html','sport-layout.js','sport-layout.css','league-pulse.js','outside-picks.js','unit501-shared-ui.js','nba.js','ncaab.js','player-stats.js','football-position.js','auto-injury.js','nba.html','ncaab.html','basketball-injury-model.js','basketball-history-comparison.js','nba-win-calibration.js','nba-player-model.js','nba-markets.js','last-opponent.js','player-controls.js','player-controls.css','star-power.js',
 ...['off','boost','rivalry','early','defense','fatigue'].map(key=>'scenario-art/'+key+'.webp')];
const hash=s=>createHash('sha256').update(s).digest('hex');
const states=new Set(['working','empty','partial','failed','unavailable','loading','stale','unchecked']);
const expectedFeeds=['nfl','ncaaf','nba','ncaab'].flatMap(sport=>
 ['games','odds','props','injuries','context','player-history'].map(kind=>sport+':'+kind));
function feedSnapshot(rows){
 const observations=new Map();
 for(const row of rows){
  if(!expectedFeeds.includes(row?.id))continue;
  // Duplicate observations leave the identity of the current observation ambiguous.
  observations.set(row.id,observations.has(row.id)?null:row);
 }
 return expectedFeeds.map(id=>{
  const row=observations.get(id);
  const valid=states.has(row?.status);
  const sourceTime=valid&&typeof row.sourceAt==='string'?Date.parse(row.sourceAt):NaN;
  return {id,status:valid?row.status:'unchecked',sourceAt:Number.isFinite(sourceTime)?new Date(sourceTime).toISOString():null};
 });
}
async function verify({port,password,commit,fetcher=fetch,readFile=fs.readFile}={}){
 const result={commit:/^[a-f0-9]{40}$/.test(commit||'')?commit:null,assets:[],feeds:[]};
 if(!Number.isInteger(Number(port))||Number(port)<1||Number(port)>65535||typeof password!=='string'||password.length<16)return {...result,status:'skipped'};
 const options={headers:{Authorization:'Basic '+Buffer.from('jr:'+password).toString('base64')},redirect:'error',signal:AbortSignal.timeout(15000)};
 for(const file of assets){
  try{
   const r=await fetcher(`http://127.0.0.1:${Number(port)}/${file}`,options);
   if(!r.ok){result.assets.push({file,status:'http-failed'});continue;}
   const served=Buffer.from(await r.arrayBuffer()),expected=await readFile(path.join(__dirname,'public',file));
   result.assets.push({file,status:hash(served)===hash(expected)?'verified':'mismatch'});
  }catch{result.assets.push({file,status:'unavailable'});}
 }
 try{
  const r=await fetcher(`http://127.0.0.1:${Number(port)}/api/data-health`,options);
  if(!r.ok)throw Error();const data=await r.json();if(!Array.isArray(data.feeds))throw Error();
  result.feeds=feedSnapshot(data.feeds);
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
   if(review.playerProps?.configured&&Array.isArray(review.playerProps.groups)){
    const totals={captured:0,pending:0,unverified:0,win:0,loss:0,push:0,noLean:0,dnp:0};
    for(const group of review.playerProps.groups){
     for(const key of Object.keys(totals)){
      if(!Number.isSafeInteger(group[key])||group[key]<0)throw Error('Invalid prop count');
      totals[key]+=group[key];
     }
    }
    result[sport+'PropReview']=totals;
    result[sport+'PropGrades']=totals.win+totals.loss+totals.push;
   }
   if(review.marketGradesVersion===1 && result[field]==='configured'){
    result[sport+'MarketGrades']=review.groups.reduce((n,g)=>n+['spread','total'].reduce((s,m)=>s+g[m].wins+g[m].losses+g[m].pushes,0),0);
   }
   if(result[field]==='configured')result[sport+'Graded']=review.groups.reduce((sum,g)=>sum+g.graded,0);
  }catch{result[field]='unavailable';}
 }
 result.assetStatus=result.assets.every(a=>a.status==='verified')?'verified':'partial';
 result.savedFeedCoverage=result.feedHealth!=='read'?'unavailable':
  result.feeds.every(f=>f.status==='working'&&f.sourceAt)?'working':'incomplete';
 result.status=result.assetStatus==='verified'&&result.savedFeedCoverage==='working'?'verified':'partial';
 return result;
}
module.exports={verify};
