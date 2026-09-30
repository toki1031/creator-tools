import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeLegacyAutoProductionProject } from '../autoProductionCompatibility.js';

const staleProject = {
  id:'nightingale-old',
  autoProduction:{mode:'production-request'},
  scenes:[
    {id:'scene-1',order:1,text:'↓',speechText:'↓',subtitleText:'↓',productionDirection:{visualDirection:'現代。\n正しいことを説明しているのに、相手に十分伝わっていない場面。',assetType:'modern-visual',purpose:'',rules:[]}},
    {id:'scene-3',order:3,text:'',speechText:'',subtitleText:'',productionDirection:{visualDirection:'戦争後。\nナイチンゲールが記録・報告書などを調べていることを示す。',assetType:'other',purpose:'',rules:[]}},
    {id:'scene-5',order:5,text:'',speechText:'',subtitleText:'',productionDirection:{visualDirection:'統計を「見える形」にしたことを示す。\nここは可能な限り確認可能な実物史料を使用する。',assetType:'historical-source',purpose:'',rules:[]}},
    {id:'scene-9',order:9,text:'',speechText:'',subtitleText:'',productionDirection:{visualDirection:'今日できる一歩。\n伝わっていない説明に「数字・具体例・比較」のどれか一つを加える。\n■素材の判断\n実物史料を優先。\n■Scene 5の重要指定\nナイチンゲールの統計図は、\n1858年前後の実物史料を使う。\n利用条件・出典を確認できない場合は、\n勝手に代替せず確認対象として止める。',assetType:'historical-source',purpose:'',rules:[]}}
  ],
  productionBrief:{
    narrationGuidance:['↓'],
    bgmGuidance:['静かなドキュメンタリーBGM'],
    sceneDirectives:[
      {sceneId:'scene-1',visualDirection:'現代。\n正しいことを説明しているのに、相手に十分伝わっていない場面。',assetType:'modern-visual',purpose:'',rules:[]},
      {sceneId:'scene-3',visualDirection:'戦争後。\nナイチンゲールが記録・報告書などを調べていることを示す。',assetType:'other',purpose:'',rules:[]},
      {sceneId:'scene-5',visualDirection:'統計を「見える形」にしたことを示す。\nここは可能な限り確認可能な実物史料を使用する。',assetType:'historical-source',purpose:'',rules:[]},
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
  assert.equal(result.project.scenes[2].productionDirection.assetType,'historical-source');
  assert.match(result.project.scenes[2].productionDirection.searchHint,/ナイチンゲール/);
  assert.match(result.project.scenes[2].productionDirection.searchHint,/1858/);
  assert.ok(result.project.scenes[2].productionDirection.rules.some(v=>v.includes('出典')));
  assert.equal(result.project.scenes[3].productionDirection.assetType,'modern-visual');
  assert.doesNotMatch(result.project.scenes[3].productionDirection.visualDirection,/素材の判断|Scene 5/);
  assert.deepEqual(result.project.productionBrief.narrationGuidance,[]);
  assert.equal(result.project.productionBrief.sceneDirectives[1].assetType,'ai-reconstruction');
  assert.equal(result.project.productionBrief.sceneDirectives[2].assetType,'historical-source');
  assert.match(result.project.productionBrief.sceneDirectives[2].searchHint,/ナイチンゲール/);
  assert.equal(result.project.productionBrief.sceneDirectives[3].assetType,'modern-visual');
  assert.equal(result.project.bgm.source,'procedural');
  assert.equal(result.project.bgm.procedural.preset,'calm-documentary');
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

test('does not replace an existing BGM while repairing a legacy production request',()=>{
  const project={
    id:'p-bgm',
    autoProduction:{mode:'production-request'},
    bgm:{source:'upload',audioData:'data:audio/wav;base64,AA==',title:'manual'},
    scenes:[],
    productionBrief:{bgmGuidance:['静かなドキュメンタリーBGM'],sceneDirectives:[]}
  };
  const result=normalizeLegacyAutoProductionProject(project);
  assert.equal(result.project.bgm.source,'upload');
  assert.equal(result.project.bgm.audioData,'data:audio/wav;base64,AA==');
});
