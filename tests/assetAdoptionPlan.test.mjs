import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAssetAdoptionPlan, buildAssetAdoptionPlans } from '../assetAdoptionPlan.js';

const scene = { id: 'scene-5', order: 5 };
function entry(status, suffix = 'a') {
  return {
    candidate: {
      provider: 'library-of-congress',
      title: `Nightingale chart ${suffix}`,
      sourcePage: `https://www.loc.gov/item/${suffix}/`,
      previewUrl: `https://tile.loc.gov/${suffix}.jpg`,
      rightsAdvisory: `rights-${suffix}`
    },
    evaluation: { status, autoAdoptable: false, requestedType: 'historical-source', reasons: [] }
  };
}

test('one eligible candidate becomes a ready non-auto-applying plan with provenance', () => {
  const plan = buildAssetAdoptionPlan(scene, [entry('eligible')]);
  assert.equal(plan.status, 'ready');
  assert.equal(plan.autoApply, false);
  assert.equal(plan.candidate.sourcePage, 'https://www.loc.gov/item/a/');
  assert.equal(plan.candidate.rightsAdvisory, 'rights-a');
  assert.equal(plan.candidate.evaluation.autoAdoptable, false);
});

test('needs-review candidate cannot become ready', () => {
  const plan = buildAssetAdoptionPlan(scene, [entry('needs-review')]);
  assert.equal(plan.status, 'needs-review');
  assert.equal(plan.candidate, null);
});

test('rejected candidate cannot become ready', () => {
  const plan = buildAssetAdoptionPlan(scene, [entry('rejected')]);
  assert.equal(plan.status, 'blocked');
  assert.equal(plan.candidate, null);
});

test('multiple eligible candidates require selection instead of arbitrary ranking', () => {
  const plan = buildAssetAdoptionPlan(scene, [entry('eligible', 'a'), entry('eligible', 'b')]);
  assert.equal(plan.status, 'needs-selection');
  assert.equal(plan.candidates.length, 2);
  assert.equal(plan.candidate, null);
});

test('missing scene id blocks adoption plan', () => {
  const plan = buildAssetAdoptionPlan({ order: 1 }, [entry('eligible')]);
  assert.equal(plan.status, 'blocked');
});

test('batch builder is pure and leaves project-shaped inputs unchanged', () => {
  const input = [{ scene, evaluatedCandidates: [entry('eligible')] }];
  const before = JSON.stringify(input);
  const plans = buildAssetAdoptionPlans(input);
  assert.equal(plans.length, 1);
  assert.equal(JSON.stringify(input), before);
});


test('ready plan preserves structured rightsCheck without mutating candidate', () => {
  const item = entry('eligible');
  item.candidate.rightsStatus = 'rights-cleared-signal';
  item.candidate.rightsStatements = ['No known copyright restrictions'];
  item.candidate.rightsCheck = { status: 'rights-cleared-signal', signal: 'explicit-free-use' };
  const before = structuredClone(item);
  const plan = buildAssetAdoptionPlan(scene, [item]);
  assert.deepEqual(plan.candidate.rightsCheck, item.candidate.rightsCheck);
  assert.notEqual(plan.candidate.rightsCheck, item.candidate.rightsCheck);
  assert.equal(plan.candidate.rightsStatus, 'rights-cleared-signal');
  assert.deepEqual(item, before);
});
