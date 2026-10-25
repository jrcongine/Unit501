'use strict';
// Invite-only customer foundation. One Node process, one durable private directory.
const fs=require('node:fs/promises');
const path=require('node:path');
const {randomBytes,randomUUID,createHash,timingSafeEqual,scrypt:derive}=require('node:crypto');
const {promisify}=require('node:util');
const scrypt=promisify(derive);
const KEYS=['unit501:war-room:v1','unit501-score-archive-v1'];
const SESSION_MS=7*86400000;
const hash=value=>createHash('sha256').update(value).digest('hex');
const equal=(a,b)=>timingSafeEqual(Buffer.from(hash(a)),Buffer.from(hash(b)));
const fault=(status,message)=>Object.assign(new Error(message),{status});
const email=value=>typeof value==='string'?value.trim().toLowerCase():'';
const validEmail=value=>value.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const validPassword=value=>typeof value==='string'&&value.length>=12&&Buffer.byteLength(value)<=256;
function validateRecords(records){
 if(!records||typeof records!=='object'||Array.isArray(records)||Object.keys(records).some(k=>!KEYS.includes(k)))throw fault(400,'Invalid saved records.');
 for(const [key,value] of Object.entries(records)){
  if(typeof value!=='string')throw fault(400,'Saved records must contain exported JSON text.');
  let parsed;try{parsed=JSON.parse(value);}catch{throw fault(400,'Saved records must contain valid JSON.');}
  if(key===KEYS[0]&&(!Array.isArray(parsed)||parsed.length>250))throw fault(400,'Invalid War Room archive.');
  if(key===KEYS[1]&&(!parsed||parsed.schema!==1||!Array.isArray(parsed.snapshots)))throw fault(400,'Invalid forecast archive.');
 }
 if(Buffer.byteLength(JSON.stringify(records))>1024*1024)throw fault(413,'Saved records exceed the 1 MB account limit.');
 return records;
}
function createAccounts({env=process.env,now=Date.now}={}){
 const enabled=env.UNIT501_CUSTOMER_ACCOUNTS==='1';
 let origin,filename;
 if(enabled){
  const location=new URL(env.UNIT501_PUBLIC_ORIGIN||'invalid:');
  if(!['https:','http:'].includes(location.protocol)||location.username||location.password||location.pathname!=='/'||location.search||location.hash||
    (location.protocol!=='https:'&&!['localhost','127.0.0.1','[::1]'].includes(location.hostname)))throw Error('Customer accounts require a public HTTPS origin (HTTP loopback only for development).');
  origin=location.origin;
  if(!path.isAbsolute(env.UNIT501_ACCOUNT_DATA_DIR||''))throw Error('Customer accounts require an absolute private durable data directory.');
  const dir=path.resolve(env.UNIT501_ACCOUNT_DATA_DIR),publicDir=path.resolve(__dirname,'public');
  if(dir===publicDir||dir.startsWith(publicDir+path.sep)||publicDir.startsWith(dir+path.sep))throw Error('Account data must be outside the public application directory.');
  filename=path.join(dir,'accounts.json');
 }
 let queue=Promise.resolve();
 // Each mutation reads, validates and atomically replaces one store under this lock.
 function serialized(fn){const result=queue.then(fn);queue=result.catch(()=>{});return result;}
 async function read(){
  try{
   const data=JSON.parse(await fs.readFile(filename,'utf8'));
   if(data.schema!==1||!Array.isArray(data.users)||!Array.isArray(data.sessions))throw Error('Invalid account store.');
   return data;
  }catch(e){if(e.code==='ENOENT')return {schema:1,users:[],sessions:[]};throw e;}
 }
 async function write(data){
  await fs.mkdir(path.dirname(filename),{recursive:true,mode:0o700});
  const temp=filename+'.'+randomBytes(12).toString('hex')+'.tmp';
  let file;
  try{
   file=await fs.open(temp,'wx',0o600);await file.writeFile(JSON.stringify(data));await file.sync();await file.close();file=null;
   await fs.rename(temp,filename);
   const directory=await fs.open(path.dirname(filename),'r');try{await directory.sync();}finally{await directory.close();}
  }finally{if(file)await file.close();await fs.unlink(temp).catch(()=>{});}
 }
 const attempts=new Map();
 function limit(key,max,window=15*60000){
  const at=now();
  for(const [k,v] of attempts)if(v.until<=at)attempts.delete(k);
  let entry=attempts.get(key);
  if(!entry){if(attempts.size>=5000)throw fault(429,'Too many requests. Try again later.');entry={count:0,until:at+window};attempts.set(key,entry);}
  if(++entry.count>max)throw fault(429,'Too many requests. Try again later.');
 }
 function token(req){const value=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('unit501_session='))?.slice(16);return /^[a-f0-9]{64}$/.test(value||'')?value:null;}
 async function session(req){
  if(!enabled)return null;
  const raw=token(req);if(!raw)return null;
  let data;try{data=await serialized(read);}catch{throw fault(503,'Customer account service unavailable.');}
  const saved=data.sessions.find(s=>s.tokenHash===hash(raw)&&s.expiresAt>now());
  const user=saved&&data.users.find(u=>u.id===saved.userId&&u.disabled!==true);
  return user?{id:user.id,email:user.email,access:'beta'}:null;
 }
 function cookie(value,maxAge=SESSION_MS/1000){return 'unit501_session='+value+'; Path=/; HttpOnly; SameSite=Strict; Max-Age='+maxAge+(origin?.startsWith('https:')?'; Secure':'');}
 async function issue(data,user){
  const raw=randomBytes(32).toString('hex');
  data.sessions=data.sessions.filter(s=>s.expiresAt>now());
  const existing=data.sessions.filter(s=>s.userId===user.id).sort((a,b)=>b.expiresAt-a.expiresAt);
  const keep=new Set(existing.slice(0,4).map(s=>s.tokenHash));
  data.sessions=data.sessions.filter(s=>s.userId!==user.id||keep.has(s.tokenHash));
  data.sessions.push({userId:user.id,tokenHash:hash(raw),expiresAt:now()+SESSION_MS});
  await write(data);return raw;
 }
 async function body(req){
  if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||''))throw fault(415,'Send JSON data.');
  let size=0;const chunks=[];
  for await(const chunk of req){size+=chunk.length;if(size>1100000)throw fault(413,'Request is too large.');chunks.push(chunk);}
  try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw fault(400,'Invalid JSON.');}
 }
 function send(res,status,value){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value));}
 async function handle(req,res){
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(!pathname.startsWith('/api/account/'))return false;
  if(!enabled){send(res,503,{error:'Customer accounts are not enabled yet.'});return true;}
  try{
   if(!['GET','POST','PUT'].includes(req.method))throw fault(405,'Method not allowed.');
   if(req.method!=='GET'&&req.headers.origin!==origin)throw fault(403,'Open the account page on this site and try again.');
   const remote=req.socket?.remoteAddress||'unknown';
   if(['/api/account/signup','/api/account/login'].includes(pathname)){
    if(req.method!=='POST')throw fault(405,'Use POST.');
    // Do not trust forwarded IP headers. This also caps aggregate authentication work behind a proxy.
    limit('auth-ip:'+remote,40);
    const input=await body(req),address=email(input?.email);
    limit('auth-email:'+address,10);
    if(!validEmail(address)||!validPassword(input?.password))throw fault(400,'Enter an email and a password of at least 12 characters (up to 256 bytes).');
    if(pathname.endsWith('/signup')){
     const invitation=env.UNIT501_BETA_INVITE;
     if(typeof invitation!=='string'||invitation.length<32||typeof input.invite!=='string'||!equal(input.invite,invitation))throw fault(403,'A valid beta invitation is required.');
     const salt=randomBytes(16).toString('hex'),passwordHash=(await scrypt(input.password,salt,64)).toString('hex');
     await serialized(async()=>{
      const data=await read();
      if(data.users.length>=100||data.users.some(u=>u.email===address))throw fault(409,'Unable to create this account. Try signing in or contact the owner.');
      const user={id:randomUUID(),email:address,salt,passwordHash,createdAt:now(),saved:{revision:0,records:{},updatedAt:null}};
      data.users.push(user);res.setHeader('Set-Cookie',cookie(await issue(data,user)));
      send(res,201,{user:{id:user.id,email:user.email,access:'beta'}});
     });
    }else{
     // Scrypt runs for unknown users too; authentication errors do not identify registered addresses.
     const data=await serialized(read),user=data.users.find(u=>u.email===address&&u.disabled!==true);
     const derived=(await scrypt(input.password,user?.salt||'00000000000000000000000000000000',64)).toString('hex');
     if(!user||!equal(derived,user.passwordHash))throw fault(401,'Email or password is incorrect.');
     await serialized(async()=>{const latest=await read(),current=latest.users.find(u=>u.id===user.id&&u.disabled!==true);if(!current)throw fault(401,'Sign in again.');res.setHeader('Set-Cookie',cookie(await issue(latest,current)));});
     send(res,200,{user:{id:user.id,email:user.email,access:'beta'}});
    }
    return true;
   }
   const user=await session(req);if(!user)throw fault(401,'Sign in to your customer account.');
   limit('account:'+user.id,120,60000);
   if(pathname==='/api/account/me'&&req.method==='GET'){send(res,200,{user});return true;}
   if(pathname==='/api/account/logout'&&req.method==='POST'){
    const raw=token(req);await serialized(async()=>{const data=await read();data.sessions=data.sessions.filter(s=>s.tokenHash!==hash(raw));await write(data);});
    res.setHeader('Set-Cookie',cookie('',0));send(res,200,{ok:true});return true;
   }
   if(pathname==='/api/account/records'&&['GET','PUT'].includes(req.method)){
    const input=req.method==='PUT'?await body(req):null;
    if(req.method==='PUT'){
     if(!input||!Number.isSafeInteger(input.revision)||input.revision<0)throw fault(400,'Saved record revision required.');
     validateRecords(input.records);
    }
    await serialized(async()=>{
     const data=await read(),current=data.users.find(u=>u.id===user.id&&u.disabled!==true);if(!current)throw fault(401,'Sign in again.');
     if(input){
      if(input.revision!==current.saved.revision)throw fault(409,'Saved records changed on another device. Reload before saving.');
      current.saved={revision:current.saved.revision+1,records:input.records,updatedAt:now()};await write(data);
     }
     send(res,200,current.saved);
    });return true;
   }
   throw fault(404,'Account route not found.');
  }catch(error){send(res,error.status||503,{error:error.status?error.message:'Account service unavailable. Existing records have been retained.'});}
  return true;
 }
 const customerAPIs=new Set(['/api/games','/api/leagues','/api/odds','/api/markets','/api/player-stats','/api/team-stats','/api/team-games','/api/rankings','/api/availability','/api/player-ratings','/api/game-venue','/api/weather','/api/fanduel','/api/fanduel-props','/api/outside-picks','/api/betting-splits','/api/nba/games','/api/nba/context','/api/nba/odds','/api/nba/props']);
 async function allowCustomer(req,knownUser){
  if(!enabled||req.method!=='GET')return false;
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(pathname.startsWith('/api/')&&!customerAPIs.has(pathname))return false;
  const user=knownUser||await session(req);if(!user)return false;
  if(pathname.startsWith('/api/'))limit('customer-api:'+user.id,120,60000);
  return true;
 }
 return {enabled,handle,session,allowCustomer};
}
module.exports={createAccounts,validateRecords};
