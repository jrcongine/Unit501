'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {rehearse}=require('../scripts/billing-sandbox');
const env={STRIPE_TEST_SECRET_KEY:'sk_test_fixture',UNIT501_TEST_PRICE_ID:'price_example',UNIT501_TEST_CUSTOMER_ID:'cus_fixture',UNIT501_TEST_ATTEMPT_ID:'fixture001'};
const price={id:'price_example',active:true,unit_amount:100,recurring:{interval:'month',interval_count:1}};
const session={id:'cs_test_fixture',mode:'subscription',customer:env.UNIT501_TEST_CUSTOMER_ID,url:'https://checkout.stripe.com/c/pay/test'};
const invoice={livemode:false,subscription:'sub_fixture',customer:session.customer,status:'paid',paid:true};
const sub={id:'sub_fixture',livemode:false,customer:session.customer,items:{has_more:false,data:[{quantity:1,price}]},status:'active',latest_invoice:invoice};
const response=data=>({ok:true,json:async()=>({livemode:false,...data})});
test('sandbox checkout is test-only with a fixed monthly plan and retry key',async()=>{
 const calls=[];const fetcher=async(url,opts)=>{calls.push(opts);return response(url.includes('/prices/')?price:session);};
 await assert.rejects(rehearse('checkout',{env:{...env,STRIPE_TEST_SECRET_KEY:'sk_live_fixture'},fetcher}));assert.equal(calls.length,0);
 assert.equal((await rehearse('checkout',{env,fetcher})).session,session.id);assert.equal(calls[1].headers['Idempotency-Key'],'unit501-sandbox-fixture001');
 assert.equal(calls[1].body.get('line_items[0][price]'),price.id);
});
test('sandbox reconciliation reads current invoice, rejects crossed accounts and handles recovery',async()=>{
 const run=(subscription,details={})=>rehearse(session.id,{env,fetcher:async()=>response({...session,...details,subscription})});
 assert.equal((await run(null)).state,'awaiting-checkout');
 for(const status of ['incomplete','past_due','active'])assert.equal((await run({...sub,status,latest_invoice:{...invoice,status:'open',paid:false}})).state,'payment-unconfirmed');
 assert.equal((await run({...sub,status:'canceled'})).state,'ended');
 assert.equal((await run(sub)).state,'paid-test-invoice');
 await assert.rejects(run(sub,{customer:'cus_other'}));await assert.rejects(run({...sub,customer:'cus_other'}));
 await assert.rejects(run({...sub,items:{has_more:false,data:[]}}));await assert.rejects(run(sub,{livemode:true}));
});
