
'use strict';
// Decode known provider punctuation, never interpret input as HTML.
function decodePunctuation(value) {
  return String(value||'').replace(/&#(?:0*39|x0*27);|&apos;|&rsquo;/gi,"'");
}
module.exports={decodePunctuation};
