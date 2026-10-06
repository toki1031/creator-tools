import test from 'node:test';
import assert from 'node:assert/strict';
import { planProductionRequest } from '../productionPlanner.js';
import { createAutoProductionProject } from '../autoProductionProject.js';

test('short Education request is planned with Studio Profile and enters shared builder',async()=>{
  let sent;
  const fetchImpl=async(_url,options)=>{sent=JSON.parse(options.body);return {ok:true,json:async()=>({source:'workers-ai-planner',model:'test-model',brief:{objective:'親子遊びを紹介',tone:'やさしい',globalRules:['安全性を確認'],subtitleGuidance:[],narrationGuidance:['やさしく'],bgmGuidance:['やさしい教育'],seGuidance:[],qaCriteria:['外部調査済みとはみなさない'],sceneDirectives:[{sceneId:'scene-1',purpose:'導入',narrationText:'親子で楽しめる遊びを紹介します。',subtitleText:'親子で楽しむ',visualDirection:'明るく安全な室内で親子が遊ぶ',assetType:'modern-visual',motionGuidance:'zoom-in',rules:['安全な環境を描く']} ]}})}};
  const planned=await planProductionRequest('生後3か月の赤ちゃんにおすすめの遊びを動画にして','education',{fetchImpl});
  assert.equal(sent.studioProfile.id,'education');
  assert.match(sent.studioProfile.researchPolicy,/安全性/);
  const result=createAutoProductionProject({requestText:'生後3か月の赤ちゃんにおすすめの遊びを動画にして',genre:'education',platform:'instagram-reels',productionBrief:planned.brief,source:planned.source,model:planned.model});
  assert.equal(result.ok,true);
  assert.equal(result.project.studioProfileId,'education');
  assert.equal(result.project.autoProduction.source,'workers-ai-planner');
  assert.equal(result.project.autoProduction.model,'test-model');
  assert.equal(result.project.scenes.length,1);
  assert.equal(result.project.scenes[0].productionDirection.assetType,'modern-visual');
});

test('structured requests keep deterministic local parser path',()=>{
  const result=createAutoProductionProject({requestText:'Scene 1\nナレーション: テストです。\n映像: 明るい室内。',genre:'education'});
  assert.equal(result.ok,true);
  assert.equal(result.project.autoProduction.source,'local-parser');
});
