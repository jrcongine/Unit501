'use strict';
const {createHash,timingSafeEqual}=require('node:crypto');
const digest=value=>createHash('sha256').update(value).digest();
function isOwner(req,env=process.env){
  const password=env.UNIT501_PRIVATE_PASSWORD;
  if(typeof password!=='string'||password.length<16)return false;
  const header=req.headers.authorization||'';
  let credentials='';
  if(header.startsWith('Basic ')&&header.length<4096)credentials=Buffer.from(header.slice(6),'base64').toString('utf8');
  return timingSafeEqual(digest(credentials),digest('jr:'+password));
}
function allowRequest(req,res,env=process.env){
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Robots-Tag','noindex, nofollow');
  // Health checks reveal no credentials and never call a paid provider.
  if(req.url==='/api/health'){
    res.writeHead(200,{'Content-Type':'application/json'});
    res.end(JSON.stringify({ok:true,private:true,liveData:Boolean(env.API_SPORTS_KEY)}));
    return false;
  }
  const password=env.UNIT501_PRIVATE_PASSWORD;
  if(!password || password.length<16){
    res.writeHead(503,{'Content-Type':'text/plain; charset=utf-8'});
    res.end('Unit 501 is private. The owner must configure a private password before access is enabled.');
    return false;
  }
  if(isOwner(req,env))return true;
  res.writeHead(401,{'WWW-Authenticate':'Basic realm="Unit 501 Private", charset="UTF-8"','Content-Type':'text/plain; charset=utf-8'});
  res.end('Private access only. Sign in with the owner credentials.');
  return false;
}
module.exports={allowRequest,isOwner};
