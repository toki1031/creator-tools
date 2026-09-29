import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeLegacyAutoProductionProject } from '../autoProductionCompatibility.js';

const staleProject = {
  id:'nightingale-old',
  autoProduction:{mode:'production-request'},
  scenes:[
    {id:'scene-1',order:1,text:'↓',speechText:'↓',subtitleText:'↓',productionDirection:{visualDirection:'現代。\n正しいことを説明しているのに、相手に十分伝わっていない場面。',assetType:'modern-visual',purpose:'',rules:[]}},
    {id:'scene-3',order:3,text:'',speechText:'',subtitleText:'',productionDirection:{visualDirection:'戦争後。\nナイチンゲールが記録・報告書などを調べていることを示す。',assetType:'other',purpose:'',rules:[]}},
    {id:'scene-9',order:9,text:'',speechText:'',subtitleText:'',productionDirection:{visualDirection:'今日できる一歩。\n伝わっていない説明に「数字・具体例・比較」のどれか一つを加える。\n■素材の判断\n実物史料を優先。\n■Scene 5の重要指定\n1858年前後の実物史料を使う。',assetType:'historical-source',purpose:'',rules:[]}}
  ],
  productionBrief:{
    narrationGuidance:['↓'],
    sceneDirectives:[
      {sceneId:'scene-1',visualDirection:'現代。\n正しいことを説明しているのに、相手に十分伝わっていない場面。',assetType:'modern-visual',purpose:'',rules:[]},
      {sceneId:'scene-3',visualDirection:'戦争後。\nナイチンゲールが記録・報告書などを調べていることを示す。',assetType:'other',purpose:'',rules:[]},
      {sceneId:'scene-9',visualDirection:'今日できる一歩。\n伝わっていない説明に「数字・具体例・比較」のどれか一つを加える。\n■素材の判断\n実物史料を優先。',assetType:'historical-source',purpose:'',rules:[]}
    ]
  }
};

test('repairs stale Nightingale production-request without mutating the source object',()=>{
  const original=structuredClone(staleProject);
  const result=normalizeLegacyAutoProductionProject(staleProject);
  assert.equal(result.changed,true);
  assert.deepEqual(staleProject,original);
  assert.equal(result.project.scenes[0].text,'');
  assert.equal(result.project.scenes[0].speechText,'');
  assert.equal(result.project.scenes[0].subtitleText,'');
  assert.equal(result.project.scenes[1].productionDirection.assetType,'ai-reconstruction');
  assert.equal(result.project.scenes[2].productionDirection.assetType,'modern-visual');
  assert.doesNotMatch(result.project.scenes[2].productionDirection.visualDirection,/素材の判断|Scene 5/);
  assert.deepEqual(result.project.productionBrief.narrationGuidance,[]);
  assert.equal(result.project.productionBrief.sceneDirectives[1].assetType,'ai-reconstruction');
  assert.equal(result.project.productionBrief.sceneDirectives[2].assetType,'modern-visual');
});

test('keeps clean explicit asset types and manual projects unchanged',()=>{
  const cleanProject={id:'p',autoProduction:{mode:'production-request'},scenes:[{id:'s1',productionDirection:{visualDirection:'確認可能な実物史料',assetType:'historical-source'}}]};
  const cleanResult=normalizeLegacyAutoProductionProject(cleanProject);
  assert.equal(cleanResult.changed,false);
  assert.equal(cleanResult.project.scenes[0].productionDirection.assetType,'historical-source');

  const manual={id:'manual',scenes:[{id:'s1',text:'↓',productionDirection:{visualDirection:'x',assetType:'other'}}]};
  const manualResult=normalizeLegacyAutoProductionProject(manual);
  assert.equal(manualResult.changed,false);
  assert.strictEqual(manualResult.project,manual);
});
