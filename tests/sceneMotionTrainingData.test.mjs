import test from 'node:test';
import assert from 'node:assert/strict';
import { createSceneMotionTrainingSet } from '../sceneMotionTrainingData.js';

function record(overrides = {}) {
  return {
    id: 'd1',
    decisionType: 'scene-motion',
    projectId: 'p1',
    sceneId: 's1',
    timestamp: '2026-09-07T00:00:00.000Z',
    humanAction: { type: 'set-motion' },
    finalDecision: { motion: 'zoom-in' },
    source: { type: 'human' },
    context: { sceneText: '空を見上げる', sceneIndex: 0, durationSec: 4, platform: 'youtube', aspectRatio: '9:16' },
    ...overrides
  };
}

test('creates compact scene-motion classification examples without mutating input', () => {
  const decisions = [record()];
  const before = structuredClone(decisions);
  const output = createSceneMotionTrainingSet(decisions);
  assert.equal(output.trainingSetVersion, '0.38');
  assert.equal(output.decisionType, 'scene-motion');
  assert.deepEqual(output.examples, [{
    decisionId: 'd1', projectId: 'p1', sceneId: 's1',
    context: { sceneText: '空を見上げる', sceneIndex: 0, durationSec: 4, platform: 'youtube', aspectRatio: '9:16' },
    label: 'zoom-in'
  }]);
  assert.deepEqual(decisions, before);
});

test('excludes invalid records, unsupported labels and blocked URLs', () => {
  const output = createSceneMotionTrainingSet([
    record({ id: 'bad-time', timestamp: 'nope' }),
    record({ id: 'bad-label', finalDecision: { motion: 'spin' } }),
    record({ id: 'bad-url', context: { sceneText: 'data:image/png;base64,abc' } }),
    record({ id: 'other', decisionType: 'scene-transition' }),
    record({ id: 'ok', finalDecision: { motion: 'pan-left' } })
  ]);
  assert.deepEqual(output.examples.map(item => item.decisionId), ['ok']);
  assert.equal(JSON.stringify(output).includes('data:'), false);
  assert.equal(JSON.stringify(output).includes('blob:'), false);
});
