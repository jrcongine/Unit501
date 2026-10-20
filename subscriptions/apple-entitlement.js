'use strict';
// Private foundation only; intentionally not mounted in server.js.
// Supply Apple's official SignedDataVerifier and a trusted server-side identity.
const PRODUCT_ID='com.unit501.pro.monthly'; // Proposed: must match App Store Connect.
const PRODUCT=Object.freeze({id:PRODUCT_ID,targetPriceUSD:5.99,period:'P1M',enabled:false});
function createAppleEntitlementVerifier({verifier,bundleId,environment,now=Date.now}={}){
 if(!verifier||typeof verifier.verifyAndDecodeTransaction!=='function'||!bundleId||
   !['Sandbox','Production'].includes(environment))throw Error('Apple verification configuration required');
 return async function verify({signedTransaction,accountToken}={}){
  if(typeof accountToken!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(accountToken))throw Error('Authenticated account binding required');
  if(typeof signedTransaction!=='string'||signedTransaction.length>64000)throw Error('Signed transaction required');
  // Never decode a client-provided JWT without cryptographic verification.
  const tx=await verifier.verifyAndDecodeTransaction(signedTransaction);
  if(tx.bundleId!==bundleId||tx.environment!==environment||tx.productId!==PRODUCT_ID||
    tx.type!=='Auto-Renewable Subscription'||
    typeof tx.appAccountToken!=='string'||tx.appAccountToken.toLowerCase()!==accountToken.toLowerCase())
   throw Error('Apple transaction does not match this account or product');
  if(typeof tx.originalTransactionId!=='string'||!tx.originalTransactionId||
    typeof tx.transactionId!=='string'||!tx.transactionId||
    !Number.isSafeInteger(tx.expiresDate)||!Number.isSafeInteger(tx.signedDate)||
    tx.signedDate>now()+60000)throw Error('Invalid Apple transaction fields');
  // A signed transaction alone cannot prove it was not refunded since signing.
  // Persist only a candidate. Reconcile with Server API + signed Notifications V2
  // before granting access; stale/replayed transactions must never restore Pro.
  return Object.freeze({productId:PRODUCT_ID,originalTransactionId:tx.originalTransactionId,
   transactionId:tx.transactionId,accountToken,environment,signedAt:tx.signedDate,
   expiresAt:tx.expiresDate,revoked:tx.revocationDate!=null,
   candidateActive:tx.revocationDate==null&&tx.expiresDate>now(),
   requiresServerReconciliation:true,accessGranted:false});
 };
}
module.exports={PRODUCT,createAppleEntitlementVerifier};
