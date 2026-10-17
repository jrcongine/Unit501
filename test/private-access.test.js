'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {allowRequest}=require('../private-access');
function attempt(url,password,credentials){
  const res={headers:{},setHeader(k,v){this.headers[k]=v;},writeHead(status,headers){this.status=status;Object.assign(this.headers,headers);},end(body){this.body=body;}};
  const headers=credentials===undefined?{}:{authorization:'Basic '+Buffer.from(credentials).toString('base64')};
  return {allowed:allowRequest({url,headers},res,{UNIT501_PRIVATE_PASSWORD:password}),...res};
}
test('private gate fails closed without a strong configured password',()=>{
  for(const password of [undefined,'','short'])for(const url of ['/','/app.js','/api/fanduel','/api/fanduel-props']){
    const r=attempt(url,password);assert.equal(r.allowed,false);assert.equal(r.status,503);
  }
});
test('all app and paid API routes require correct owner credentials',()=>{
  const password='test-password-123456789';
  for(const url of ['/','/app.js','/api/fanduel','/api/fanduel-props','/api/games']){
    for(const credentials of [undefined,'jr:wrong','other:'+password]){
      const r=attempt(url,password,credentials);assert.equal(r.allowed,false);assert.equal(r.status,401);
    }
    assert.equal(attempt(url,password,'jr:'+password).allowed,true);
  }
});
test('health remains available without provider or credential details',()=>{
  const r=attempt('/api/health');assert.equal(r.allowed,false);assert.equal(r.status,200);
  assert.deepEqual(JSON.parse(r.body),{ok:true,private:true,liveData:false});
  assert.equal(r.headers['Cache-Control'],'no-store');
});
