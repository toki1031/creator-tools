import test from 'node:test';
import assert from 'node:assert/strict';
import { buildScenesFromProductionBrief, applyProductionBriefScenes } from '../productionBriefScenes.js';

const directives = Array.from({ length: 9 }, (_, index) => ({
  sceneId: `scene-${index + 1}`,
  visualDirection: index === 4 ? '1858年の実物統計史料を使う。' : index === 7 ? '現代へ戻り、簡単な図・比較・具体例を示す。' : `Scene ${index + 1} visual`,
  purpose: index === 7 ? '史実紹介から現代への翻訳へ戻る' : `Scene ${index + 1} purpose`,
  assetType: index === 4 ? 'historical-source' : index === 7 ? 'modern-visual' : 'ai-reconstruction',
  motionGuidance: index === 4 ? '史料は静かに見せる' : 'slow zoom-in',
  rules: index === 4 ? ['AI生成した偽の統計図で代用しない'] : index === 5 ? ['架空の議会・政府高官向けプレゼン場面を作らない','ナイチンゲール一人だけで改革したように描かない'] : []
}));
const brief = { objective:'伝わる形にする', tone:'落ち着いた教育ドキュメンタリー', globalRules:[], subtitleGuidance:[], narrationGuidance:[], bgmGuidance:[], seGuidance:[], sceneDirectives: directives, qaCriteria:Array.from({length:10},(_,i)=>`QA ${i+1}`) };
const nightingaleDurations = [4.52,8.39,5.48,8.23,6.13,5.65,5.97,9.35,6.29];

test('builds nine runtime-compatible scenes from the Nightingale brief', () => {
  const scenes = buildScenesFromProductionBrief(brief, { targetDurationSec:60.01, sceneDurationsSec:nightingaleDurations });
  assert.equal(scenes.length, 9);
  assert.deepEqual(scenes.map(s=>s.order), [1,2,3,4,5,6,7,8,9]);
  assert.ok(scenes.every(s => 'text' in s && 'speechText' in s && 'durationSec' in s && 'imageData' in s && 'motion' in s && 'transition' in s));
  assert.equal(round(scenes.reduce((sum,s)=>sum+s.durationSec,0)), 60.01);
});

test('preserves production-only historical and safety directions without inventing media', () => {
  const scenes = buildScenesFromProductionBrief(brief, { targetDurationSec:60.01, sceneDurationsSec:nightingaleDurations });
  assert.equal(scenes[4].productionDirection.assetType, 'historical-source');
  assert.equal(scenes[4].motion, 'none');
  assert.ok(scenes[4].productionDirection.rules[0].includes('偽の統計図'));
  assert.ok(scenes[5].productionDirection.rules.some(rule=>rule.includes('架空の議会')));
  assert.equal(scenes[7].productionDirection.assetType, 'modern-visual');
  assert.match(scenes[7].productionDirection.purpose, /現代への翻訳/);
  assert.ok(scenes.every(s => s.imageData === ''));
});

test('does not mutate the existing manual project', () => {
  const originalScene = { id:'manual-1', order:1, text:'manual', speechText:'manual', durationSec:60, imageData:'data:image/png;base64,abc', motion:'pan-left', transition:'cut' };
  const project = { id:'p1', targetDurationSec:60.01, scenes:[originalScene], schemaVersion:4 };
  const result = applyProductionBriefScenes(project, brief, { sceneDurationsSec:nightingaleDurations });
  assert.equal(project.scenes[0], originalScene);
  assert.equal(project.scenes[0].text, 'manual');
  assert.equal(result.scenes.length, 9);
  assert.equal(result.productionBrief, brief);
});

test('empty brief is safe and leaves scene construction unused', () => {
  assert.deepEqual(buildScenesFromProductionBrief(null), []);
  const project = { id:'p1', scenes:[{id:'existing'}], targetDurationSec:60 };
  const result = applyProductionBriefScenes(project, { sceneDirectives:[] });
  assert.deepEqual(result.scenes, project.scenes);
  assert.notEqual(result, project);
});

function round(value){ return Math.round(value*100)/100; }

