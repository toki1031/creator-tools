import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost } from '../functions/api/research-production.js';
test('Research AI never marks model-only knowledge as externally verified',async()=>{
 const env={AI:{run:async()=>({response:JSON.stringify({backgroundKnowledge:['遊びは親子の交流機会になり得る'],unresolvedClaims:['特定月齢の発達目安'],safetyFlags:['安全な姿勢を確認'],suggestedSourceTypes:['公的な乳幼児発達情報']})})}};
 const request=new Request('https://example.test/api/research-production',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({requestText:'乳児の遊び',studioProfile:{researchPolicy:'安全性優先'}})});
 const response=await onRequestPost({request,env}); const body=await response.json();
 assert.equal(response.status,200); assert.equal(body.research.externallyVerified,false); assert.deepEqual(body.research.evidence,[]); assert.match(body.research.disclaimer,/外部サイト/); assert.match(body.research.unresolvedClaims.join(' '),/発達/);
});