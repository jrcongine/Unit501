'use strict';
const {localEpoch}=require('./college-availability');
// Public GETs used by the conferences' published men's basketball widgets.
// Both widgets store tipoff in Central time (Big Ten displays it in Eastern).
const feeds={'Big Ten':'https://par.hdintelligence-app.com/api/53PV8lI$h8!0mbb','Big 12':'https://par.hdintelligence-app.com/api/53PV8lI$h8!2mbb'};
const key=s=>String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const epoch=(date,time)=>localEpoch(date,/^\d{1,2}:\d{2}$/.test(time)?time+':00':time,'CT');
function match(payload,conf,game,competitors,now){
 const tip=Date.parse(game.tipoff);if(!Number.isFinite(tip)||now>tip||tip-now>7*86400000)return [];
 const aliases=[game.awayId,game.homeId].map(id=>{const t=competitors.find(c=>String(c.id)===id)?.team;return [t?.location,t?.displayName].map(key).filter(Boolean);});
 const reports=[];for(const r of Object.values(payload||{})){
 if(epoch(r?.footer?.date,r?.footer?.time)!==tip||!Array.isArray(r.games)||r.games.length!==2)continue;
 const sides=aliases.map(names=>r.games.filter(t=>names.includes(key(t?.teamName))));
 if(sides.some(rows=>rows.length!==1)||sides[0][0]===sides[1][0])continue;
 const stamp=epoch(r.publishDate,r.postedTime);
 if(conf==='Big 12'&&!['Initial Report','Gameday Report'].includes(r.ReportType)||r.ReportType==='Report Pending')continue;
 if(Number.isFinite(stamp)?stamp>now||tip-stamp>7*86400000:conf==='Big 12'||tip-now>3*3600000||r.publishDate||r.postedTime)continue;
 const teams=sides.map(([t])=>{
 if(!Array.isArray(t.rows)||!t.rows.length)return null;
 const players=[];for(const row of t.rows){
 const status=row?.exempt_status==='Out'?'Out':row?.status;
 if(!['Out','Out - (1st Half)','Doubtful','Game Time Decision','Probable','Questionable','Available'].includes(status))return null;
 const name=/^(?:[A-Z]{1,4}\s+)?#?\d+\s+(.+)$/.exec(String(row.name||'').trim())?.[1];if(!name||players.some(p=>key(p.name)===key(name)))return null;
 players.push({name,status,detail:conf+' conference report',date:Number.isFinite(stamp)?new Date(stamp).toISOString():null});}
 return players;});
 reports.push({conf,stamp:Number.isFinite(stamp)?stamp:0,teams});}
 return reports;
}
function createReports(fetcher=fetch,now=Date.now){
 const cache=new Map();
 function read(conf){const last=cache.get(conf);if(last&&now()-last.at<300000)return last.pending;
 const pending=(async()=>{const r=await fetcher(feeds[conf],{signal:AbortSignal.timeout(5000),redirect:'error'});if(!r.ok)throw Error();return r.json();})();
 cache.set(conf,{at:now(),pending});return pending;}
 return async(game,competitors,baseline)=>{const groups=await Promise.all(Object.keys(feeds).map(async conf=>{try{return match(await read(conf),conf,game,competitors,now());}catch{return [];}}));
 const sorted=groups.flat().sort((a,b)=>b.stamp-a.stamp);const best=sorted[0];
 if(!best||sorted.some((r,i)=>i&&(r.conf!==best.conf||r.stamp===best.stamp)))return baseline;
 return baseline.map((team,i)=>{const rows=best.teams[i];if(!rows)return team;
 const list=[...rows];let conflict=false;for(const p of team.players){const found=rows.find(r=>key(r.name)===key(p.name));if(!found)list.push(p);else if(key(found.status)!==key(p.status)){conflict=true;list[list.indexOf(found)]={...found,status:'Unverified'};}}
 return {...team,available:!conflict,players:list,source:best.conf+' conference report',message:conflict?'Conference and ESPN statuses disagree; availability is unverified.':best.conf+' report matched to both teams and tipoff; unlisted players are not confirmed healthy.'};});};
}
module.exports={match,createReports};
