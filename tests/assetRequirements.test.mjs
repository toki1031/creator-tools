import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAssetRequirement, buildAssetRequirements } from '../assetRequirements.js';

const scene = (order, assetType, visualDirection, rules = []) => ({
  id:`scene-${order}`, order,
  productionDirection:{ assetType, visualDirection, purpose:'', motionGuidance:'', rules }
});

test('plans the Nightingale historical chart as a verified historical source', () => {
  const requirement = buildAssetRequirement(scene(5, 'historical-source', '1858年の実物統計史料を使う。', ['AI生成した偽の統計図で代用しない']));
  assert.equal(requirement.requestedType, 'historical-source');
  assert.equal(requirement.sourceRequirement, 'primary-source-preferred');
  assert.equal(requirement.rightsRequirement, 'verify-before-use');
  assert.equal(requirement.historicalAccuracyRequired, true);
  assert.equal(requirement.generatedContentDisclosureRequired, false);
  assert.equal(requirement.status, 'planned');
  assert.deepEqual(requirement.prohibitedContent, ['AI生成した偽の統計図で代用しない']);
});

test('keeps historical reconstruction distinct from an actual historical source', () => {
  const requirement = buildAssetRequirement(scene(2, 'ai-reconstruction', 'クリミア戦争期の病院を再現する。', ['実写史料として扱わない']));
  assert.equal(requirement.requestedType, 'ai-reconstruction');
  assert.equal(requirement.sourceRequirement, 'generated-reconstruction');
  assert.equal(requirement.rightsRequirement, 'commercial-use-safe');
  assert.equal(requirement.historicalAccuracyRequired, true);
  assert.equal(requirement.generatedContentDisclosureRequired, true);
});

test('plans a modern visual without adding historical claims', () => {
  const requirement = buildAssetRequirement(scene(8, 'modern-visual', '現代へ戻り、簡単な図・比較・具体例を示す。'));
  assert.equal(requirement.requestedType, 'modern-visual');
  assert.equal(requirement.queryHint, '現代へ戻り、簡単な図・比較・具体例を示す。');
  assert.equal(requirement.historicalAccuracyRequired, false);
  assert.equal(requirement.status, 'planned');
});

test('ambiguous requirements stop before automatic acquisition', () => {
  const requirement = buildAssetRequirement(scene(9, 'other', '')); 
  assert.equal(requirement.status, 'needs-review');
  assert.match(requirement.stopReason, /素材種別/);
  assert.match(requirement.stopReason, /検索意図/);
});

test('batch planner is pure and does not mutate scenes', () => {
  const scenes = [scene(2,'ai-reconstruction','病院再現'), scene(5,'historical-source','1858年の実物統計史料')];
  const before = structuredClone(scenes);
  const result = buildAssetRequirements(scenes);
  assert.equal(result.length, 2);
  assert.deepEqual(scenes, before);
  assert.ok(scenes.every(item => !('assetRequirement' in item)));
});
