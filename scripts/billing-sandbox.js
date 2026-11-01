'use strict';
// Operator-only checkout rehearsal. Never invoked by server.js. No access grants.
async function rehearse(action,{env=process.env,fetcher=fetch}={}){
 const key=env.STRIPE_TEST_SECRET_KEY,price=env.UNIT501_TEST_PRICE_ID,customer=env.UNIT501_TEST_CUSTOMER_ID;
 if(!/^sk_test_[a-zA-Z0-9]+$/.test(key||'')||!/^price_[a-zA-Z0-9]+$/.test(price||'')||!/^cus_[a-zA-Z0-9]+$/.test(customer||''))throw Error('Configure a Stripe sandbox key, test customer and monthly test price.');
 async function request(route,params,operation){
  const headers={Authorization:'Bearer '+key,'Stripe-Version':'2024-06-20'};
  if(operation)headers['Idempotency-Key']=operation;
  const response=await fetcher('https://api.stripe.com/v1/'+route,{method:params?'POST':'GET',headers,body:params,redirect:'error',signal:AbortSignal.timeout(12000)});
  if(!response.ok)throw Error('Sandbox request failed (HTTP '+response.status+').');
  const data=await response.json();if(data.livemode!==false)throw Error('Sandbox object required.');
  return data;
 }
 if(action==='checkout'){
  const monthly=await request('prices/'+price);
  if(monthly.id!==price||!monthly.active||monthly.recurring?.interval!=='month'||monthly.recurring.interval_count!==1||monthly.unit_amount<=0||!Number.isSafeInteger(monthly.unit_amount))throw Error('An active fixed monthly test price is required.');
  const operation=env.UNIT501_TEST_ATTEMPT_ID;
  if(!/^[a-zA-Z0-9_-]{8,80}$/.test(operation||''))throw Error('Set a stable test attempt ID and reuse it when retrying.');
  const params=new URLSearchParams({customer,mode:'subscription','line_items[0][price]':price,'line_items[0][quantity]':'1',success_url:'http://localhost:5010/',cancel_url:'http://localhost:5010/'});
  const session=await request('checkout/sessions',params,'unit501-sandbox-'+operation);
  if(!/^cs_test_[A-Za-z0-9]+$/.test(session.id)||session.customer!==customer||typeof session.url!=='string'||new URL(session.url).origin!=='https://checkout.stripe.com')throw Error('Unexpected sandbox checkout.');
  return {session:session.id,checkout:session.url};
 }
 if(!/^cs_test_[a-zA-Z0-9]+$/.test(action||''))throw Error('Pass checkout or a test checkout session ID.');
 const session=await request('checkout/sessions/'+action+'?expand%5B%5D=subscription.latest_invoice');
 if(session.id!==action||session.mode!=='subscription'||session.customer!==customer)throw Error('Session/customer mismatch.');
 const sub=session.subscription;
 if(!sub)return {state:'awaiting-checkout'};
 const items=sub.items?.data;
 if(sub.livemode!==false||sub.customer!==customer||sub.items?.has_more!==false||!Array.isArray(items)||items.length!==1||items[0]?.price?.id!==price||items[0].quantity!==1)throw Error('Subscription/customer/plan mismatch.');
 const invoice=sub.latest_invoice;
 if(sub.status==='active'&&invoice?.livemode===false&&invoice.customer===customer&&invoice.subscription===sub.id&&invoice.status==='paid'&&invoice.paid===true)return {state:'paid-test-invoice',cancelAtPeriodEnd:sub.cancel_at_period_end===true};
 return {state:['canceled','unpaid','incomplete_expired'].includes(sub.status)?'ended':'payment-unconfirmed'};
}
if(require.main===module)rehearse(process.argv[2]).then(result=>console.log(JSON.stringify(result))).catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={rehearse};
