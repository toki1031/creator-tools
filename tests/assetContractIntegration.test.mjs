import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeLocCandidate } from '../locAssetSearch.js';
import { evaluateAssetCandidate } from '../assetCandidateEvaluation.js';
import { buildAssetAdoptionPlan } from '../assetAdoptionPlan.js';

const requirement = { sceneId: 'scene-5', requestedType: 'historical-source', status: 'planned', prohibitedContent: [] };
const searchPlan = { sceneId: 'scene-5', requestedType: 'historical-source', status: 'ready', prohibitedContent: [] };
const scene = { id: 'scene-5', order: 5 };

function locItem() {
  return {
    id: 'https://www.loc.gov/item/123/',
    title: 'Historical statistical diagram',
    image_url: ['https://tile.loc.gov/example.jpg'],
    item: { rights_advisory: ['Rights & Access information available'] }
  };
}

test('Phase 2-C LoC output is understood directly by Phase 2-D without losing source or rights evidence', () => {
  const candidate = normalizeLocCandidate(locItem(), searchPlan);
  const evaluation = evaluateAssetCandidate(candidate, requirement, searchPlan);
  assert.equal(candidate.sourceUrl, 'https://www.loc.gov/item/123/');
  assert.ok(candidate.rightsStatements.length > 0);
  assert.equal(evaluation.status, 'needs-review');
  assert.equal(evaluation.reasons.includes('出典ページを確認できません'), false);
  assert.equal(evaluation.reasons.includes('権利情報を確認できません'), false);
  assert.equal(evaluation.reasons.includes('権利情報の追加確認が必要です'), true);
});

test('a real LoC needs-review candidate cannot become ready in Phase 2-E', () => {
  const candidate = normalizeLocCandidate(locItem(), searchPlan);
  const evaluation = evaluateAssetCandidate(candidate, requirement, searchPlan);
  const plan = buildAssetAdoptionPlan(scene, [{ candidate, evaluation }]);
  assert.equal(plan.status, 'needs-review');
  assert.equal(plan.candidate, null);
});

test('Phase 2-E preserves canonical sourceUrl and rightsStatements for an eligible compatible candidate', () => {
  const candidate = {
    ...normalizeLocCandidate(locItem(), searchPlan),
    rightsStatus: 'verified'
  };
  const evaluation = evaluateAssetCandidate(candidate, requirement, searchPlan);
  assert.equal(evaluation.status, 'eligible');
  const plan = buildAssetAdoptionPlan(scene, [{ candidate, evaluation }]);
  assert.equal(plan.status, 'ready');
  assert.equal(plan.candidate.sourceUrl, candidate.sourceUrl);
  assert.equal(plan.candidate.sourcePage, candidate.sourceUrl);
  assert.deepEqual(plan.candidate.rightsStatements, candidate.rightsStatements);
  assert.equal(plan.candidate.rightsStatus, 'verified');
});
