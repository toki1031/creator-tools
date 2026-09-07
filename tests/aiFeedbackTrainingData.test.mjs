import test from 'node:test';
import assert from 'node:assert/strict';
import { createAiFeedbackExamples, createAiEnhancedTrainingSet, createCreatorAiEnhancedTrainingSets } from '../aiFeedbackTrainingData.js';

function feedback(type, id, projectId, sceneId, suggested, finalValue, action, text = 'scene') {
  const motion = type === 'scene-motion-ai-feedback';
  return {
    id,
    decisionType: type,
    projectId,
    sceneId,
    context: { sceneText: text, sceneIndex: 1, durationSec: 4, platform: 'youtube', aspectRatio: '9:16' },
    proposal: motion ? { motion: suggested } : { transition: suggested },
    finalDecision: motion ? { motion: finalValue } : { transition: finalValue },
    humanAction: { type: action },
    source: { type: 'human', feature: type, version: 'test' },
    timestamp: '2026-09-07T00:00:00.000Z'
  };
}

function baseMotion(id = 'm0') {
  return {
    id,
    decisionType: 'scene-motion',
    projectId: 'base-project',
    sceneId: 'base-scene',
    context: { sceneText: 'base', sceneIndex: 0, durationSec: 4, platform: 'youtube', aspectRatio: '9:16' },
    proposal: { motion: 'none' },
    finalDecision: { motion: 'zoom-in' },
    humanAction: { type: 'select-scene-motion' },
    source: { type: 'human', feature: 'scene-editor', version: '0.5' },
    timestamp: '2026-09-07T00:00:00.000Z'
  };
}

test('uses the human final motion as label for accepted and corrected feedback', () => {
  const records = [
    feedback('scene-motion-ai-feedback', 'f1', 'p1', 's1', 'zoom-in', 'zoom-in', 'accepted'),
    feedback('scene-motion-ai-feedback', 'f2', 'p2', 's2', 'zoom-in', 'pan-left', 'corrected')
  ];
  const examples = createAiFeedbackExamples(records, 'scene-motion');
  assert.equal(examples.length, 2);
  assert.equal(examples[0].label, 'zoom-in');
  assert.equal(examples[0].feedback, 'accepted');
  assert.equal(examples[1].label, 'pan-left');
  assert.equal(examples[1].feedback, 'corrected');
});

test('uses the human final transition and rejects malformed feedback', () => {
  const records = [
    feedback('scene-transition-ai-feedback', 't1', 'p1', 's1', 'fade', 'cut', 'corrected'),
    feedback('scene-transition-ai-feedback', 't2', 'p2', 's2', 'fade', 'wipe', 'corrected'),
    feedback('scene-transition-ai-feedback', 't3', 'p3', 's3', 'fade', 'fade', 'shown-only'),
    feedback('scene-transition-ai-feedback', '', 'p4', 's4', 'cut', 'cut', 'accepted')
  ];
  const examples = createAiFeedbackExamples(records, 'scene-transition');
  assert.equal(examples.length, 1);
  assert.equal(examples[0].label, 'cut');
});

test('strips data/blob context strings and does not mutate records', () => {
  const record = feedback('scene-motion-ai-feedback', 'f1', 'p1', 's1', 'none', 'none', 'accepted', 'data:image/png;base64,AAA');
  const snapshot = structuredClone(record);
  const [example] = createAiFeedbackExamples([record], 'scene-motion');
  assert.equal(example.context.sceneText, '');
  assert.deepEqual(record, snapshot);
});

test('combines base human decisions and AI feedback deterministically', () => {
  const records = [
    baseMotion(),
    feedback('scene-motion-ai-feedback', 'f1', 'p1', 's1', 'zoom-in', 'zoom-in', 'accepted'),
    feedback('scene-transition-ai-feedback', 't1', 'p2', 's2', 'fade', 'cut', 'corrected')
  ];
  const motion = createAiEnhancedTrainingSet(records, 'scene-motion');
  assert.equal(motion.trainingSetVersion, '0.51');
  assert.equal(motion.baseExamples, 1);
  assert.equal(motion.feedbackExamples, 1);
  assert.deepEqual(motion.examples.map(item => item.decisionId), ['m0', 'f1']);

  const combined = createCreatorAiEnhancedTrainingSets(records);
  assert.equal(combined.motion.examples.length, 2);
  assert.equal(combined.transition.feedbackExamples, 1);
});
