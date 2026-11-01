'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {randomUUID} = require('node:crypto');
const model = require('./public/team-model');
const {reconcileGames, readScore} = require('./football-schedule-integrity');
const {positiveId} = require('./provider-id');
const {seededRandom, metrics} = require('./probability-audit');
const DAY = 86400000;

// Publish complete files only. Multiple refreshes or service instances cannot
// overwrite the first pregame forecast or publish a half-written observation.
function publish(file, value) {
  const temp = file + '.' + randomUUID() + '.tmp';
  try {
    fs.writeFileSync(temp, JSON.stringify(value), {flag:'wx', mode:0o600});
    try { fs.linkSync(temp, file); } catch (error) { if (error.code !== 'EEXIST') throw error; }
  } finally { fs.rmSync(temp, {force:true}); }
}
function createLearning({directory, now=Date.now, engine=model, revision='local'}={}) {
  const upcoming = new Map();
  const key = g => [g.league,g.season,g.id].join('-');
  let cursor='', running=false;
  function records() {
    if (!directory || !fs.existsSync(directory)) return [];
    return fs.readdirSync(directory).filter(f=>/^[12]-\d{4}-\d+\.forecast$/.test(f))
      .map(f=>JSON.parse(fs.readFileSync(path.join(directory,f),'utf8')));
  }
  function observe(slate) {
    if (!directory || !Array.isArray(slate?.response) || slate.errors && Object.keys(slate.errors).length || slate.paging?.total>1) return;
    const current=now();
    for (const [id,g] of upcoming) if(g.kickoff<=current) upcoming.delete(id);
    for (const row of reconcileGames(slate.response)) {
      const {game,league,teams}=row;
      const g={id:positiveId(game?.id),league:String(league?.id),season:String(league?.season),
        kickoff:Number(game?.date?.timestamp)*1000,awayId:String(positiveId((teams?.away||teams?.visitors)?.id)),
        homeId:String(positiveId(teams?.home?.id)),venueName:game?.venue?.name||''};
      if(!g.id||!['1','2'].includes(g.league)||!/^\d{4}$/.test(g.season))continue;
      upcoming.delete(key(g));
      if(!positiveId(g.awayId)||!positiveId(g.homeId)||g.awayId===g.homeId||!Number.isSafeInteger(g.kickoff))continue;
      if(game.status?.short==='NS' && g.kickoff>current && g.kickoff<=current+7*DAY) upcoming.set(key(g),g);
      if(g.kickoff>=current || !['FT','AOT','FINAL'].includes(game.status?.short))continue;
      const base=path.join(directory,key(g));
      if(!fs.existsSync(base+'.forecast')||fs.existsSync(base+'.final'))continue;
      const saved=JSON.parse(fs.readFileSync(base+'.forecast','utf8'));
      if(saved.game.kickoff!==g.kickoff||saved.game.awayId!==g.awayId||saved.game.homeId!==g.homeId||saved.forecastAt>=g.kickoff)continue;
      const away=readScore(row.scores?.away?.total),home=readScore(row.scores?.home?.total);
      if(away!==null&&home!==null)publish(base+'.final',{away,home,observedAt:current});
    }
  }
  function capture(query, data) {
    if(!directory||!data)return;
    const matches=[...upcoming.values()].filter(g=>g.league===query.league&&g.season===query.season&&g.awayId===query.away&&g.homeId===query.home&&g.kickoff===query.before);
    if(matches.length!==1)return;
    const game=matches[0],file=path.join(directory,key(game)+'.forecast');
    if(now()>=game.kickoff||fs.existsSync(file))return;
    const score=engine.project(data,game,{now:now()});
    if(!score.available||![score.away,score.home].every(v=>Number.isFinite(v)&&v>=0))return;
    // Win frequency is independent of spread and total. Never record these
    // simulation thresholds as market quotes or grade them as bets.
    const sim=engine.simulate(score,0,Math.max(1,score.away+score.home),50000,seededRandom(key(game)));
    if(!Number.isFinite(sim.conditional.win))return;
    const forecastAt=now();
    if(forecastAt>=game.kickoff)return;
    fs.mkdirSync(directory,{recursive:true});
    publish(file,{game,forecastAt,revision,modelVersion:score.modelVersion,away:score.away,home:score.home,
      awayWinIfDecided:sim.calibrated.win??sim.conditional.win,simulationTie:sim.tie});
  }
  function summary(){
    const groups=new Map();
    for(const f of records()){
      const id=[f.game.league,f.revision,f.modelVersion].join('/');
      if(!groups.has(id))groups.set(id,{league:f.game.league,revision:f.revision,modelVersion:f.modelVersion,captured:0,graded:0,ties:0,error:0,rows:[]});
      const group=groups.get(id);group.captured++;
      const file=path.join(directory,key(f.game)+'.final');if(!fs.existsSync(file))continue;
      const final=JSON.parse(fs.readFileSync(file,'utf8'));group.graded++;
      group.error+=Math.abs(f.away-final.away)+Math.abs(f.home-final.home);
      if(final.away===final.home)group.ties++;
      else group.rows.push({p:1-f.awayWinIfDecided,y:Number(final.home>final.away)});
    }
    return {configured:Boolean(directory),scope:'Server baseline for opened football matchups',groups:[...groups.values()].map(({rows,error,...g})=>({...g,meanTeamScoreError:g.graded?error/(2*g.graded):null,homeWin:metrics(rows)}))};
  }
  async function refresh(api){
    if(!directory||running)return;
    running=true;
    try{
      const groups=new Map(),current=now();
      for(const {game:g} of records()){
        if(current-g.kickoff<4*3600000||current-g.kickoff>21*DAY||fs.existsSync(path.join(directory,key(g)+'.final')))continue;
        const day=new Date(g.kickoff).toISOString().slice(0,10);
        const url='/games?'+new URLSearchParams({league:g.league,season:g.season,date:day,timezone:'UTC'});
        groups.set(url,true);
      }
      const urls=[...groups.keys()].sort();if(!urls.length)return;
      cursor=urls.find(url=>url>cursor)||urls[0];observe(await api(cursor));
    }finally{running=false;}
  }
  return {observe,capture,summary,refresh};
}
module.exports={createLearning};
