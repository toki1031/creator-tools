import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAssetSearchPlan, buildAssetSearchPlans } from '../assetSearchPlan.js';

const requirement = (type, queryHint, extra = {}) => ({
  sceneId:'scene-1', order:1, requestedType:type, queryHint,
  prohibitedContent:[], status:'planned', stopReason:'', ...extra
});

test('historical source uses archive-first plan and forbids generated fallback', () => {
  const plan = buildAssetSearchPlan(requirement('historical-source','1858年の実物統計史料を使う。', {
    sceneId:'scene-5', order:5, prohibitedContent:['AI生成した偽の統計図で代用しない']
  }));
  assert.equal(plan.status,'ready');
  assert.deepEqual(plan.queries,['1858年の実物統計史料を使う。']);
  assert.ok(plan.preferredSources.includes('official-archive'));
  assert.ok(plan.preferredSources.includes('library'));
  assert.equal(plan.allowGeneratedFallback,false);
  assert.ok(plan.rightsChecks.includes('verify-license-or-public-domain'));
  assert.ok(plan.acceptanceChecks.includes('not-ai-generated'));
  assert.deepEqual(plan.prohibitedContent,['AI生成した偽の統計図で代用しない']);
});

test('AI historical reconstruction is generation-only and never archival', () => {
  const plan = buildAssetSearchPlan(requirement('ai-reconstruction','クリミア戦争期の病院を再現する。'));
  assert.deepEqual(plan.preferredSources,['generated-reconstruction']);
  assert.equal(plan.allowGeneratedFallback,true);
  assert.ok(plan.acceptanceChecks.includes('not-presented-as-archival-material'));
  assert.ok(plan.acceptanceChecks.includes('generated-content-disclosed'));
});

test('modern visual does not force historical archives', () => {
  const plan = buildAssetSearchPlan(requirement('modern-visual','現代の会議室で説明が伝わっていない様子。'));
  assert.equal(plan.status,'ready');
  assert.ok(plan.preferredSources.includes('commercial-use-safe-stock'));
  assert.ok(!plan.preferredSources.includes('official-archive'));
});

test('needs-review from Phase 2-A remains blocked', () => {
  const plan = buildAssetSearchPlan(requirement('other','曖昧な素材', {
    status:'needs-review', stopReason:'素材種別が明確ではありません'
  }));
  assert.equal(plan.status,'blocked');
  assert.equal(plan.allowGeneratedFallback,false);
  assert.equal(plan.preferredSources.length,0);
  assert.match(plan.blockReason,/素材種別/);
});

test('missing query blocks search instead of inventing one', () => {
  const plan = buildAssetSearchPlan(requirement('historical-source',''));
  assert.equal(plan.status,'blocked');
  assert.deepEqual(plan.queries,[]);
  assert.match(plan.blockReason,/検索意図/);
});

test('batch planning does not mutate requirements', () => {
  const input = [requirement('historical-source','史料'), requirement('modern-visual','現代映像')];
  const before = structuredClone(input);
  const plans = buildAssetSearchPlans(input);
  assert.equal(plans.length,2);
  assert.deepEqual(input,before);
});
