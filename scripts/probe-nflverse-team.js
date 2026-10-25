'use strict';
const URL='https://github.com/nflverse/nflverse-data/releases/download/stats_team/stats_team_week_2026.csv';
function parseCSV(text){
 const rows=[];let row=[],cell='',quoted=false;
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}
  else if(c===','&&!quoted){row.push(cell);cell='';}
  else if((c==='\n'||c==='\r')&&!quoted){
   if(c==='\r'&&text[i+1]==='\n')i++;
   row.push(cell);cell='';
   if(row.some(x=>x!==''))rows.push(row);
   row=[];
  }else cell+=c;
 }
 if(cell!==''||row.length){row.push(cell);rows.push(row);}
 return rows;
}
(async()=>{
 const r=await fetch(URL,{signal:AbortSignal.timeout(30000),headers:{'User-Agent':'Unit501-Diagnostic-Request'}});
 console.log('NFLVERSE fetch',r.status,r.headers.get('content-length'),r.url.slice(0,110));
 if(!r.ok)throw Error('No nflverse source '+r.status);
 const t=await r.text(),table=parseCSV(t);
 const header=table.shift();
 console.log('NFLVERSE header',JSON.stringify({length:header.length,first:header.slice(0,22),
   focused:header.filter(h=>/yards|game_id|team|season|week|sacks|type/.test(h))}));
 const entries=table.filter(row=>row.length===header.length).map(row=>Object.fromEntries(header.map((h,i)=>[h,row[i]])));
 console.log('NFLVERSE rows',entries.length,'sample',JSON.stringify(entries[0]).slice(0,700));
 const reg=entries.filter(x=>x.season==='2026'&&x.season_type==='REG');
 const clubs=[...new Set(reg.map(x=>x.team))].sort();
 console.log('NFLVERSE reg',reg.length,clubs.length,JSON.stringify(clubs));
 for(const team of ['PIT','NO']){
  const rows=reg.filter(x=>x.team===team);
  const sum=k=>rows.reduce((acc,v)=>acc+Number(v[k]||0),0);
  console.log('NFLVERSE team',team,JSON.stringify({count:rows.length,weeks:rows.map(x=>x.week),
   rush:sum('rushing_yards'),passingGross:sum('passing_yards'),sackYardsLost:sum('sack_yards_lost'),
   net1:sum('passing_yards')+sum('sack_yards_lost'),net2:sum('passing_yards')-sum('sack_yards_lost'),
   each:rows.map(x=>({week:x.week,vs:x.opponent_team,game:x.game_id,pass:x.passing_yards,rush:x.rushing_yards,sackYardsLost:x.sack_yards_lost}))}));
 }
})().catch(e=>{console.log('NFLVERSE ERROR',e.message);process.exitCode=1});
