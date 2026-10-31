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
  function basketball(history, quote, game) {
    if (!history || !game || String(history.gameId)!==String(game.id) || history.tipoff!==game.tipoff || history.teams?.length!==2) return 'Unavailable';
    const candidates = history.teams.flatMap(team => (team.players||[]).map(p => ({...p,team})));
    const player = root.Unit501NBAPlayerModel.matchPlayer(candidates,quote.name).player;
    if (!player?.team.available || player.available===false) return 'Unavailable';
    const opponent = history.teams.find(team => team!==player.team);
    const games = (player.team.gameLog||[]).map(g => {
      const matches = player.results.filter(r => String(r.gameId)===String(g.id));
      const inactive = player.inactive?.some(r => String(r.gameId)===String(g.id));
      const status = inactive && !matches.length ? 'dnp' : !inactive && matches.length===1 ? 'played' : 'unknown';
      return {time:Date.parse(g.tipoff),opponentId:g.opponentId,status,stats:matches[0]};
    });
    return describe(games,opponent,quote.market,Date.parse(game.tipoff));
  }
  root.Unit501LastOpponent={describe,basketball};
  if(typeof module!=='undefined') module.exports=root.Unit501LastOpponent;
})(typeof window==='undefined'?globalThis:window);
