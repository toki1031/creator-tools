import test from 'node:test';
import assert from 'node:assert/strict';
import { createAiSuggestionEvidenceSummary, createCreatorAiEvidenceSummary } from '../aiSuggestionEvidenceSummary.js';

function record(type, id, projectId, sceneId, label, text = 'scene') {
  return {
    id,
    decisionType: type,
    projectId,
    sceneId,
    context: { sceneText: text, sceneIndex: 0, durationSec: 4, platform: 'youtube', aspectRatio: '9:16' },
    proposal: {},
    finalDecision: type === 'scene-motion' ? { motion: label } : { transition: label },
    humanAction: { type: 'change' },
    source: { type: 'human', feature: 'scene-editor', version: 'test' },
    timestamp: '2026-09-07T00:00:00.000Z'
  };
}

function measuredEvaluation() {
  return {
    evaluated: 5,
    accuracy: 0.6,
    outcomes: [
      { projectId: 'p1' },
      { projectId: 'p2' },
      { projectId: 'p3' },
      { projectId: 'p1' },
      { projectId: 'p2' }
    ]
  };
}

const motion = [
  record('scene-motion', 'm1', 'p1', 's1', 'zoom-in'),
  record('scene-motion', 'm2', 'p2', 's2', 'none'),
  record('scene-motion', 'm3', 'p3', 's3', 'zoom-in'),
  record('scene-motion', 'm4', 'p4', 's4', 'none'),
  record('scene-motion', 'm5', 'p5', 's5', 'zoom-in')
];

const transition = [
  record('scene-transition', 't1', 'p1', 's1', 'fade'),
  record('scene-transition', 't2', 'p2', 's2', 'cut'),
  record('scene-transition', 't3', 'p3', 's3', 'fade'),
  record('scene-transition', 't4', 'p4', 's4', 'cut'),
  record('scene-transition', 't5', 'p5', 's5', 'fade')
];

test('creates measured evidence summary when training and evaluation evidence are sufficient', () => {
  const result = createAiSuggestionEvidenceSummary(motion, 'scene-motion', measuredEvaluation());
  assert.equal(result.summaryVersion, '0.48');
  assert.equal(result.decisionType, 'scene-motion');
  assert.deepEqual(result.training, { examples: 5, labels: 2, projects: 5 });
  assert.equal(result.evaluation.status, 'measured');
  assert.equal(result.evaluation.evaluated, 5);
  assert.equal(result.evaluation.evaluatedProjects, 3);
  assert.equal(result.evaluation.accuracy, 0.6);
  assert.equal(result.status, 'measured');
});

test('returns insufficient for malformed or weak evidence without throwing', () => {
  const weak = createAiSuggestionEvidenceSummary([], 'scene-motion', { evaluated: 100, accuracy: 4, outcomes: null });
  assert.equal(weak.status, 'insufficient');
  assert.equal(weak.evaluation.status, 'insufficient');
  assert.equal(weak.evaluation.accuracy, null);

  const unknown = createAiSuggestionEvidenceSummary(null, 'unknown', null);
  assert.equal(unknown.status, 'insufficient');
  assert.equal(unknown.training.examples, 0);
});

test('summarizes motion and transition in the same shape', () => {
  const combined = createCreatorAiEvidenceSummary([...motion, ...transition], {
    motion: measuredEvaluation(),
    transition: measuredEvaluation()
  });
  assert.equal(combined.summaryVersion, '0.48');
  assert.equal(combined.motion.status, 'measured');
  assert.equal(combined.transition.status, 'measured');
  assert.deepEqual(Object.keys(combined.motion), Object.keys(combined.transition));
});
