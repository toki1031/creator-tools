import test from 'node:test';
import assert from 'node:assert/strict';
import { createSceneMotionAiFeedbackRecord } from '../sceneMotionAiFeedback.js';

function base(overrides = {}) {
  return {
    decisionId: 'd1',
    projectId: 'p1',
    sceneId: 's1',
    timestamp: '2026-09-07T00:00:00.000Z',
    humanConfirmed: true,
    suggestedMotion: 'zoom-in',
    finalMotion: 'zoom-in',
    context: {
      sceneText: '人物に寄る',
      sceneIndex: 1,
      durationSec: 4,
      platform: 'youtube',
      aspectRatio: '9:16'
    },
    model: { version: '0.39', trainingExamples: 12 },
    ...overrides
  };
}

test('creates accepted feedback when human keeps the AI suggestion', () => {
  const record = createSceneMotionAiFeedbackRecord(base());
  assert.equal(record.decisionType, 'scene-motion-ai-feedback');
  assert.equal(record.proposal.motion, 'zoom-in');
  assert.equal(record.finalDecision.motion, 'zoom-in');
  assert.equal(record.humanAction.type, 'accepted');
  assert.equal(record.proposal.model.version, '0.39');
  assert.equal(record.proposal.model.trainingExamples, 12);
});

test('creates corrected feedback when human chooses a different supported motion', () => {
  const record = createSceneMotionAiFeedbackRecord(base({ finalMotion: 'pan-left' }));
  assert.equal(record.humanAction.type, 'corrected');
  assert.equal(record.proposal.motion, 'zoom-in');
  assert.equal(record.finalDecision.motion, 'pan-left');
});

test('does not create feedback from prediction alone or malformed identifiers/labels', () => {
  assert.equal(createSceneMotionAiFeedbackRecord(base({ humanConfirmed: false })), null);
  assert.equal(createSceneMotionAiFeedbackRecord(base({ projectId: '' })), null);
  assert.equal(createSceneMotionAiFeedbackRecord(base({ sceneId: '' })), null);
  assert.equal(createSceneMotionAiFeedbackRecord(base({ suggestedMotion: 'spin' })), null);
  assert.equal(createSceneMotionAiFeedbackRecord(base({ finalMotion: 'spin' })), null);
});

test('keeps context compact and strips data/blob strings without mutating input', () => {
  const input = base({
    context: {
      sceneText: 'data:image/png;base64,AAA',
      sceneIndex: 2,
      durationSec: 5,
      platform: 'youtube',
      aspectRatio: '9:16',
      imageData: 'data:image/png;base64,AAA'
    },
    model: {
      version: '0.39',
      trainingExamples: 8,
      weights: { secret: true }
    }
  });
  const snapshot = structuredClone(input);
  const record = createSceneMotionAiFeedbackRecord(input);
  assert.equal(record.context.sceneText, '');
  assert.equal('imageData' in record.context, false);
  assert.equal('weights' in record.proposal.model, false);
  assert.deepEqual(input, snapshot);
});
