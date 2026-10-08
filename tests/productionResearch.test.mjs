import test from 'node:test';
import assert from 'node:assert/strict';
import { needsResearchStage, researchProductionRequest } from '../productionResearch.js';

test('Education safety/development requests trigger Research AI without baby hardcoding in architecture',()=>{
 assert.equal(needsResearchStage('3歳向けの運動遊びを紹介して','education'),true);
 assert.equal(needsResearchStage('生後3か月の赤ちゃんの遊び','education'),true);
 assert.equal(needsResearchStage('タイトルだけ表示して','education'),false);
});

test('Research client passes Education Studio policy and returns explicit verification state',async()=>{
 let sent;
 const fetchImpl=async(_url,options)=>{sent=JSON.parse(options.body);return {ok:true,json:async()=>({research:{mode:'model-background-only',externallyVerified:false,evidence:[],unresolvedClaims:['月齢別の発達目安は確認が必要']}})}};
 const result=await researchProductionRequest('月齢に合う遊び','education',{fetchImpl});
 assert.equal(result.ok,true); assert.equal(sent.studioProfile.id,'education'); assert.match(sent.studioProfile.researchPolicy,/安全性/);
 assert.equal(result.research.externallyVerified,false); assert.deepEqual(result.research.evidence,[]);
});