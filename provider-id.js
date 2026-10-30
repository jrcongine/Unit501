'use strict';
// Provider identifiers must be explicit positive integers, never coerced booleans,
// arrays, objects, fractional values or scientific/hexadecimal notation.
function positiveId(value){
 if(typeof value!=='number'&&(typeof value!=='string'||!/^\d+$/.test(value)))return null;
 const n=Number(value);return Number.isSafeInteger(n)&&n>0?n:null;
}
module.exports={positiveId};
