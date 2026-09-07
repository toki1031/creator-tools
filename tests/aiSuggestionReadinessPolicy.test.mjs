import test from 'node:test';
import assert from 'node:assert/strict';
import { assessAiSuggestionReadiness, assessCreatorAiSuggestionReadiness } from '../aiSuggestionReadinessPolicy.js';

function evidence(overrides = {}) {
  return {
    decisionType: 'scene-motion',
    status: 'measured',
    hasEnoughEvidence: true,
    internallyConsistent: true,
    accuracy: 0.8,
    evaluated: 10,
    evaluatedProjects: 4,
    ...overrides
  };
}

test('marks measured evidence ready only when accuracy meets the default threshold', () => {
  const ready = assessAiSuggestionReadiness(evidence({ accuracy: 0.6 }));
  assert.equal(ready.readinessPolicyVersion, '0.59');
  assert.equal(ready.ready, true);
  assert.equal(ready.reason, 'ready');
  assert.equal(ready.minAccuracy, 0.6);

  const low = assessAiSuggestionReadiness(evidence({ accuracy: 0.59 }));
  assert.equal(low.ready, false);
  assert.equal(low.reason, 'accuracy-below-threshold');
});

test('rejects insufficient, inconsistent and invalid evidence safely', () => {
  assert.equal(assessAiSuggestionReadiness(evidence({ status: 'insufficient-evidence', hasEnoughEvidence: false })).reason, 'insufficient-evidence');
  assert.equal(assessAiSuggestionReadiness(evidence({ internallyConsistent: false })).reason, 'inconsistent-evidence');
  assert.equal(assessAiSuggestionReadiness(evidence({ accuracy: null })).reason, 'invalid-accuracy');
  assert.equal(assessAiSuggestionReadiness(evidence({ accuracy: 2 })).reason, 'invalid-accuracy');
});

test('supports bounded configurable accuracy threshold', () => {
  assert.equal(assessAiSuggestionReadiness(evidence({ accuracy: 0.7 }), { minAccuracy: 0.75 }).ready, false);
  assert.equal(assessAiSuggestionReadiness(evidence({ accuracy: 0.7 }), { minAccuracy: 0.65 }).ready, true);
  assert.equal(assessAiSuggestionReadiness(evidence({ accuracy: 1 }), { minAccuracy: 2 }).minAccuracy, 1);
  assert.equal(assessAiSuggestionReadiness(evidence({ accuracy: 0 }), { minAccuracy: -1 }).minAccuracy, 0);
});

test('does not mutate input and summarizes both creator AI types', () => {
  const motion = evidence();
  const transition = evidence({ decisionType: 'scene-transition', accuracy: 0.7 });
  const report = { motion, transition };
  const snapshot = structuredClone(report);
  const result = assessCreatorAiSuggestionReadiness(report);
  assert.equal(result.motion.ready, true);
  assert.equal(result.transition.ready, true);
  assert.deepEqual(report, snapshot);
});
