'use strict';
const {fbsName}=require('./team-identity');
const {nameKey}=require('./nba-official-history');
const SPORTS={MFB:{path:'football/fbs',division:11,box:'NCAA_GetGamecenterBoxscoreFootballById_web'},MBB:{path:'basketball-men/d1',division:1,box:'NCAA_GetGamecenterBoxscoreBasketballById_web'}};
const number=v=>typeof v==='number'&&Number.isInteger(v)?v:typeof v==='string'&&/^-?\d+$/.test(v)?Number(v):null;
function settings(html){const matches=[...html.matchAll(/<script\b[^>]*\bdata-drupal-selector="drupal-settings-json"[^>]*>([\s\S]*?)<\/script>/g)];if(matches.length!==1)throw Error('NCAA settings unavailable');return JSON.parse(matches[0][1]);}
function sameTeam(t,expected,scope){if(!nameKey(t?.nameShort))return false;if(scope.sport==='MFB'){const a=fbsName({name:t.nameShort},String(scope.season)),b=fbsName({name:expected.name},String(scope.season));return !!a&&a===b;}return (expected.aliases||[expected.name]).some(n=>nameKey(n)===nameKey(t.nameShort));}
function match(g,e){return g?.gameState==='F'&&g.hasStartTime===true&&Math.abs(Number(g.startTimeEpoch)*1000-Date.parse(e.tipoff))<=15*60000&&Array.isArray(g.teams)&&g.teams.length===2&&e.teams.every(t=>{const rows=g.teams.filter(x=>x.isHome===(t.side==='home'));return rows.length===1&&number(rows[0].score)===t.score&&sameTeam(rows[0],t,e);});}
function identity(main,box,e,id){const entries=main.data?.contests,g=entries?.[0];if(main.errors||box.errors||entries?.length!==1||String(g?.id)!==String(id)||g.seasonYear!==(e.sport==='MBB'?e.season-1:e.season)||g.sportCode!==e.sport||g.division!==SPORTS[e.sport].division||!match(g,e)||(e.stage===2&&(g.isChampionship||g.isConferenceTournament)))throw Error('NCAA game identity unverified');const b=box.data?.boxscore;
 if(String(b?.contestId)!==String(id)||b.status!=='F'||b.sportCode!==e.sport||b.division!==SPORTS[e.sport].division||b.teams?.length!==2||b.teamBoxscore?.length!==2||!g.teams.every(t=>b.teams.some(x=>String(x.teamId)===String(t.teamId)&&x.isHome===t.isHome&&nameKey(x.nameShort)===nameKey(t.nameShort))))throw Error('NCAA box identity unverified');return {game:g,box:b};}
