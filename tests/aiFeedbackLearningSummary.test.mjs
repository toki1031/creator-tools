import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeAiFeedbackLearning } from '../aiFeedbackLearningSummary.js';

const motion = (overrides = {}) => ({
  id: 'm1',
  decisionType: 'scene-motion-ai-feedback',
  projectId: 'p1',
  sceneId: 's1',
  proposal: { motion: 'zoom-in' },
  finalDecision: { motion: 'zoom-in' },
  humanAction: { type: 'accepted' },
  ...overrides
});

const transition = (overrides = {}) => ({
  id: 't1',
  decisionType: 'scene-transition-ai-feedback',
  projectId: 'p2',
  sceneId: 's1',
  proposal: { transition: 'fade' },
  finalDecision: { transition: 'cut' },
  humanAction: { type: 'corrected' },
  ...overrides
});

test('summarizes accepted and corrected AI feedback by type', () => {
  const records = [
    motion(),
    motion({ id: 'm2', sceneId: 's2', proposal: { motion: 'zoom-in' }, finalDecision: { motion: 'pan-left' }, humanAction: { type: 'corrected' } }),
    transition()
  ];
  const result = summarizeAiFeedbackLearning(records);
  assert.equal(result.summaryVersion, '0.55');
  assert.equal(result.totalFeedbackRecords, 3);
  assert.equal(result.validFeedbackRecords, 3);
  const motionSummary = result.feedbackTypes['scene-motion-ai-feedback'];
  assert.equal(motionSummary.accepted, 1);
  assert.equal(motionSummary.corrected, 1);
  assert.equal(motionSummary.acceptanceRate, 0.5);
  assert.equal(motionSummary.projects, 1);
  assert.equal(motionSummary.scenes, 2);
  assert.deepEqual(motionSummary.corrections, { 'zoom-in->pan-left': 1 });
  const transitionSummary = result.feedbackTypes['scene-transition-ai-feedback'];
  assert.equal(transitionSummary.corrected, 1);
  assert.deepEqual(transitionSummary.corrections, { 'fade->cut': 1 });
});

test('rejects malformed and internally inconsistent feedback safely', () => {
  const result = summarizeAiFeedbackLearning([
    motion({ projectId: '' }),
    motion({ proposal: { motion: 'bad' } }),
    motion({ finalDecision: { motion: 'zoom-in' }, humanAction: { type: 'corrected' } }),
    transition({ finalDecision: { transition: 'fade' }, humanAction: { type: 'corrected' } })
  ]);
  assert.equal(result.totalFeedbackRecords, 4);
  assert.equal(result.validFeedbackRecords, 0);
  assert.equal(result.invalidFeedbackRecords, 4);
});

test('ignores unrelated decisions, handles non-array input, and does not mutate input', () => {
  const records = [motion(), { decisionType: 'scene-motion', projectId: 'p1' }];
  const before = structuredClone(records);
  const result = summarizeAiFeedbackLearning(records);
  assert.equal(result.totalFeedbackRecords, 1);
  assert.deepEqual(records, before);
  const empty = summarizeAiFeedbackLearning(null);
  assert.equal(empty.totalFeedbackRecords, 0);
  assert.equal(empty.feedbackTypes['scene-motion-ai-feedback'].acceptanceRate, null);
});