test('uses narration as subtitle text only when no explicit subtitle exists',()=>{
  const scenes=buildScenesFromProductionBrief({
    sceneDirectives:[
      {sceneId:'scene-1',narrationText:'ナレーション本文',subtitleText:'',visualDirection:'現代',assetType:'modern-visual'},
      {sceneId:'scene-2',narrationText:'読み上げ本文',subtitleText:'表示専用字幕',visualDirection:'資料',assetType:'document'}
    ]
  },{targetDurationSec:10});
  assert.equal(scenes[0].speechText,'ナレーション本文');
  assert.equal(scenes[0].subtitleText,'ナレーション本文');
  assert.equal(scenes[0].text,'ナレーション本文');
  assert.equal(scenes[1].speechText,'読み上げ本文');
  assert.equal(scenes[1].subtitleText,'表示専用字幕');
  assert.equal(scenes[1].text,'表示専用字幕');
});


test('AI reconstruction scenes inherit generic brief context without affecting modern scenes',()=>{
  const brief={
    objective:'ある歴史人物の実践を現代へ伝える',
    tone:'落ち着いた歴史ドキュメンタリー',
    globalRules:['当時として自然な服装・建物・道具にする','アニメ調にしない'],
    sceneDirectives:[
      {sceneId:'scene-1',visualDirection:'机で資料を分析する場面。',assetType:'ai-reconstruction',narrationText:'資料を分析した。',rules:[]},
      {sceneId:'scene-2',visualDirection:'現代の会議。',assetType:'modern-visual',narrationText:'今の仕事にもつながる。',rules:[]}
    ]
  };
  const scenes=buildScenesFromProductionBrief(brief,{targetDurationSec:10});
  assert.match(scenes[0].productionDirection.searchHint,/ある歴史人物の実践/);
  assert.match(scenes[0].productionDirection.searchHint,/当時として自然な服装/);
  assert.match(scenes[0].productionDirection.searchHint,/アニメ調にしない/);
  assert.equal(scenes[1].productionDirection.searchHint,'');
});


test('visual rules are scoped to the scene asset type',()=>{
  const brief={
    objective:'歴史上の出来事を現代へつなげる',
    tone:'documentary',
    globalRules:[
      '歴史Sceneは当時として自然にする',
      '19世紀として自然な服装、建物、家具にする',
      'アニメ調にしない',
      '現代Sceneでは現代の実写写真風にする',
      '現代の服装、会議室、PCを自然に使う',
      '歴史衣装などにしない',
      '各Sceneの画像は内容と一致させる'
    ],
    sceneDirectives:[
      {sceneId:'scene-1',visualDirection:'歴史再現。',assetType:'ai-reconstruction',narrationText:'歴史。',rules:[]},
      {sceneId:'scene-2',visualDirection:'現代の会議。',assetType:'modern-visual',narrationText:'現代。',rules:[]}
    ]
  };
  const scenes=buildScenesFromProductionBrief(brief,{targetDurationSec:10});
  const historical=scenes[0].productionDirection.searchHint;
  assert.match(historical,/19世紀として自然/);
  assert.match(historical,/アニメ調にしない/);
  assert.doesNotMatch(historical,/現代の服装/);
  assert.doesNotMatch(historical,/歴史衣装などにしない/);
  assert.match(historical,/各Sceneの画像は内容と一致/);
  assert.equal(scenes[1].productionDirection.searchHint,'');
});


test('visual rule section scope continues until another explicit section header',()=>{
  const brief={
    globalRules:[
      '歴史Sceneは当時として自然にする',
      '歴史衣装を使う',
      '現代Sceneでは現代の実写写真風にする',
      '歴史衣装などにしない',
      'PCを自然に使う'
    ],
    sceneDirectives:[
      {sceneId:'scene-1',visualDirection:'historical',assetType:'ai-reconstruction',narrationText:'a'},
      {sceneId:'scene-2',visualDirection:'modern',assetType:'modern-visual',narrationText:'b'}
    ]
  };
  const scenes=buildScenesFromProductionBrief(brief,{targetDurationSec:10});
  assert.match(scenes[0].productionDirection.searchHint,/歴史衣装を使う/);
  assert.doesNotMatch(scenes[0].productionDirection.searchHint,/歴史衣装などにしない/);
  assert.equal(scenes[1].productionDirection.searchHint,'');
});
