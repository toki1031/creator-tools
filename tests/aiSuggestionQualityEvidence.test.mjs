import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeAiSuggestionEvidence, summarizeCreatorAiEvidence } from '../aiSuggestionQualityEvidence.js';

function evaluation(overrides = {}) {
  return {
    evaluationVersion: '0.44',
    decisionType: 'scene-motion',
    totalExamples: 8,
    evaluated: 6,
    matched: 4,
    changed: 2,
    skipped: 2,
    accuracy: 4 / 6,
    outcomes: [
      { projectId: 'p1' },
      { projectId: 'p2' },
      { projectId: 'p3' },
      { projectId: 'p1' },
      { projectId: 'p2' },
      { projectId: 'p3' }
    ],
    ...overrides
  };
}

test('marks cross-project evidence as measured without judging accuracy quality', () => {
  const result = summarizeAiSuggestionEvidence(evaluation());
  assert.equal(result.qualityEvidenceVersion, '0.45');
  assert.equal(result.status, 'measured');
  assert.equal(result.hasEnoughEvidence, true);
  assert.equal(result.evaluatedProjects, 3);
  assert.equal(result.accuracy, 4 / 6);
  assert.deepEqual(result.thresholds, { minEvaluated: 5, minProjects: 3 });
});

test('keeps evidence insufficient when evaluations or projects are too few', () => {
  const fewEvaluations = summarizeAiSuggestionEvidence(evaluation({
    evaluated: 4,
    matched: 3,
    changed: 1,
    accuracy: 0.75,
    outcomes: [{ projectId: 'p1' }, { projectId: 'p2' }, { projectId: 'p3' }, { projectId: 'p1' }]
  }));
  assert.equal(fewEvaluations.status, 'insufficient-evidence');

  const fewProjects = summarizeAiSuggestionEvidence(evaluation({
    outcomes: Array.from({ length: 6 }, (_, index) => ({ projectId: index % 2 ? 'p1' : 'p2' }))
  }));
  assert.equal(fewProjects.status, 'insufficient-evidence');
});

test('rejects malformed or inconsistent metrics safely', () => {
  const malformed = summarizeAiSuggestionEvidence({
    decisionType: 'scene-transition',
    totalExamples: 'bad',
    evaluated: 5,
    matched: 5,
    changed: 1,
    skipped: -2,
    accuracy: 1.2,
    outcomes: [{ projectId: 'p1' }, { projectId: 'p2' }, { projectId: 'p3' }]
  });
  assert.equal(malformed.status, 'insufficient-evidence');
  assert.equal(malformed.totalExamples, 0);
  assert.equal(malformed.skipped, 0);
  assert.equal(malformed.internallyConsistent, false);
  assert.equal(malformed.hasEnoughEvidence, false);
});

test('summarizes motion and transition independently and does not mutate input', () => {
  const report = { motion: evaluation(), transition: evaluation({ decisionType: 'scene-transition' }) };
  const original = structuredClone(report);
  const result = summarizeCreatorAiEvidence(report);
  assert.equal(result.motion.status, 'measured');
  assert.equal(result.transition.status, 'measured');
  assert.deepEqual(report, original);
});
