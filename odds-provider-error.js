'use strict';
const providerErrors = {
  MISSING_KEY: 'Odds provider says the API key is missing. Check ODDS_API_KEY in Railway.',
  INVALID_KEY: 'Odds provider rejected ODDS_API_KEY. Check that it matches your active The Odds API account.',
  DEACTIVATED_KEY: 'Odds provider says the key is deactivated. Check the subscription tied to that key.',
  OUT_OF_USAGE_CREDITS: 'Odds provider reports monthly usage credits exhausted. Check remaining credits in your The Odds API account.',
  EXCEEDED_FREQ_LIMIT: 'Odds provider is rate limiting requests. Wait a moment before refreshing.',
  INVALID_MARKET: 'Odds provider rejected the requested market. Review supported football player-prop markets.'
};
function errorForResponse(status, payload) {
  // Never surface URLs, keys, or untrusted provider messages to the UI.
  const code = String(payload?.error_code || payload?.code || '').toUpperCase();
  const help = Object.hasOwn(providerErrors, code) ? providerErrors[code] :
    status === 401 ? 'Odds provider refused authentication. Check the API key and remaining monthly credits in your The Odds API account.' :
    status === 429 ? 'Odds provider is rate limiting requests. Try again shortly.' :
    status === 422 ? 'Odds provider rejected one of the requested markets.' :
    'Odds provider could not supply player props. Try again later.';
  return new Error(`FanDuel feed returned ${status}${Object.hasOwn(providerErrors,code)?' ('+code+')':''}. ${help}`);
}
module.exports={errorForResponse};
