'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const http=require('node:http');
const {createAccounts}=require('../customer-accounts');
const {allowRequest}=require('../private-access');
const invite='unit501-test-invitation-0123456789abcdef';
const password='testing-long-password-123';
async function setup(t,{httpsCookies=false}={}){
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'unit501-accounts-'));
 let accounts,clock=Date.now();
 const server=http.createServer(async(req,res)=>{
  try{
   if(await accounts.handle(req,res))return;
   if(!await accounts.allowCustomer(req)&&!allowRequest(req,res,{UNIT501_PRIVATE_PASSWORD:'owner-password-123456789'}))return;
   res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({ok:true}));
  }catch{res.writeHead(503);res.end();}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const root='http://127.0.0.1:'+server.address().port;
 const env={UNIT501_CUSTOMER_ACCOUNTS:'1',UNIT501_ACCOUNT_DATA_DIR:dir,UNIT501_PUBLIC_ORIGIN:httpsCookies?'https://unit501.test':root,UNIT501_BETA_INVITE:invite};
 const make=()=>createAccounts({env,now:()=>clock});accounts=make();
 t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await fs.rm(dir,{recursive:true,force:true});});
 const identities=new Map();
 async function request(route,{method='GET',cookie,body,origin=env.UNIT501_PUBLIC_ORIGIN,headers={}}={}){
  const response=await fetch(root+route,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{}),...(identities.has(cookie)?{'X-Unit501-Account-ID':identities.get(cookie)}:{}),...(origin?{Origin:origin}:{}),...headers},body:body?JSON.stringify(body):undefined});
  const text=await response.text();let data;try{data=JSON.parse(text);}catch{data=text;}
  const sessionCookie=response.headers.get('set-cookie');
  if(sessionCookie&&data.user)identities.set(sessionCookie.split(';')[0],data.user.id);
  return {status:response.status,data,cookie:sessionCookie,headers:response.headers};
 }
 async function signup(address='one@example.com'){
  const result=await request('/api/account/signup',{method:'POST',body:{email:address,password,invite}});
  assert.equal(result.status,201,JSON.stringify(result.data));return {...result,token:result.cookie.split(';')[0]};
 }
 return {request,signup,dir,env,restart:()=>{accounts=make();},advance:ms=>{clock+=ms;},disable:async id=>{
  const filename=path.join(dir,'accounts.json'),data=JSON.parse(await fs.readFile(filename,'utf8'));data.users.find(u=>u.id===id).disabled=true;await fs.writeFile(filename,JSON.stringify(data));
 }};
}
test('customer access is off by default and rejects unsafe storage/origin configuration',async()=>{
 const service=createAccounts({env:{}});assert.equal(service.enabled,false);assert.equal(await service.session({headers:{}}),null);
 assert.throws(()=>createAccounts({env:{UNIT501_CUSTOMER_ACCOUNTS:'1'}}),/HTTPS origin/);
 assert.throws(()=>createAccounts({env:{UNIT501_CUSTOMER_ACCOUNTS:'1',UNIT501_PUBLIC_ORIGIN:'http://external.test',UNIT501_ACCOUNT_DATA_DIR:'/tmp/test'}}),/HTTPS/);
 assert.throws(()=>createAccounts({env:{UNIT501_CUSTOMER_ACCOUNTS:'1',UNIT501_PUBLIC_ORIGIN:'https://unit501.test',UNIT501_ACCOUNT_DATA_DIR:path.resolve(__dirname,'../public/data')}}),/outside/);
 assert.throws(()=>createAccounts({env:{UNIT501_CUSTOMER_ACCOUNTS:'1',UNIT501_PUBLIC_ORIGIN:'https://unit501.test',UNIT501_ACCOUNT_DATA_DIR:'relative'}}),/absolute/);
});
test('signup requires invitation, origin and strong password; HTTPS sessions have protective cookie flags',async t=>{
 const app=await setup(t,{httpsCookies:true});
 const body={email:'one@example.com',password,invite};
 assert.equal((await app.request('/api/account/signup',{method:'POST',body,origin:'https://attacker.test'})).status,403);
 assert.equal((await app.request('/api/account/signup',{method:'POST',body,origin:null})).status,403);
 assert.equal((await app.request('/api/account/signup',{method:'POST',body:{...body,invite:'wrong'}})).status,403);
 assert.equal((await app.request('/api/account/signup',{method:'POST',body:{...body,password:'short'}})).status,400);
 const signed=await app.signup(' One@Example.com ');
 assert.equal(signed.data.user.email,'one@example.com');assert.equal(signed.data.user.access,'beta');
 for(const attribute of ['HttpOnly','SameSite=Strict','Secure','Path=/'])assert.ok(signed.cookie.includes(attribute));
 assert.equal(signed.headers.get('cache-control'),'no-store');
 const disk=await fs.readFile(path.join(app.dir,'accounts.json'),'utf8');
 assert.ok(!disk.includes(password));assert.ok(!disk.includes(signed.token.split('=')[1]));assert.ok(!disk.includes(invite));
 assert.equal((await fs.stat(path.join(app.dir,'accounts.json'))).mode&0o777,0o600);
 assert.equal((await app.request('/api/account/signup',{method:'POST',body})).status,409);
});
test('records are isolated by authenticated account, persist after restart and ignore supplied user IDs',async t=>{
 const app=await setup(t),one=await app.signup(),two=await app.signup('two@example.com');
 const records={'unit501:war-room:v1':JSON.stringify([{matchup:'A @ B',pick:'A +3'}]),'unit501-score-archive-v1':JSON.stringify({schema:1,snapshots:[{example:true}]})};
 assert.equal((await app.request('/api/account/records')).status,401);
 const result=await app.request('/api/account/records',{method:'PUT',cookie:one.token,body:{revision:0,records,userId:two.data.user.id}});
 assert.equal(result.status,200);assert.equal(result.data.revision,1);
 app.restart();
 assert.deepEqual((await app.request('/api/account/records',{cookie:one.token})).data.records,records);
 assert.deepEqual((await app.request('/api/account/records?userId='+one.data.user.id,{cookie:two.token})).data.records,{});
 const me=await app.request('/api/account/me',{cookie:one.token});assert.deepEqual(me.data.user,one.data.user);assert.equal(me.data.passwordHash,undefined);
});
test('simultaneous saves cannot silently replace a newer revision',async t=>{
 const app=await setup(t),one=await app.signup();
 const save=value=>app.request('/api/account/records',{method:'PUT',cookie:one.token,body:{revision:0,records:{'unit501:war-room:v1':JSON.stringify([{pick:value}])}}});
 const results=await Promise.all([save('A'),save('B')]);assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
 const winner=results.find(r=>r.status===200);
 assert.deepEqual((await app.request('/api/account/records',{cookie:one.token})).data,winner.data);
});
test('an old tab cannot read, overwrite or sign out a newly selected account through its changed cookie',async t=>{
 const app=await setup(t),one=await app.signup(),two=await app.signup('two@example.com');
 const headers={'X-Unit501-Account-ID':one.data.user.id};
 for(const request of [
  {route:'/api/account/records',options:{cookie:two.token,headers}},
  {route:'/api/account/records',options:{method:'PUT',cookie:two.token,headers,body:{revision:0,records:{}}}},
  {route:'/api/account/logout',options:{method:'POST',cookie:two.token,headers,body:{}}}
 ])assert.equal((await app.request(request.route,request.options)).status,409);
 assert.equal((await app.request('/api/account/records',{method:'PUT',cookie:one.token,headers:{'X-Unit501-Account-ID':''},body:{revision:0,records:{}}})).status,409);
 assert.equal((await app.request('/api/account/me',{cookie:two.token})).status,200);
 assert.equal((await app.request('/api/account/records',{cookie:two.token})).data.revision,0);
});
test('invalid archives, unsupported keys, missing revision and cross-site writes retain saved records',async t=>{
 const app=await setup(t),one=await app.signup(),cookie=one.token;
 const records={'unit501:war-room:v1':'[]'};
 assert.equal((await app.request('/api/account/records',{method:'PUT',cookie,body:{revision:0,records}})).status,200);
 for(const body of [{records},{revision:1,records:{'../../other':'[]'}},{revision:1,records:{'unit501:war-room:v1':'not json'}},{revision:1,records:{'unit501:war-room:v1':'{}'}},{revision:1,records:{'unit501-score-archive-v1':'[]'}}]){
  assert.equal((await app.request('/api/account/records',{method:'PUT',cookie,body})).status,400);
 }
 assert.equal((await app.request('/api/account/records',{method:'PUT',cookie,body:{revision:1,records:{}},origin:'https://attacker.test'})).status,403);
 const large=JSON.stringify([{notes:'x'.repeat(1024*1024)}]);
 assert.equal((await app.request('/api/account/records',{method:'PUT',cookie,body:{revision:1,records:{'unit501:war-room:v1':large}}})).status,413);
 assert.deepEqual((await app.request('/api/account/records',{cookie})).data.records,records);
});
test('logout revokes tokens; invalid and expired cookies cannot access data or application routes',async t=>{
 const app=await setup(t),one=await app.signup();
 assert.equal((await app.request('/api/account/logout',{method:'POST',cookie:one.token,body:{}})).status,200);
 for(const cookie of [one.token,'unit501_session='+'a'.repeat(64),'unit501_session=%00'])assert.equal((await app.request('/api/account/me',{cookie})).status,401);
 const login=await app.request('/api/account/login',{method:'POST',body:{email:'one@example.com',password}});
 assert.equal(login.status,200);const cookie=login.cookie.split(';')[0];
 assert.equal((await app.request('/',{cookie})).status,200);
 app.advance(7*86400000+1);
 assert.equal((await app.request('/api/account/me',{cookie})).status,401);
 assert.equal((await app.request('/',{cookie})).status,401);
});
test('customer sessions cannot open owner-only controls or mutate sports routes',async t=>{
 const app=await setup(t),one=await app.signup(),cookie=one.token;
 assert.equal((await app.request('/api/nba/games?date=2026-10-24',{cookie})).status,200);
 assert.equal((await app.request('/api/provider-usage',{cookie})).status,401);
 assert.equal((await app.request('/api/roster-maintenance',{cookie})).status,401);
 assert.equal((await app.request('/api/games',{method:'POST',cookie,body:{}})).status,401);
 assert.equal((await app.request('/api/provider-usage',{headers:{Authorization:'Basic '+Buffer.from('jr:owner-password-123456789').toString('base64')}})).status,200);
 await app.disable(one.data.user.id);
 assert.equal((await app.request('/api/account/me',{cookie})).status,401);
});
test('unknown-user and wrong-password logins share errors and login attempts are limited',async t=>{
 const app=await setup(t);await app.signup();
 const wrong=await app.request('/api/account/login',{method:'POST',body:{email:'one@example.com',password:'wrong-password-123'}});
 const missing=await app.request('/api/account/login',{method:'POST',body:{email:'unknown@example.com',password}});
 assert.equal(wrong.status,401);assert.deepEqual(wrong.data,missing.data);
 let result;for(let i=0;i<10;i++)result=await app.request('/api/account/login',{method:'POST',body:{email:'one@example.com',password:'wrong-password-123'}});
 assert.equal(result.status,429);
 app.advance(15*60000+1);
 assert.equal((await app.request('/api/account/login',{method:'POST',body:{email:'one@example.com',password}})).status,200);
});
test('corrupt storage fails closed without replacing records or disclosing filesystem details',async t=>{
 const app=await setup(t),one=await app.signup(),filename=path.join(app.dir,'accounts.json');
 await fs.writeFile(filename,'broken json');
 const result=await app.request('/api/account/records',{cookie:one.token});
 assert.equal(result.status,503);assert.ok(!result.data.error.includes(app.dir));assert.equal(await fs.readFile(filename,'utf8'),'broken json');
});
test('real server serves the isolated account page, accepts customer sessions and preserves owner controls',async t=>{
 const {spawn}=require('node:child_process');
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'unit501-account-server-'));
 const probe=http.createServer();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));
 const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
 const root='http://127.0.0.1:'+port;
 const child=spawn(process.execPath,['server.js'],{cwd:path.resolve(__dirname,'..'),env:{...process.env,PORT:String(port),API_SPORTS_KEY:'',UNIT501_ENABLE_ROSTER_SWEEPS:'0',UNIT501_CUSTOMER_ACCOUNTS:'1',UNIT501_PUBLIC_ORIGIN:root,UNIT501_ACCOUNT_DATA_DIR:dir,UNIT501_BETA_INVITE:invite,UNIT501_PRIVATE_PASSWORD:'owner-password-123456789'},stdio:['ignore','pipe','pipe']});
 t.after(async()=>{if(child.exitCode===null){const exited=new Promise(resolve=>child.once('exit',resolve));child.kill();await exited;}await fs.rm(dir,{recursive:true,force:true});});
 await new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(Error('Account test server did not start.')),5000);
  child.stdout.on('data',data=>{if(String(data).includes('running on port')){clearTimeout(timer);resolve();}});
  child.once('error',error=>{clearTimeout(timer);reject(error);});
  child.once('exit',()=>{clearTimeout(timer);reject(Error('Account test server exited.'));});
 });
 let response=await fetch(root+'/');assert.equal(response.status,401);await response.text();
 response=await fetch(root+'/account.html');assert.equal(response.status,200);assert.ok(response.headers.get('content-security-policy').includes("script-src 'self'"));assert.match(await response.text(),/Your picks/);
 for(const asset of ['account.js','account.css','browser-storage.js']){response=await fetch(root+'/'+asset);assert.equal(response.status,200);await response.text();}
 response=await fetch(root+'/api/account/signup',{method:'POST',headers:{Origin:root,'Content-Type':'application/json'},body:JSON.stringify({email:'server@example.com',password,invite})});
 assert.equal(response.status,201);const cookie=response.headers.get('set-cookie').split(';')[0],user=(await response.json()).user;
 response=await fetch(root+'/?userId=owner',{headers:{Cookie:cookie}});assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');const html=await response.text();assert.match(html,/Football Command Center/);assert.ok(html.includes('data-unit501-scope="customer:'+user.id+'"'));
 response=await fetch(root+'/account.html');assert.match(await response.text(),/data-unit501-scope="guest"/);
 response=await fetch(root+'/',{headers:{Authorization:'Basic '+Buffer.from('jr:owner-password-123456789').toString('base64')}});assert.match(await response.text(),/data-unit501-scope="owner"/);
 response=await fetch(root+'/api/provider-usage',{headers:{Cookie:cookie}});assert.equal(response.status,403);assert.equal(response.headers.get('www-authenticate'),null);await response.text();
 response=await fetch(root+'/api/provider-usage',{headers:{Authorization:'Basic '+Buffer.from('jr:owner-password-123456789').toString('base64')}});assert.equal(response.status,200);await response.text();
});
