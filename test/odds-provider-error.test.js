const {test}=require('node:test'),assert=require('node:assert/strict');
const {errorForResponse}=require('../odds-provider-error');
test('public odds errors retain actionable codes without echoing provider secrets',()=>{
 const e=errorForResponse(401,{error_code:'OUT_OF_USAGE_CREDITS',message:'secret-key https://secret.example'});
 assert.match(e.publicMessage,/monthly usage credits exhausted/);
 assert.doesNotMatch(e.publicMessage,/secret/);
 assert.doesNotMatch(errorForResponse(422,{error_code:'INVALID_MARKET'}).publicMessage,/football/);
 assert.doesNotMatch(errorForResponse(500,{message:'secret'}).publicMessage,/secret/);
});
