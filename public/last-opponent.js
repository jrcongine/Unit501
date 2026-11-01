// Resolve the meeting before reading the market. An unknown newer appearance
// must never expose an older game as the latest result.
(function(root){
  function describe(games, opponent, market, cutoff) {
    if (!opponent?.id || !Number.isFinite(cutoff)) return 'Unavailable';
    const meetings = games.filter(g => g.opponentId && String(g.opponentId) === String(opponent.id) &&
      Number.isFinite(g.time) && g.time < cutoff).sort((a,b) => b.time - a.time);
    for (const [index, game] of meetings.entries()) {
      if (meetings[index+1]?.time === game.time) return 'Unavailable';
      if (game.status === 'dnp') continue;
      if (game.status !== 'played' || !Number.isFinite(game.stats?.[market])) return 'Unavailable';
      const date = new Date(game.time).toLocaleDateString('en-US', {timeZone:'America/Chicago', month:'short', day:'numeric', year:'numeric'});
      return game.stats[market]+' vs '+opponent.name+' · '+date;
    }
    return 'Unavailable';
  }
  const lookups=new WeakMap();
  function basketballMeetings(history, quote, game) {
    if (!history || !game || String(history.gameId)!==String(game.id) || history.tipoff!==game.tipoff || history.teams?.length!==2) return null;
    const candidates = history.teams.flatMap(team => (team.players||[]).map(p => ({...p,team})));
    const player = root.Unit501NBAPlayerModel.matchPlayer(candidates,quote.name).player;
    if (!player?.team.available || player.available===false || !Array.isArray(player.results)) return null;
    const opponent = history.teams.find(team => team!==player.team);
    const games = (player.team.gameLog||[]).map(g => {
      const matches = player.results.filter(r => String(r.gameId)===String(g.id));
      const inactive = player.inactive?.some(r => String(r.gameId)===String(g.id));
      const unverified = player.unverified?.some(r => String(r.gameId)===String(g.id));
      const status = unverified ? 'unknown' : inactive && !matches.length ? 'dnp' : !inactive && matches.length===1 ? 'played' : 'unknown';
      return {time:Date.parse(g.tipoff),opponentId:g.opponentId,status,stats:matches[0]};
    });
    return {games,opponent,player};
  }
  function basketball(history,quote,game){
    const data=basketballMeetings(history,quote,game);
    if(!data)return 'Unavailable';
    const extra=lookups.get(history)?.get(String(data.player.id))?.result;
    const candidate=extra&&data.opponent&&String(data.opponent.id)===extra.opponent&&Number.isInteger(extra.values?.[quote.market]);
    if(candidate&&!data.games.some(g=>String(g.opponentId)===extra.opponent&&g.time>=extra.time&&g.time<Date.parse(game.tipoff)&&g.status!=='dnp')){
      const date=new Date(extra.time).toLocaleDateString('en-US',{timeZone:'America/Chicago',month:'short',day:'numeric',year:'numeric'});
      return extra.values[quote.market]+' vs '+data.opponent.name+' · '+date+(extra.stage?' · '+extra.stage:'');
    }
    return describe(data.games,data.opponent,quote.market,Date.parse(game.tipoff));
  }
  function recentBasketball(history,quote,game,now=Date.now()){
    if(!Number.isFinite(history?.checkedAt)||history.checkedAt>now+60000||now-history.checkedAt>1800000)return [];
    const data=basketballMeetings(history,quote,game);
    if(!data)return [];
    const cutoff=Math.min(now,Date.parse(game.tipoff));
    const rows=data.games.filter(g=>Number.isFinite(g.time)&&g.time<cutoff).sort((a,b)=>b.time-a.time);
    if(new Set(rows.map(g=>g.time)).size!==rows.length)return [];
    return rows.slice(0,5).map(g=>g.status==='dnp'?'DNP':
      g.status==='played'&&Number.isInteger(g.stats?.[quote.market])&&g.stats[quote.market]>=0?g.stats[quote.market]:'Missing');
  }
  function loadSelected(history,name,game,league,redraw){
    if(!name||!history||typeof fetch!=='function')return;
    const data=basketballMeetings(history,{name},game),player=String(data?.player?.id||''),opponent=String(data?.opponent?.id||'');
    if(!/^\d{1,12}$/.test(player)||!/^\d{1,12}$/.test(opponent)||!Number.isFinite(history.checkedAt)||Math.abs(Date.now()-history.checkedAt)>1800000)return;
    let entries=lookups.get(history);
    if(!entries){entries=new Map();lookups.set(history,entries);}
    if(entries.has(player))return;
    const entry={result:null};entries.set(player,entry);
    const kickoff=Date.parse(game.tipoff);
    const q=new URLSearchParams({league,player,opponent,kickoff});
    fetch('/api/basketball/last-opponent?'+q,{signal:AbortSignal.timeout(30000)}).then(async response=>{
      if(!response.ok)return;
      const {result}=await response.json();
      if(!result||result.player!==player||result.opponent!==opponent||!Number.isFinite(result.time)||result.time>=Math.min(kickoff,Date.now())||
         !root.Unit501NBAPlayerModel.matchPlayer([data.player],result.name).player)return;
      entry.result=result;redraw();
    }).catch(()=>{});
  }
  root.Unit501LastOpponent={describe,basketball,recentBasketball,loadSelected};
  if(typeof module!=='undefined') module.exports=root.Unit501LastOpponent;
})(typeof window==='undefined'?globalThis:window);
