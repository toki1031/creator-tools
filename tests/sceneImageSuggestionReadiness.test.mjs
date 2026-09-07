import test from 'node:test';
import assert from 'node:assert/strict';
import { assessSceneImageSuggestionReadiness } from '../sceneImageSuggestionReadiness.js';

function report(overrides = {}) {
  return {
    evaluationVersion: '0.64',
    summary: {
      evaluated: 5,
      evaluatedProjects: 3,
      correct: 3,
      incorrect: 2,
      ties: 0,
      pairwiseAccuracy: 0.6,
      ...overrides
    }
  };
}

test('becomes ready only at the default evidence and accuracy thresholds', () => {
  const ready = assessSceneImageSuggestionReadiness(report());
  assert.equal(ready.readinessPolicyVersion, '0.68');
  assert.equal(ready.ready, true);
  assert.equal(ready.reason, 'ready');
  assert.deepEqual(ready.thresholds, { minEvaluated: 5, minProjects: 3, minAccuracy: 0.6 });

  assert.equal(assessSceneImageSuggestionReadiness(report({ evaluated: 4, correct: 3, incorrect: 1, pairwiseAccuracy: 0.75 })).ready, false);
  assert.equal(assessSceneImageSuggestionReadiness(report({ evaluatedProjects: 2 })).ready, false);
  assert.equal(assessSceneImageSuggestionReadiness(report({ correct: 2, incorrect: 3, pairwiseAccuracy: 0.4 })).reason, 'accuracy-below-threshold');
});

test('rejects malformed or internally inconsistent evaluation safely', () => {
  assert.equal(assessSceneImageSuggestionReadiness(null).ready, false);
  assert.equal(assessSceneImageSuggestionReadiness({ summary: { evaluated: 5, evaluatedProjects: 3, correct: 3, incorrect: 2, ties: 0, pairwiseAccuracy: 'bad' } }).ready, false);
  assert.equal(assessSceneImageSuggestionReadiness(report({ correct: 5, incorrect: 5 })).reason, 'inconsistent-evaluation');
  assert.equal(assessSceneImageSuggestionReadiness(report({ pairwiseAccuracy: 0.8 })).reason, 'inconsistent-evaluation');
});

test('supports bounded configurable thresholds without mutating the report', () => {
  const input = report({ evaluated: 2, evaluatedProjects: 2, correct: 1, incorrect: 1, pairwiseAccuracy: 0.5 });
  const before = structuredClone(input);
  const result = assessSceneImageSuggestionReadiness(input, { minEvaluated: 2, minProjects: 2, minAccuracy: 0.5 });
  assert.deepEqual(input, before);
  assert.equal(result.ready, true);
  assert.equal(assessSceneImageSuggestionReadiness(report(), { minAccuracy: 9 }).ready, false);
  assert.equal(assessSceneImageSuggestionReadiness(report(), { minAccuracy: -9 }).ready, true);
});
