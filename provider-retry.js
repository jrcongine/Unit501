'use strict';
// Retry once only for transient transport/HTTP failures. The caller must meter
// every attempt; quota/auth/application errors are never marked retryable.
async function withRecovery(perform,{wait=ms=>new Promise(resolve=>setTimeout(resolve,ms))}={}){
 try{return await perform();}
 catch(error){
  if(error.retryable!==true)throw error;
  await wait(350);
  return perform();
 }
}
module.exports={withRecovery};
