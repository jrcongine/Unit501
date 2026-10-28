'use strict';
const clean=s=>String(s||'').toLowerCase().replace(/\s+/g,' ').trim();
const eastern=at=>Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(at)).map(p=>[p.type,p.value]));
const dateKey=p=>`${p.year}-${p.month}-${p.day}`;
// Covers labels omit the year. Resolve only a dated, timed label near the
// source check, and verify its weekday. Never use an undated publication age.
function coversEvent(p,source){
 if(source.source!=='covers'||!Number.isFinite(Date.parse(source.checkedAt)))return null;
 const m=String(p.eventLabel||'').match(/,\s*(Sun|Mon|Tue|Wed|Thu|Fri|Sat),\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})\s*[•·]\s*(\d{1,2})(?::(\d{2}))?\s*(AM|PM)\s+ET\s*$/i);
 if(!m||+m[4]<1||+m[4]>12||+(m[5]||0)>59)return null;
 const checked=eastern(Date.parse(source.checkedAt));
 const anchor=Date.UTC(+checked.year,+checked.month-1,+checked.day);
 const month=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(m[2].toLowerCase());
 const dates=[+checked.year-1,+checked.year,+checked.year+1].map(y=>new Date(Date.UTC(y,month,+m[3]))).filter(d=>
  d.getUTCMonth()===month&&d.getUTCDate()===+m[3]&&Math.abs(d.getTime()-anchor)<=7*86400000&&
  ['sun','mon','tue','wed','thu','fri','sat'][d.getUTCDay()]===m[1].toLowerCase());
 if(dates.length!==1)return null;
 return {date:dates[0].toISOString().slice(0,10),time:String(+m[4]%12+(m[6].toLowerCase()==='pm'?12:0)).padStart(2,'0')+':'+(m[5]||'00')};
}
function eventIdentity(p,source){
 if(p.eventAt&&Number.isFinite(Date.parse(p.eventAt))){const e=eastern(Date.parse(p.eventAt));if(p.eventDate&&p.eventDate!==dateKey(e))return null;return {date:dateKey(e),time:e.hour+':'+e.minute};}
 const label=coversEvent(p,source);
 if(label){if(p.eventDate&&p.eventDate!==label.date)return null;return label;}
 return /^\d{4}-\d{2}-\d{2}$/.test(p.eventDate||'')?{date:p.eventDate,time:null}:null;
}
// Explicit aliases from the reported example. Unreviewed team aliases stay
// separate; no fuzzy player/team matching or cross-league alias substitution.
const mlbTeams=new Map([
 ['mil','milwaukee brewers'],['milwaukee brewers','milwaukee brewers'],
 ['tb','tampa bay rays'],['tampa bay rays','tampa bay rays']
]);
function pitcherOuts(p){
 if(p.league!=='mlb')return null;
 const raw=clean(p.pick).replace(/\s*\((?:[+-]\d{3,4}|\d+(?:\.\d+)?%)\)/g,'')
  .replace(/\s+(?:away|home) listed pitcher must start$/,'').replace(/\s+[+-]\d{3,4}$/,'').trim();
 const a=raw.match(/^([a-z .’'-]+?)\s+([uo])(\d+(?:\.5)?)\s+outs recorded$/);
 const b=raw.match(/^([a-z .’'-]+?)\s+outs\s+(under|over)\s+(\d+(?:\.5)?)$/);
 if(!a&&!b)return null;
 const player=clean((a||b)[1]),side=a?(a[2]==='u'?'under':'over'):b[2],line=Number((a||b)[3]);
 if(!player||line<=0||line>30)return null;
 const matchup=String(p.matchup||'').replace(/\(\d+\)/g,'').split(':');
 if(matchup.length>2)return null;
 if(matchup[1]&&clean(matchup[1])!==player+' outs')return null;
 const teams=matchup[0].split(/\s+(?:vs\.?|at|@)\s+/i).map(t=>mlbTeams.get(clean(t)));
 if(teams.length!==2||teams.some(t=>!t)||teams[0]===teams[1])return null;
 return {teams:teams.sort(),pick:player+' '+side+' '+line+' outs recorded'};
}
module.exports={eventIdentity,pitcherOuts};
