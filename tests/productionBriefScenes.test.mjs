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
