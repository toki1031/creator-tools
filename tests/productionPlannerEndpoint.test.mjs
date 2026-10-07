import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost } from '../functions/api/plan-production.js';
test('planner endpoint refuses to pretend planning without AI binding',async()=>{
 const request=new Request('https://example.test/api/plan-production',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({requestText:'短い依頼'})});
 const response=await onRequestPost({request,env:{}});
 assert.equal(response.status,503);
});
test('planner endpoint returns normalized reviewable brief',async()=>{
 const env={AI:{run:async()=>({response:JSON.stringify({objective:'学び',sceneDirectives:[{purpose:'導入',narrationText:'説明',visualDirection:'明るい教室',assetType:'modern-visual'}]})})}};
 const request=new Request('https://example.test/api/plan-production',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({requestText:'学び動画',studioProfile:{narrationDirection:'やさしく',reviewFocus:['安全性']}})});
 const response=await onRequestPost({request,env}); const body=await response.json();
 assert.equal(response.status,200); assert.equal(body.source,'workers-ai-planner'); assert.equal(body.brief.sceneDirectives[0].sceneId,'scene-1'); assert.match(body.brief.qaCriteria.join(' '),/外部調査/); assert.match(body.brief.globalRules.join(' '),/安全性/);
});