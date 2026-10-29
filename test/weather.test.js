'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {getForecast}=require('../weather');
test('hourly outlook crosses midnight, preserves kickoff inputs and keeps missing values unknown',async()=>{
 const original=global.fetch;
 const kickoff=Math.ceil((Date.now()+86400000)/86400000)*86400000-1800000;
 const times=Array.from({length:6},(_,i)=>(kickoff-1800000+i*3600000)/1000);
 global.fetch=async()=>({ok:true,json:async()=>({hourly:{time:times,temperature_2m:[50,49,null,47,46,45],wind_speed_10m:[5,10,20,25,30,40],wind_gusts_10m:[10,15,30,40,45,50],weather_code:[0,1,null,61,3,3],precipitation_probability:[0,20,50,80,90,100]}})});
 try{
  const result=await getForecast({latitude:40,longitude:-90,kickoff});
  assert.equal(result.windMph,5);
  assert.equal(result.weatherCode,0);
  assert.deepEqual(result.gameHours.map(h=>h.weatherCode),[1,null,61]);
  assert.deepEqual(result.gameHours.map(h=>h.windMph),[10,20,25]);
  assert.equal(result.gameHours[1].temperatureF,null);
  assert.ok(result.gameHours.every(h=>h.forecastTime>=kickoff&&h.forecastTime<=kickoff+10800000));
 }finally{global.fetch=original;}
});
test('missing later hours are not fabricated from kickoff',async()=>{
 const original=global.fetch, kickoff=Math.ceil((Date.now()+172800000)/3600000)*3600000;
 global.fetch=async()=>({ok:true,json:async()=>({hourly:{time:[kickoff/1000],wind_speed_10m:[12]}})});
 try{
  const result=await getForecast({latitude:41,longitude:-90,kickoff});
  assert.equal(result.gameHours.length,1);
  assert.equal(result.gameHours[0].gustMph,null);
  assert.equal(result.weatherCode,null);
  assert.equal(result.gameHours[0].weatherCode,null);
 }finally{global.fetch=original;}
});
