'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {PRODUCT,createAppleEntitlementVerifier}=require('../subscriptions/apple-entitlement');
const accountToken='12345678-abcd-1234-abcd-123456789012',now=200000;
const transaction={bundleId:'com.unit501.app',environment:'Sandbox',productId:PRODUCT.id,
 type:'Auto-Renewable Subscription',appAccountToken:accountToken,
 originalTransactionId:'100',transactionId:'101',expiresDate:300000,signedDate:190000};
function verify(tx=transaction){return createAppleEntitlementVerifier({bundleId:'com.unit501.app',environment:'Sandbox',now:()=>now,
 verifier:{verifyAndDecodeTransaction:async()=>tx}})({signedTransaction:'fixture-only',accountToken});}
test('subscription foundation is disabled and never grants access from a transaction alone',async()=>{
 assert.equal(PRODUCT.enabled,false);assert.equal(PRODUCT.targetPriceUSD,5.99);
 const result=await verify();assert.equal(result.candidateActive,true);
 assert.equal(result.accessGranted,false);assert.equal(result.requiresServerReconciliation,true);
});
test('Apple expiry and refunds withhold candidate access',async()=>{
 for(const patch of [{expiresDate:now},{expiresDate:now-1},{revocationDate:now-1}])
  assert.equal((await verify({...transaction,...patch})).candidateActive,false);
});
test('wrong user, app, product, environment or malformed transaction is rejected',async()=>{
 for(const patch of [{appAccountToken:'another-account'},{bundleId:'other'},{environment:'Production'},
  {productId:'other'},{type:'Consumable'},{signedDate:now+60001},{expiresDate:NaN},{transactionId:null}])
  await assert.rejects(verify({...transaction,...patch}));
});
test('unverified signatures cannot reach entitlement evaluation',async()=>{
 const verifier=createAppleEntitlementVerifier({bundleId:'app',environment:'Production',
  verifier:{verifyAndDecodeTransaction:async()=>{throw Error('Invalid signature');}}});
 await assert.rejects(verifier({signedTransaction:'forged',accountToken}),/Invalid signature/);
 assert.throws(()=>createAppleEntitlementVerifier(),/configuration/);
});
