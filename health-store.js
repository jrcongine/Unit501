'use strict';
// Bounded status metadata only. Never persist provider payloads, URLs or credentials.
const fs=require('node:fs'),path=require('node:path');
function createStore(file){
 let error=null,blocked=false,timer=null,pending=null,saved=false;
 function load(){
  if(!file)return [];
  try{
   if(fs.statSync(file).size>262144)throw Error('Oversized status file');
   const data=JSON.parse(fs.readFileSync(file,'utf8'));
   if(data.version!==1||!Array.isArray(data.rows)||data.rows.length>256)throw Error('Invalid status file');
   saved=true;return data.rows;
  }catch(e){if(e.code!=='ENOENT'){error='Saved feed status could not be read. Existing file preserved.';blocked=true;}return [];}
 }
 function flush(){
  clearTimeout(timer);timer=null;
  if(!file||blocked||!pending)return;
  const data=pending;pending=null;const temp=file+'.'+process.pid+'.tmp';
  try{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(temp,JSON.stringify({version:1,rows:data}),{mode:0o600});fs.renameSync(temp,file);error=null;saved=true;}
  catch{error='Feed status could not be saved. Current status is in memory only.';}
 }
 function save(rows){if(!file||blocked)return;pending=rows;if(!timer){timer=setTimeout(flush,500);timer.unref?.();}}
 return {load,save,flush,status:()=>({configured:Boolean(file),persistent:Boolean(file)&&saved&&!error,error})};
}
module.exports={createStore};
