/* Position labels reconcile only within an explicit broad family. They never
   establish player identity, participation, starting status or injury value. */
(function(root){
 'use strict';
 const aliases={LCB:'CB',RCB:'CB',NB:'CB',LDE:'DE',RDE:'DE',LDT:'DT',RDT:'DT',LT:'T',RT:'T',OT:'T',LG:'G',RG:'G',OG:'G',MLB:'LB',WLB:'OLB',SLB:'OLB',EDG:'DE',EDGE:'DE'};
 const families={DB:['CB','S','FS','SS'],S:['FS','SS'],DL:['DE','DT','NT','EDGE'],LB:['ILB','OLB']};
 function normalize(value){const p=String(value||'').trim().toUpperCase();return aliases[p]||(/^WR-/.test(p)?'WR':p);}
 function compatible(a,b){a=normalize(a);b=normalize(b);return Boolean(a&&b&&(a===b||families[a]?.includes(b)||families[b]?.includes(a)));}
 const api={normalize,compatible};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.Unit501FootballPosition=api;
})(typeof window!=='undefined'?window:globalThis);
