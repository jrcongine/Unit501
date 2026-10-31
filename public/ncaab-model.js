(function(root){
 'use strict';
 const incomplete=s=>s?.available===false||s?.conflicts>0||s?.unverifiedGames>0||s?.coverage?.conflictingGames>0||s?.coverage?.unverifiedGames>0||s?.coverage?.invalid>0;
 const round=n=>Math.round(n*10)/10;
 function project(game,data,scope='season',now=Date.now()){
  const no=reason=>({available:false,reason});
  if(!game||game.status!=='Scheduled'||!game.timeKnown||!Number.isFinite(Date.parse(game.tipoff))||Date.parse(game.tipoff)<=now)return no('Pregame estimate needs a confirmed future tipoff.');
  if(!data||data.gameId!==game.id||data.tipoff!==game.tipoff||data.away?.id!==game.awayId||data.home?.id!==game.homeId)return no('Team history does not match this game.');
  if(!['season','recent5','recent10'].includes(scope))return no('Choose a supported form window.');
  if([data.away,data.home].some(incomplete))return no('Missing or conflicting team results; estimate withheld.');
  const a=data.away[scope],h=data.home[scope];
  if(!a||!h||![a.games,h.games].every(n=>Number.isInteger(n)&&n>=3)||![a.scored,a.allowed,h.scored,h.allowed].every(n=>Number.isFinite(n)&&n>0))return no('Need three completed games for each team.');
  const away=round((a.scored+h.allowed)/2),home=round((h.scored+a.allowed)/2),total=round(away+home);
  if(![away,home,total].every(Number.isFinite))return no('Scoring history produced an invalid estimate.');
  return {available:true,away,home,total,awayGames:a.games,homeGames:h.games,scope};
 }
 function simulate(p,data,lines={},runs=10000,random=Math.random){
  if(!p?.available||![p.away,p.home].every(n=>Number.isFinite(n)&&n>=0)||typeof random!=='function'||!Number.isInteger(runs)||runs<1||runs>100000)return {available:false,reason:'Score estimate unavailable.'};
  if([data?.away,data?.home].some(incomplete))return {available:false,reason:'Missing or conflicting team results; simulation withheld.'};
  const histories=[data?.away?.recentGames,data?.home?.recentGames];
  if(histories.some(x=>!Array.isArray(x)||x.length<5||x.length>10||x.some(g=>![g.scored,g.allowed].every(n=>Number.isFinite(n)&&n>=0))))return {available:false,reason:'Need five recent games for each team to simulate.'};
  const samples=histories.map(list=>{const a=list.reduce((s,g)=>s+g.scored,0)/list.length,b=list.reduce((s,g)=>s+g.allowed,0)/list.length;return list.map(g=>({off:g.scored-a,def:g.allowed-b}));});
  let aw=0,hw=0,ties=0,covers=0,over=0,pushSpread=0,pushTotal=0;
  const pick=x=>{const r=random();if(!Number.isFinite(r)||r<0||r>=1)throw Error('Invalid sample');return x[Math.floor(r*x.length)];};
  for(let i=0;i<runs;i++){
   const a=Math.max(0,Math.round(p.away+(pick(samples[0]).off+pick(samples[1]).def)/Math.SQRT2)),h=Math.max(0,Math.round(p.home+(pick(samples[1]).off+pick(samples[0]).def)/Math.SQRT2));
   if(a>h)aw++;else if(h>a)hw++;else ties++;
   if(Number.isFinite(lines.spread)){const x=a+lines.spread-h;if(x>0)covers++;else if(x===0)pushSpread++;}
   if(Number.isFinite(lines.total)&&lines.total>0){const x=a+h-lines.total;if(x>0)over++;else if(x===0)pushTotal++;}
  }
  return {available:true,awayWin:aw/runs,homeWin:hw/runs,tie:ties/runs,awayCover:Number.isFinite(lines.spread)?covers/runs:null,spreadPush:Number.isFinite(lines.spread)?pushSpread/runs:null,over:Number.isFinite(lines.total)&&lines.total>0?over/runs:null,totalPush:Number.isFinite(lines.total)&&lines.total>0?pushTotal/runs:null};
 }
 const api={project,simulate};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.Unit501NCAABModel=api;
})(typeof window!=='undefined'?window:globalThis);
