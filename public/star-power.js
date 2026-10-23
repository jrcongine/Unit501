/* Manual player game-day scenarios. Uncalibrated; never automatic. */
(function (root) {
  'use strict';
  const modes = Object.freeze({
    off: {label:'Standard projection',factor:1},
    boost: {label:'Star Power',factor:1.10},
    dud: {label:'🥶 Rivalry Dud',factor:0.90},
    fatigue: {label:'😴 Fatigue',factor:0.95}
  });
  function adjust(value, mode = 'off', game = null) {
    if (!Number.isFinite(value) || value < 0) return null;
    const key = Object.hasOwn(modes,mode) ? mode : 'off';
    const setting = modes[key];
    let weekday = null;
    if (Number.isFinite(game?.kickoff)) {
      weekday = new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',weekday:'long'}).format(new Date(game.kickoff));
    }
    const applied = key !== 'off';
    const warning = !applied ? 'No game-day scenario applied.'
      : key === 'boost' && weekday === 'Thursday'
      ? 'Thursday is a short week. Star Power is manual, not an automatic Thursday boost.'
      : key === 'fatigue'
      ? 'Short-rest fatigue is a manual assumption; verify actual rest and injury reports.'
      : 'This is a manually selected, uncalibrated scenario—not a measured player tendency.';
    return {mode:key,label:setting.label,factor:setting.factor,applied,baseline:value,
      adjusted:value*setting.factor,weekday,warning};
  }
  const api = {adjust,modes};
  if (typeof module !== 'undefined' && module.exports) module.exports=api;
  root.Unit501StarPower=api;
})(typeof window !== 'undefined' ? window : globalThis);
