(function(){
  'use strict';
  const byId=id=>document.getElementById(id), room=byId('war-room'), list=byId('war-feed');
  if(!room || !list)return;
  let request=0,loaded=false,loadedAt=0,lastAttempt=0,loading=false,timer=null;
  function el(tag,value,className){const node=document.createElement(tag);if(value)node.textContent=value;if(className)node.className=className;return node;}
  // Handle raw fraction entities in old cached or upstream pick text. textContent remains safe.
  function bettingText(value){return String(value||'').replace(/(\d)(?:&frac12;|½)/gi,'$1.5').replace(/(\d)(?:&frac14;|¼)/gi,'$1.25').replace(/(\d)(?:&frac34;|¾)/gi,'$1.75');}
  async function load(syncPulse=true){
    // User-initiated refresh or league switch may supersede an in-flight request.
    loading=true;lastAttempt=Date.now();
    const version=++request, league=byId('war-feed-league').value;
    if(syncPulse&&typeof window!=='undefined')window.Unit501LeaguePulse?.show(league,false);
    loaded=true; list.replaceChildren();byId('war-feed-status').textContent='Loading public selections…';
    try{
      const response=await fetch('/api/outside-picks?league='+encodeURIComponent(league),{signal:AbortSignal.timeout(35000)});
      if(!response.ok)throw Error('Unavailable');const data=await response.json();if(version!==request)return;
      if(!Array.isArray(data.sources))throw Error('Invalid feed');
      const summary=el('section',null,'war-feed-source war-consensus');
      const heading=el('div',null,'war-consensus-heading');
      const icon=el('span','▥','war-consensus-icon');icon.setAttribute('aria-hidden','true');
      const headingText=el('div',null,'war-consensus-heading-text');
      headingText.append(el('h4','Most repeated selections'),el('small','Picks mentioned by multiple analysts'));
      heading.append(icon,headingText);summary.append(heading);
      if(!data.consensus?.length)summary.append(el('p','No verified matching selections across the loaded picks. Undated picks and different lines are not combined.','war-consensus-empty'));
      for(const pick of data.consensus||[]){
        const card=el('article',null,'war-consensus-card');
        const publishers=[...new Set((pick.sources||[]).map(m=>m.source).filter(Boolean))];
        const top=el('div',null,'war-consensus-top');
        const details=el('div',null,'war-consensus-details');
        details.append(el('strong',bettingText(pick.pick),'war-consensus-pick'),el('p',pick.matchup+' · '+pick.date,'war-consensus-matchup'));
        const metrics=el('div',null,'war-consensus-metrics');
        for(const [n,label,kind] of [[pick.count,'Named selections','picks'],[publishers.length,'Sources','sources']]){
          const metric=el('div',null,'war-consensus-metric war-consensus-metric-'+kind);
          metric.append(el('strong',String(n)),el('small',label));metrics.append(metric);
        }
        top.append(details,metrics);card.append(top);
        const groups=new Map();
        for(const member of pick.sources||[]){
          const name=member.source||'Other source';
          if(!groups.has(name))groups.set(name,[]);
          groups.get(name).push(member);
        }
        for(const [publisher,members] of groups){
          const group=el('div',null,'war-consensus-publisher');
          group.append(el('div',publisher,'war-consensus-source-name'));
          for(const member of members){
            const link=el('a',null,'war-consensus-link');
            link.href=member.url;link.target='_blank';link.rel='noopener noreferrer';
            link.title='Open original pick from '+publisher;
            link.append(el('span',member.author||'Unnamed analyst','war-consensus-analyst'),
              el('span',bettingText(member.pick||pick.pick),'war-consensus-selection'),
              el('span','↗','war-consensus-external'));
            group.append(link);
          }
          card.append(group);
        }
        summary.append(card);
      }
      list.append(summary);
      let count=0;
      for(const source of data.sources){
        const section=el('section',null,'war-feed-source');section.append(el('h4',source.name));
        section.append(el('p',source.message,'war-muted'));
        section.append(el('p','Checked '+new Date(source.checkedAt).toLocaleString()+' • cached up to 5 minutes','war-muted'));
        if(!source.picks.length)section.append(el('p',source.status==='available'?'No upcoming dated selections remain in this source response.':'No picks loaded.','war-muted'));
        for(const pick of source.picks){
          count++;const card=el('article',null,'war-record');
          card.append(el('strong',bettingText(pick.pick)),el('p',pick.matchup),el('p',pick.author+' • '+pick.eventLabel,'war-muted'));
          if(pick.publishedLabel)card.append(el('p','Source release: '+pick.publishedLabel+' (as of check time)','war-muted'));
          const link=el('a','View original pick ↗');link.href=pick.url;link.target='_blank';link.rel='noopener noreferrer';card.append(link);
          section.append(card);
        }
        list.append(section);
      }
      loadedAt=Date.now();
      byId('war-feed-status').textContent=count+' public selections loaded. Check the displayed game date and price before using a pick.';
    }catch(error){if(version!==request)return;loaded=false;list.replaceChildren();byId('war-feed-status').textContent='Could not load public picks. Try Refresh picks or use the source links below.';}
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
  if(room.dataset?.autoload==='true')load(false);
  if(room.open){refreshIfDue();watch();}
})();
