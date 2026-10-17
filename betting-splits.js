'use strict';
const {teamMatches}=require('./odds-matching');
const clean=s=>String(s||'').replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/&#(?:\d+|x[\da-f]+);/gi,' ').replace(/\s+/g,' ').trim();
const aliases={'FL Atlantic Owls':'Florida Atlantic','Army Black Nights':'Army','UConn Huskies':'Connecticut'};
const name=s=>aliases[s]||s;
function parse(html,league){
 const rows=[];
 for(const table of html.matchAll(/<table\b[^>]*class="sp-table"[^>]*>([\s\S]*?)<\/table>/g)){
  const header=table[1].match(/<thead>([\s\S]*?)<\/thead>/)?.[1]||'';
  if(!(league==='1'?/NFL -/:/CFB -/).test(clean(header)))continue;
  const date=header.match(/gamedate=(\d{4}-\d{2}-\d{2})/)?.[1];if(!date)continue;
  const entries=[...table[1].matchAll(/<tr class="sp-row">([\s\S]*?)<\/tr>/g)].map(m=>{
   const cells=[...m[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)].map(x=>x[1]);
   return {cells,code:m[1].match(/data-gamecode="([^"]+)"/)?.[1],team:clean(cells[1]?.match(/<a[^>]*>([\s\S]*?)<\/a>/)?.[1])};
  });
  for(let i=0;i+1<entries.length;i+=2){const a=entries[i],h=entries[i+1];if(!a.code||a.code!==h.code||a.cells.length!==11||h.cells.length!==11)continue;
   const pct=x=>{const v=/^(\d+(?:\.\d+)?)%/.exec(clean(x));return v&&Number(v[1])<=100?Number(v[1]):null;};
   const number=x=>{const s=clean(x);return /^[+-]?\d+(?:\.\d+)?$/.test(s)?Number(s):null;};
   const spread={awayLine:number(a.cells[2]),homeLine:number(h.cells[2]),awayMoney:pct(a.cells[3]),homeMoney:pct(h.cells[3]),awayBets:pct(a.cells[4]),homeBets:pct(h.cells[4])};
   const moneyline={awayMoney:pct(a.cells[9]),homeMoney:pct(h.cells[9]),awayBets:pct(a.cells[10]),homeBets:pct(h.cells[10])};
   rows.push({date,away:name(a.team),home:name(h.team),spread,moneyline});
  }
 }
 return rows;
}
function createSplits(now=Date.now,fetchPage=async url=>{const r=await fetch(url,{signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('Source unavailable');return r.text();}){
 const cache=new Map();
 return async q=>{
  const url=`https://data.vsin.com/${q.league==='1'?'nfl':'college-football'}/betting-splits/`;
  const base={gameId:String(q.game),league:q.league,season:q.season,kickoff:q.kickoff,source:'DraftKings via VSiN public preview',url,available:false,sharpVerified:false};
  if(q.kickoff<=now()||q.kickoff>now()+7*86400000)return {...base,message:'Pregame splits unavailable.'};
  try{
   let item=cache.get(url);if(!item||now()-item.at>=300000){item={at:now(),pending:fetchPage(url).then(html=>({rows:parse(html,q.league),fetchedAt:now()}))};cache.set(url,item);item.pending.catch(()=>{if(cache.get(url)===item)cache.delete(url);});}
   const result=await item.pending;
   const date=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(q.kickoff);
   const matches=result.rows.filter(r=>r.date===date&&teamMatches(r.away,q.away,q.league==='2')&&teamMatches(r.home,q.home,q.league==='2'));
   if(matches.length!==1)return {...base,fetchedAt:result.fetchedAt,message:'No free splits for this game. Enter sourced numbers below.'};
   return {...base,...matches[0],available:true,fetchedAt:result.fetchedAt,sourceAt:null,message:'One sportsbook sample. Source update time and bet count not supplied.'};
  }catch{return {...base,message:'Splits feed unavailable. Enter sourced numbers below.'};}
 };
}
module.exports={parse,createSplits};
