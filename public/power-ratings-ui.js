'use strict';
(function(){
  const $=id=>document.getElementById(id);
  const host=$('power-ratings'),nav=$('quick-power');
  const status=$('power-status'),matchup=$('power-matchup');
  const leaderboard=$('power-leaderboard'),detail=$('power-detail');
  if(!host||!window.Unit501PowerRatings)return;
  const make=(tag,cls,value)=>{
    const e=document.createElement(tag);
    if(cls)e.className=cls;
    if(value!==undefined)e.textContent=String(value);
    return e;
  };
  const signed=value=>(value>0?'+':'')+value.toFixed(1);
  const gradeText=value=>value==null?'—':String(value)+'/10';
  const toggle=enabled=>{
    host.classList.toggle('hidden',!enabled);
    nav.classList.toggle('is-unavailable',!enabled);
    nav.setAttribute('aria-disabled',String(!enabled));
    nav.tabIndex=enabled?0:-1;
    nav.textContent=enabled?'🏆 501 Power Ratings':'🏆 Power ratings · select game';
  };
  function badges(container,items,empty){
    const list=make('ul','power-side-list');
    if(!items.length)list.append(make('li','power-muted',empty));
    for(const item of items)
      list.append(make('li','',item.label+' — '+gradeText(item.grade)));
    container.append(list);
  }
  function notes(container,team){
    const grid=make('div','power-notes');
    const strength=make('aside','power-side');
    strength.append(make('h5','','Strengths'));
    badges(strength,team.strengths,'No verified category graded 7+.');
    const weakness=make('aside','power-side');
    weakness.append(make('h5','','Weaknesses'));
    badges(weakness,team.weaknesses,'No verified category graded 4 or below.');
    grid.append(strength,weakness);container.append(grid);
  }
  function grades(container,team){
    const list=make('div','power-grades');
    for(const entry of team.grades){
      const row=make('div','power-grade');
      row.append(make('span','',entry.label));
      const right=make('strong',entry.grade===null?'power-muted':'',gradeText(entry.grade));
      right.title=entry.grade===null?'Insufficient verified full-league category coverage':
        'League rank '+entry.rank+'; grade is a relative rank, not an absolute talent assessment.';
      row.append(right);list.append(row);
    }
    container.append(list);
  }
  function card(team,side){
    const article=make('article','power-team-card');
    article.append(make('h4','',side+': '+team.name));
    const head=make('div','power-team-head');
    head.append(make('strong','',signed(team.rating)+' pts'));
    head.append(make('span','power-muted','#'+team.rank+' / '+String(current.expected)+' · Overall '+gradeText(team.overallGrade)));
    article.append(head);
    article.append(make('p','power-muted','Offense '+signed(team.offense)+' · Defense '+signed(team.defense)+' · '+team.games+' completed games'));
    grades(article,team);
    notes(article,team);
    return article;
  }
  let current=null, chosen=null;
  function showDetail(team){
    chosen=team.id;detail.replaceChildren();
    if(!team)return;
    detail.append(make('h3','','Team breakdown: '+team.name));
    detail.append(card(team,'Selected team'));
    for(const button of leaderboard.querySelectorAll('button[data-team]'))
      button.setAttribute('aria-pressed',String(button.dataset.team===chosen));
  }
  function render(event){
    const data=event.detail?.data,game=event.detail?.game;
    if(!data||!game)return;
    const model=window.Unit501PowerRatings.build(data,game);
    if(!model.available){
      status.textContent=model.reason;
      toggle(false);return;
    }
    current=model;toggle(true);
    status.textContent=(model.league==='1'?'NFL':'FBS')+' '+model.season+
      ' · all '+model.expected+' teams · pre-kickoff stats only · '+model.baseline.toFixed(1)+
      ' league points per team-game. '+(model.scheduleAdjusted
        ?'Complete opponent histories: schedule corrections included.'
        :'Opponent coverage '+model.scheduleCoverage+'/'+model.expected+
        '; schedule corrections withheld from ALL power ratings to keep comparisons fair.')+
      (model.detailLimited?' Yardage reports are sampled to conserve provider quota; missing grades stay blank.':'');
    const away=model.teams.find(t=>t.id===String(game.awayId));
    const home=model.teams.find(t=>t.id===String(game.homeId));
    matchup.replaceChildren();
    if(away&&home){
      const title=make('h3','','Matchup strength comparison');
      const comparison=make('p','power-muted','Neutral-field rating difference: '+
        (home.rating>away.rating?home.name:away.rating>home.rating?away.name:'Neither team')+
        (home.rating===away.rating?' (even)':' by '+Math.abs(home.rating-away.rating).toFixed(1)+' points')+
        '. Diagnostic only — these team scoring inputs already contribute to Game Lab projections.');
      const grid=make('div','power-matchup');
      grid.append(card(away,'Away'),card(home,'Home'));
      matchup.append(title,comparison,grid);
    }else matchup.append(make('p','power-muted','Both matchup teams must be in the verified league pool.'));
    const table=make('table','power-table');
    const header=make('thead');
    const headings=make('tr');
    for(const label of ['#','Team','Power (pts)','Overall','Score O','Score D']){
      headings.append(make('th','',label));
    }
    header.append(headings);table.append(header);
    const body=make('tbody');
    for(const team of model.teams){
      const row=make('tr',team.id===String(game.awayId)||team.id===String(game.homeId)?'power-current':'');
      row.append(make('td','',team.rank));
      const name=make('td');
      const button=make('button','power-team-button',team.name);
      button.type='button';button.dataset.team=team.id;
      button.setAttribute('aria-label','Show 501 grades for '+team.name);
      button.addEventListener('click',()=>showDetail(team));
      name.append(button);row.append(name);
      row.append(make('td','power-number',signed(team.rating)));
      row.append(make('td','',gradeText(team.overallGrade)));
      row.append(make('td','',gradeText(team.grades[0].grade)));
      row.append(make('td','',gradeText(team.grades[1].grade)));
      body.append(row);
    }
    table.append(body);
    leaderboard.replaceChildren(table);
    showDetail(model.teams.find(t=>t.id===chosen)||away||model.teams[0]);
  }
  function reset(){
    current=null;chosen=null;
    status.textContent='Select a matchup to calculate the pregame leaderboard.';
    matchup.replaceChildren();leaderboard.replaceChildren();detail.replaceChildren();
    toggle(false);
  }
  document.addEventListener('unit501:selection-changed',reset);
  document.addEventListener('unit501:team-context-updated',render);
  reset();
})();