const footballFields={passing:{total:'TeamPassingStats',fields:{passingAttempts:'attempts',passingYards:'passYds',passingTDs:'passTD'}},rushing:{total:'TeamRushingStats',fields:{rushingAttempts:'carries',rushingYards:'rushYds',rushingTDs:'rushTD'}},receiving:{total:'TeamReceivingStats',fields:{receivingReceptions:'rec',receivingYards:'recYds',receivingTDs:'recTD'}}};
function football(main,box,e,id){const verified=identity(main,box,e,id),teams=[];
 for(const expected of e.teams){const team=verified.game.teams.find(t=>t.isHome===(expected.side==='home')),list=verified.box.teamBoxscore.filter(t=>String(t.teamId)===String(team.teamId));if(list.length!==1||!Array.isArray(list[0].playerStats)||list[0].playerStats.length>500)throw Error('NCAA football rows unavailable');
  const rows=list[0].playerStats,players=new Map(),seen=new Set();
  for(const r of rows){const name=[r.firstName,r.lastName].filter(Boolean).join(' ').trim(),key=nameKey(name),slot=key+':'+r.category;if(!key||seen.has(slot))throw Error('NCAA football player ambiguous');seen.add(slot);
   // A nonzero recorded event establishes an appearance, not an absent table row.
   const evidence=Object.entries(r).some(([k,v])=>!['firstName','lastName','number','position','__typename','category'].includes(k)&&typeof v==='string'&&/^-?\d+(?:\.\d+)?$/.test(v)&&Number(v)!==0);
   if(evidence&&!players.has(key))players.set(key,{name,participation:'played',markets:[]});
  }
  for(const [category,spec]of Object.entries(footballFields))for(const [field,market]of Object.entries(spec.fields)){
   const categoryRows=rows.filter(r=>r.category===category),total=number(list[0].teamStats?.[spec.total]?.[field]),values=categoryRows.map(r=>number(r[field]));
   if(total===null||values.some(n=>n===null||!market.endsWith('Yds')&&n<0)||values.reduce((a,b)=>a+b,0)!==total)continue;
   for(const [key,p]of players){const i=categoryRows.findIndex(r=>nameKey([r.firstName,r.lastName].filter(Boolean).join(' '))===key);p[market]=i<0?0:values[i];p.markets.push(market);}
  }
  teams.push({id:String(expected.id),name:expected.name,scored:expected.score,allowed:e.teams.find(t=>t.side!==expected.side).score,players:[...players.values()]});
 }
 return {available:true,gameId:String(e.id),gameDate:Date.parse(e.tipoff)/1000,league:'2',season:String(e.season),nameFormat:'full',source:'https://www.ncaa.com/game/'+id,teams};
}
function basketball(main,box,e,id){const verified=identity(main,box,e,id),teams=[];
 for(const expected of e.teams){const team=verified.game.teams.find(t=>t.isHome===(expected.side==='home')),list=verified.box.teamBoxscore.filter(t=>String(t.teamId)===String(team.teamId));if(list.length!==1||!Array.isArray(list[0].playerStats)||list[0].playerStats.length<5||list[0].playerStats.length>30)throw Error('NCAA basketball rows unavailable');
  const rows=list[0].playerStats,players=[],seen=new Set(),fields={player_points:'points',player_rebounds:'totalRebounds',player_assists:'assists',player_threes:'threePointsMade'};
  for(const r of rows){const name=[r.firstName,r.lastName].filter(Boolean).join(' '),key=nameKey(name),min=/^\d+(?:\.\d+)?$/.test(String(r.minutesPlayed??''))?Number(r.minutesPlayed):null;if(!key||seen.has(key)||min===null||min<0||min>75||Object.values(fields).some(k=>number(r[k])===null||number(r[k])<0))throw Error('NCAA basketball player invalid');seen.add(key);
   const evidence=min>0||['fieldGoalsAttempted','freeThrowsAttempted','threePointsAttempted','totalRebounds','assists','turnovers','personalFouls','steals','blockedShots','points'].some(k=>number(r[k])>0);
   players.push({name,participation:evidence?'played':'unknown',minutes:min,values:Object.fromEntries(Object.entries(fields).map(([market,k])=>[market,number(r[k])]))});
  }
  for(const [market,k]of Object.entries(fields)){const total=number(list[0].teamStats?.[k]),sum=players.reduce((n,p)=>n+p.values[market],0);if(total===null||(market==='player_rebounds'?sum>total:sum!==total))throw Error('NCAA basketball totals do not reconcile');}
  if(number(list[0].teamStats.points)!==expected.score)throw Error('NCAA basketball score mismatch');
  teams.push({id:String(expected.id),players});
 }
 return {available:true,gameId:String(e.id),tipoff:e.tipoff,season:e.season,stage:e.stage,source:'https://www.ncaa.com/game/'+id,teams};
}
function basketballScope(data){const h=data?.header,c=h?.competitions?.length===1?h.competitions[0]:null;if(!c||c.status?.type?.completed!==true||c.competitors?.length!==2||!Number.isInteger(h.season?.year))throw Error('College basketball identity unavailable');
 return {id:String(h.id),sport:'MBB',season:h.season.year,stage:h.season.type,tipoff:c.date,teams:c.competitors.map(t=>({id:String(t.id),side:t.homeAway,name:t.team?.displayName,score:number(t.score),aliases:[t.team?.location,t.team?.shortDisplayName,t.team?.displayName].filter(Boolean)}))};
}
function createNCAA({fetcher=fetch,now=Date.now}={}){const cache=new Map();
 async function read(url,json=false){let old=cache.get(url);if(old&&now()-old.at<6*3600000)return old.pending;const entry={at:now(),pending:(async()=>{const r=await fetcher(url,{signal:AbortSignal.timeout(12000),redirect:'error'});if(!r.ok||Number(r.headers?.get?.('content-length')||0)>5000000)throw Error('NCAA source unavailable');const text=await r.text();if(text.length>5000000)throw Error('NCAA source too large');return json?JSON.parse(text):text;})()};cache.set(url,entry);entry.pending.catch(()=>{if(cache.get(url)===entry)cache.delete(url)});if(cache.size>250)cache.delete(cache.keys().next().value);return entry.pending;}
 function query(name,sha,variables){if(!/^[a-f0-9]{64}$/.test(sha||''))throw Error('NCAA query unavailable');return read('https://sdataprod.ncaa.com?'+new URLSearchParams({meta:name,extensions:JSON.stringify({persistedQuery:{version:1,sha256Hash:sha}}),variables:JSON.stringify(variables)}),true);}
 return async e=>{try{const sport=SPORTS[e.sport];if(!sport||!Number.isInteger(e.season)||e.teams?.length!==2||!['away','home'].every(side=>e.teams.filter(t=>t.side===side).length===1)||e.teams.some(t=>!Number.isInteger(t.score)||t.score<0)||!Number.isFinite(Date.parse(e.tipoff))||Date.parse(e.tipoff)>=now())throw Error('NCAA historical scope required');
  const cfg=settings(await read('https://www.ncaa.com/scoreboard/'+sport.path)),url=new URL(cfg.scoreboard?.contestsDataUrl);if(url.origin!=='https://sdataprod.ncaa.com'||url.searchParams.get('meta')!=='GetContests_web')throw Error('NCAA index unverified');
  const sha=JSON.parse(url.searchParams.get('extensions')).persistedQuery.sha256Hash,date=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(e.tipoff));
  const slate=await query('GetContests_web',sha,{sportCode:e.sport,division:sport.division,seasonYear:e.sport==='MBB'?e.season-1:e.season,contestDate:date,week:null});if(slate.errors||!Array.isArray(slate.data?.contests)||slate.data.contests.length>1000)throw Error('NCAA calendar unavailable');
  const matches=slate.data.contests.filter(g=>match(g,e));if(matches.length!==1||!/^\d{1,12}$/.test(String(matches[0].contestId)))throw Error('NCAA matchup ambiguous');const id=matches[0].contestId;
  const gc=settings(await read('https://www.ncaa.com/game/'+id)).gamecenter;if(gc?.basePath!=='/game/'+id)throw Error('NCAA page mismatch');
  const [main,box]=await Promise.all([query('GetGamecenterGameById_web',gc.gqlShas?.GetGamecenterGameById_web,{id,week:null,staticTestEnv:null}),query(sport.box,gc.gqlShas?.[sport.box],{contestId:id,staticTestEnv:null})]);
  return {...(e.sport==='MFB'?football:basketball)(main,box,e,id),checkedAt:now()};
 }catch{return {available:false};}};
}
module.exports={SPORTS,settings,match,identity,football,basketball,basketballScope,createNCAA};
