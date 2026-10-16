(function(){
  'use strict';
  const byId=id=>document.getElementById(id), room=byId('war-room'), list=byId('war-feed');
  if(!room || !list)return;
  let request=0,loaded=false,loadedAt=0,lastAttempt=0,loading=false,timer=null;
  function el(tag,value,className){const node=document.createElement(tag);if(value)node.textContent=value;if(className)node.className=className;return node;}
  const consensus=byId('war-consensus');
  function renderConsensus(sources){
    if(!consensus || typeof window==='undefined' || !window.Unit501PickConsensus)return;
    consensus.replaceChildren();
    const result=window.Unit501PickConsensus.build(sources);
    if(!result.groups.length)consensus.append(el('p','No safely matched picks yet. Review the individual source cards below.','war-muted'));
    for(const group of result.groups){
      const card=el('details',null,'war-agreement'+(group.agreement>1?' war-agreement-match':''));
      const title=el('summary');
      title.append(el('strong',group.side+' • '+group.market+' • '+group.lines.join(' / ')),el('span',group.agreement+' handicapper(s) · '+group.sourceCount+' website(s)','war-agreement-count'));
      card.append(title,el('p',group.matchup+' • '+group.date,'war-muted'),el('p',group.sources.join(' + '),'war-muted'));
      if(group.lines.length>1)card.append(el('p','Different lines — compare the exact selections below.','war-muted'));
      if(group.opposition)card.append(el('p',group.opposition+' handicapper(s) on the opposite side; lines may differ.','war-disagreement'));
      for(const pick of group.entries){
        const row=el('p',pick.author+' — '+pick.source+': '+pick.pick+' ');
        const link=el('a','Original pick ↗');
        if(/^https:\/\//i.test(pick.url||'')){link.href=pick.url;link.target='_blank';link.rel='noopener noreferrer';row.append(link);}
        card.append(row);
      }
      consensus.append(card);
    }
    if(result.unmatched)consensus.append(el('p',result.unmatched+' selection(s) not grouped: date, team or market could not be safely matched. Still shown below.','war-muted'));
  }
  async function load(){
    // User-initiated refresh or league switch may supersede an in-flight request.
    loading=true;lastAttempt=Date.now();
    const version=++request, league=byId('war-feed-league').value;
    loaded=true; list.replaceChildren();if(consensus)consensus.textContent='Comparing public picks…';byId('war-feed-status').textContent='Loading public selections…';
    try{
      const response=await fetch('/api/outside-picks?league='+encodeURIComponent(league),{signal:AbortSignal.timeout(18000)});
      if(!response.ok)throw Error('Unavailable');const data=await response.json();if(version!==request)return;
      if(!Array.isArray(data.sources))throw Error('Invalid feed');
      renderConsensus(data.sources);
      let count=0;
      for(const source of data.sources){
        const section=el('section',null,'war-feed-source');section.append(el('h4',source.name));
        section.append(el('p',source.message,'war-muted'));
        section.append(el('p','Checked '+new Date(source.checkedAt).toLocaleString()+' • cached up to 5 minutes','war-muted'));
        if(!source.picks.length)section.append(el('p',source.status==='available'?'No upcoming dated selections remain in this source response.':'No picks loaded.','war-muted'));
        for(const pick of source.picks){
          count++;const card=el('article',null,'war-record');
          card.append(el('strong',pick.pick),el('p',pick.matchup),el('p',pick.author+' • '+pick.eventLabel,'war-muted'));
          if(pick.publishedLabel)card.append(el('p','Source release: '+pick.publishedLabel+' (as of check time)','war-muted'));
          const link=el('a','View original pick ↗');link.href=pick.url;link.target='_blank';link.rel='noopener noreferrer';card.append(link);
          section.append(card);
        }
        list.append(section);
      }
      for(const entry of data.manual || []){const section=el('section',null,'war-feed-source');section.append(el('h4',entry.name),el('p',entry.message,'war-muted'));list.append(section);}
      loadedAt=Date.now();
      byId('war-feed-status').textContent=count+' public selections loaded. Check the displayed game date and price before using a pick.';
    }catch(error){if(version!==request)return;loaded=false;list.replaceChildren();if(consensus)consensus.textContent='Agreement unavailable until picks reload.';byId('war-feed-status').textContent='Could not load public picks. Try Refresh picks or use the source links below.';}
    finally{if(version===request)loading=false;}
  }
  byId('war-feed-refresh').addEventListener('click',load);
  byId('war-feed-league').addEventListener('change',load);
  function refreshIfDue(){
    if(!room.open||document.hidden||loading)return;
    const now=Date.now();
    if((!loaded||now-loadedAt>=300000)&&(!lastAttempt||now-lastAttempt>=300000))load();
  }
  function watch(){
    if(timer!==null && typeof clearTimeout==='function')clearTimeout(timer);
    if(!room.open||typeof setTimeout!=='function')return;
    timer=setTimeout(()=>{refreshIfDue();watch();},60000);
  }
  room.addEventListener('toggle',()=>{refreshIfDue();watch();});
  document.addEventListener?.('visibilitychange',refreshIfDue);
  if(room.open){refreshIfDue();watch();}
})();
