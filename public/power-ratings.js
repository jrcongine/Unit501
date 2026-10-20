'use strict';
// Team-strength display model. No extra provider calls and no scoring/prop multiplier.
(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.Unit501PowerRatings=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  const CATEGORIES=[
    {key:'pointsFor',label:'Scoring offense',short:'Score O'},
    {key:'pointsAgainst',label:'Scoring defense',short:'Score D'},
    {key:'passFor',label:'Passing offense',short:'Pass O'},
    {key:'rushFor',label:'Rushing offense',short:'Rush O'},
    {key:'passAgainst',label:'Pass defense',short:'Pass D'},
    {key:'rushAgainst',label:'Run defense',short:'Run D'}
  ];
  const num=x=>typeof x==='number'&&Number.isFinite(x);
  const safeTeam=t=>t&&Number.isInteger(t.games)&&t.games>0&&
    ['pointsFor','pointsAgainst'].every(k=>num(t.metrics?.[k]?.average)&&
      t.metrics[k].average>=0&&t.metrics[k].games===t.games);
  const grade=(rank,pool)=>Number.isInteger(rank)&&rank>=1&&rank<=pool&&pool>1
    ?Math.max(1,Math.min(10,Math.round(1+(pool-rank)*9/(pool-1)))):null;
  function build(data,game){
    const size=String(game?.league)==='1'?32:String(game?.league)==='2'?138:0;
    if(!size||!data||data.before!==game.kickoff||String(data.season)!==String(game.season))
      return {available:false,reason:'Ratings need a matching pregame season snapshot.'};
    if(!data.coverage?.pointsFor?.ranked||!data.coverage?.pointsAgainst?.ranked||
       data.coverage.pointsFor.expected!==size||data.coverage.pointsAgainst.expected!==size)
      return {available:false,reason:'Waiting for complete league scoring coverage.'};
    const teams=(data.teams||[]).filter(t=>t.metrics?.pointsFor?.rank!=null&&
      t.metrics?.pointsFor?.pool===size&&t.metrics?.pointsAgainst?.pool===size);
    if(teams.length!==size||new Set(teams.map(t=>String(t.id))).size!==size||!teams.every(safeTeam))
      return {available:false,reason:'League scoring pool is incomplete; rankings withheld.'};
    const count=teams.reduce((n,t)=>n+t.games,0);
    const baseline=teams.reduce((n,t)=>n+
      ((t.metrics.pointsFor.average+t.metrics.pointsAgainst.average)/2)*t.games,0)/count;
    if(!num(baseline))return {available:false,reason:'Invalid league scoring baseline.'};
    const lookup=new Map(teams.map(t=>[String(t.id),t]));
    const verified=new Map((data.teams||[]).filter(t=>t.opponentScheduleVerified===true).map(t=>[String(t.id),t]));
    const completeOpponent=t=>safeTeam(t)&&t.games>=2;
    function schedule(team){
      let offense=0,defense=0,covered=0;
      if(!Array.isArray(team.opponents)||team.opponents.length!==team.games)
        return {available:false,covered:0,total:team.games,offense:0,defense:0};
      for(const past of team.opponents){
        const opponent=lookup.get(String(past.id))||verified.get(String(past.id));
        if(!completeOpponent(opponent)||!num(past.scored)||!num(past.allowed)||
           past.scored<0||past.allowed<0)break;
        const otherFor=opponent.metrics.pointsFor.average*opponent.games-past.allowed;
        const otherAgainst=opponent.metrics.pointsAgainst.average*opponent.games-past.scored;
        if(otherFor < -1e-8||otherAgainst < -1e-8)break;
        offense+=baseline-(Math.max(0,otherAgainst)+4*baseline)/(opponent.games+3);
        defense+=baseline-(Math.max(0,otherFor)+4*baseline)/(opponent.games+3);
        covered++;
      }
      const available=covered===team.games;
      const cap=x=>Math.max(-6,Math.min(6,x));
      return {available,covered,total:team.games,
        offense:available?cap(offense/team.games*.5):0,
        defense:available?cap(defense/team.games*.5):0};
    }
    // Equal treatment: do not mix schedule-adjusted ratings with raw ratings.
    const schedules=teams.map(schedule);
    const scheduleAdjusted=schedules.every(s=>s.available);
    const models=teams.map((team,i)=>{
      const shrink=team.games/(team.games+4);
      const s=schedules[i];
      const offense=(team.metrics.pointsFor.average-baseline+
        (scheduleAdjusted?s.offense:0))*shrink;
      const defense=(baseline-team.metrics.pointsAgainst.average-
        (scheduleAdjusted?s.defense:0))*shrink;
      const grades=CATEGORIES.map(item=>{
        const metric=team.metrics[item.key],coverage=data.coverage?.[item.key];
        const eligible=coverage?.ranked===true&&coverage.expected===size&&
          metric?.games===team.games&&metric.pool===size&&num(metric.average);
        return {key:item.key,label:item.label,short:item.short,
          grade:eligible?grade(metric.rank,size):null,
          rank:eligible?metric.rank:null,average:eligible?metric.average:null};
      });
      const available=grades.filter(g=>g.grade!==null);
      const strengths=available.filter(g=>g.grade>=7).sort((a,b)=>b.grade-a.grade||a.label.localeCompare(b.label)).slice(0,2);
      const weaknesses=available.filter(g=>g.grade<=4).sort((a,b)=>a.grade-b.grade||a.label.localeCompare(b.label)).slice(0,2);
      return {id:String(team.id),name:team.name||'Unknown team',games:team.games,
        rating:Number((offense+defense).toFixed(3)),offense:Number(offense.toFixed(3)),
        defense:Number(defense.toFixed(3)),schedule:s,
        grades,strengths,weaknesses};
    });
    models.sort((a,b)=>b.rating-a.rating||a.name.localeCompare(b.name));
    models.forEach((t,i)=>{t.rank=i+1;t.overallGrade=grade(i+1,size);});
    return {available:true,season:String(data.season),league:String(game.league),
      before:data.before,baseline,expected:size,
      scheduleAdjusted,scheduleCoverage:schedules.filter(s=>s.available).length,
      detailLimited:!!data.detailCoverage?.limited,teams:models};
  }
  return {build,grade,CATEGORIES};
});
