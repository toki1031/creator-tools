import test from 'node:test';
import assert from 'node:assert/strict';
import { createSceneTransitionAiFeedbackRecord } from '../sceneTransitionAiFeedback.js';

function base(overrides = {}) {
  return {
    decisionId: 'd1',
    projectId: 'p1',
    sceneId: 's1',
    timestamp: '2026-09-07T00:00:00.000Z',
    humanConfirmed: true,
    suggestedTransition: 'fade',
    finalTransition: 'fade',
    context: {
      sceneText: '静かに移る',
      sceneIndex: 1,
      durationSec: 4,
      platform: 'youtube',
      aspectRatio: '9:16'
    },
    model: { version: '0.42', trainingExamples: 12 },
    ...overrides
  };
}

test('creates accepted feedback when human keeps the AI transition suggestion', () => {
  const record = createSceneTransitionAiFeedbackRecord(base());
  assert.equal(record.decisionType, 'scene-transition-ai-feedback');
  assert.equal(record.proposal.transition, 'fade');
  assert.equal(record.finalDecision.transition, 'fade');
  assert.equal(record.humanAction.type, 'accepted');
  assert.equal(record.proposal.model.version, '0.42');
  assert.equal(record.proposal.model.trainingExamples, 12);
});

test('creates corrected feedback when human chooses a different transition', () => {
  const record = createSceneTransitionAiFeedbackRecord(base({ finalTransition: 'cut' }));
  assert.equal(record.humanAction.type, 'corrected');
  assert.equal(record.proposal.transition, 'fade');
  assert.equal(record.finalDecision.transition, 'cut');
});

test('does not create feedback from prediction alone or malformed identifiers/labels', () => {
  assert.equal(createSceneTransitionAiFeedbackRecord(base({ humanConfirmed: false })), null);
  assert.equal(createSceneTransitionAiFeedbackRecord(base({ projectId: '' })), null);
  assert.equal(createSceneTransitionAiFeedbackRecord(base({ sceneId: '' })), null);
  assert.equal(createSceneTransitionAiFeedbackRecord(base({ suggestedTransition: 'wipe' })), null);
  assert.equal(createSceneTransitionAiFeedbackRecord(base({ finalTransition: 'wipe' })), null);
});

test('keeps context compact and strips data/blob strings without mutating input', () => {
  const input = base({
    context: {
      sceneText: 'blob:https://example.test/asset',
      sceneIndex: 2,
      durationSec: 5,
      platform: 'youtube',
      aspectRatio: '9:16',
      videoData: 'data:video/mp4;base64,AAA'
    },
    model: {
      version: '0.42',
      trainingExamples: 8,
      weights: { hidden: true }
    }
  });
  const snapshot = structuredClone(input);
  const record = createSceneTransitionAiFeedbackRecord(input);
  assert.equal(record.context.sceneText, '');
  assert.equal('videoData' in record.context, false);
  assert.equal('weights' in record.proposal.model, false);
  assert.deepEqual(input, snapshot);
});
