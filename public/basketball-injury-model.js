/* Experimental team-score conditioning on verified historical absence patterns.
   Association only: opponents, other lineup changes and DNP reasons can differ. */
(function(root){
 'use strict';
 const players=typeof module!=='undefined'&&module.exports?require('./nba-player-model'):root.Unit501NBAPlayerModel;
 const key=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'').replace(/^losangeles/,'la');
 const fresh=(at,age,now)=>Number.isFinite(at)&&at<=now&&now-at<=age;
 const round=n=>Math.round(n*10)/10;
 // Retain the player-history adapter's coverage verdict even when a shorter
 // selected window happens to contain enough usable rows.
 function completeParticipation(p,game,now){
  if(p.missing?.length||p.unverified?.length||p.coverage?.missing>0||!Array.isArray(p.results)||!Array.isArray(p.inactive))return false;
  const rows=[...p.results,...p.inactive],ids=new Set();
  for(const r of rows){
   const id=String(r?.gameId??''),at=Date.parse(r?.tipoff);
   if(!/^\d{1,12}$/.test(id)||ids.has(id)||!Number.isFinite(at)||at>=Math.min(now,Date.parse(game.tipoff)))return false;
   ids.add(id);
  }
  return true;
 }
 function apply(base,game,context,history,report,scope,now=Date.now(),college=false){
  const out={...base,injury:{applied:[],withheld:[],away:0,home:0}};
  if(!base?.available)return out;
  const reason=text=>{out.injury.withheld.push(text);return out;};
  if(!game||!Number.isFinite(Date.parse(game.tipoff))||Date.parse(game.tipoff)<=now)return reason('Current pregame injury evidence required.');
  if(![history,report,context].every(x=>x&&String(x.gameId)===String(game.id)&&x.tipoff===game.tipoff)||
    !fresh(history?.checkedAt,1800000,now)||!fresh(context?.checkedAt,1800000,now)||!fresh(college?report?.checkedAt:report?.reportAt,college?900000:7200000,now))return reason('Matching fresh injury and player history required; baseline retained.');
  if(!Array.isArray(history.teams)||history.teams.length!==2||!Array.isArray(report.teams)||report.teams.length!==2)return reason('Team identities incomplete; baseline retained.');
  for(const [i,side] of ['away','home'].entries()){
   const team=context[side],h=history.teams[i],r=report.teams[i],label=game[side];
   const no=text=>out.injury.withheld.push(label+': '+text);
   if(!key(label)||key(team?.name)!==key(label)||key(h?.name)!==key(label)||key(college?r?.team:r?.name)!==key(label)||key(game.away)===key(game.home)||!h.available||r.available!==true||!Array.isArray(h.players)||!Array.isArray(r.players)){no('matched available team reports required.');continue;}
   if([team,h].some(t=>t.id!=null&&game[side+'Id']!=null&&String(t.id)!==String(game[side+'Id']))){no('conflicting team identifiers; baseline retained.');continue;}
   const outs=r.players.filter(p=>/^out$/i.test(String(p.status||'').trim()));
   if(!outs.length){no('no confirmed Out pattern to estimate; an empty report does not prove full health.');continue;}
   if(r.players.some(p=>! /^(out|available|active)$/i.test(String(p.status||'').trim()))){no('conditional or conflicting statuses remain; no team adjustment.');continue;}
   const matched=outs.map(p=>players.matchPlayer(h.players,p.name).player);
   if(matched.some((p,index)=>!p||p.available===false||!players.matchPlayer(r.players,outs[index].name).player)||new Set(matched).size!==matched.length){no('Out player identity or participation history unresolved.');continue;}
   if(matched.some(p=>!completeParticipation(p,game,now))){no('incomplete or conflicting player participation; baseline retained.');continue;}
   const window=team[scope],n=window?.games;
   if(!['season','recent5','recent10'].includes(scope)||!Number.isInteger(n)||n<6||n>10||!Array.isArray(team.recentGames)||team.recentGames.length<n){no('need 6–10 fully matched games in the selected view.');continue;}
   const averageFor=college?window.scored:window.pointsFor,averageAgainst=college?window.allowed:window.pointsAgainst;
   if(![averageFor,averageAgainst].every(v=>Number.isFinite(v)&&v>=0)){no('verified scoring averages required; baseline retained.');continue;}
   const games=team.recentGames.slice(0,n),seen=new Set();let valid=true;
   for(const g of games){const id=String(g.id??g.gameId??''),at=Date.parse(g.tipoff);if(!id||seen.has(id)||!Number.isFinite(at)||at>=Math.min(now,Date.parse(game.tipoff))||(college?g.scored:g.for)===(college?g.allowed:g.against)||![college?g.scored:g.for,college?g.allowed:g.against].every(v=>Number.isFinite(v)&&v>=0))valid=false;seen.add(id);}
   if(!valid){no('team game history incomplete or duplicated.');continue;}
   const absent=[],present=[];
   for(const g of games){
    const states=matched.map(p=>{
     if(!Array.isArray(p.results)||!Array.isArray(p.inactive))return null;
     const same=x=>String(x.gameId)===String(g.id??g.gameId);
     const active=p.results.filter(same),inactive=p.inactive.filter(same);
     if(active.length+inactive.length!==1)return null;
     const x=active[0]||inactive[0];if(Date.parse(x.tipoff)!==Date.parse(g.tipoff))return null;
     if(active.length&&(!Number.isFinite(x.minutes)||x.minutes<=0||x.minutes>75))return null;
     return active.length?'present':'absent';
    });
    if(states.some(x=>x===null)){valid=false;break;}
    if(states.every(x=>x==='absent'))absent.push(g);
    if(states.every(x=>x==='present'))present.push(g);
   }
   if(!valid||absent.length<3||present.length<3){no('need three verified games with all listed Out players absent and three with them playing.');continue;}
   const scored=g=>college?g.scored:g.for,allowed=g=>college?g.allowed:g.against;
   const mean=(list,f)=>list.reduce((sum,g)=>sum+f(g),0)/list.length;
   const allFor=mean(games,scored),allAgainst=mean(games,allowed);
   if(Math.abs(allFor-averageFor)>.15||Math.abs(allAgainst-averageAgainst)>.15){no('selected scoring averages do not reconcile with participation games.');continue;}
   // Both scoring models give each team's offense and opponent defense half weight.
   // Shift from the actual selected baseline, not from a hypothetical healthy team.
   const offense=(mean(absent,scored)-allFor)/2,defense=(mean(absent,allowed)-allAgainst)/2;
   if(Math.abs(offense)>10||Math.abs(defense)>10){no('historical score shift exceeds the 10-point quality guard; estimate withheld.');continue;}
   out.injury[side]+=offense;out.injury[side==='away'?'home':'away']+=defense;
   out.injury.applied.push({team:label,names:outs.map(p=>p.name),absent:absent.length,present:present.length,offense:round(offense),opponent:round(defense)});
  }
  out.away=round(Math.max(0,base.away+out.injury.away));out.home=round(Math.max(0,base.home+out.injury.home));out.total=round(out.away+out.home);out.homeSpread=round(out.away-out.home);
  return out;
 }
 function describe(result){
  const i=result?.injury;if(!i)return '';
  const applied=i.applied.map(p=>p.team+': '+p.names.join(', ')+' Out · '+p.absent+' absent / '+p.present+' played games · team '+(p.offense>=0?'+':'')+p.offense+' / opponent '+(p.opponent>=0?'+':'')+p.opponent+' points.');
  return (applied.length?'Experimental historical absence adjustment. '+applied.join(' ')+' Observed association, not measured injury value; opponents and DNP reasons differ. ':'No supported team injury adjustment. ')+i.withheld.join(' ');
 }
 const api={apply,describe};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.Unit501BasketballInjuryModel=api;
})(typeof window!=='undefined'?window:globalThis);
