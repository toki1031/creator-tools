import test from 'node:test';
import assert from 'node:assert/strict';
import { createSceneImagePairwiseTrainingSet, createSceneImagePairwiseTrainingSetFromExports } from '../sceneImagePairwiseTraining.js';

function record(overrides = {}) {
  return {
    id: 'd1',
    decisionType: 'scene-image-selection',
    projectId: 'p1',
    sceneId: 's1',
    context: { sceneText: '北斎が絵筆を握る', sceneIndex: 0, platform: 'youtube-shorts', aspectRatio: '9:16' },
    proposal: { imageAssetId: 'a1' },
    alternatives: [{ imageAssetId: 'a2' }, { imageAssetId: 'a3' }],
    humanAction: { type: 'select-image-asset' },
    finalDecision: { imageAssetId: 'a2' },
    source: { type: 'human', feature: 'scene-editor', version: '0.4' },
    timestamp: '2026-09-07T00:00:00.000Z',
    ...overrides
  };
}

test('creates distinct pairwise examples for chosen versus rejected assets', () => {
  const decisions = [record()];
  const before = structuredClone(decisions);
  const set = createSceneImagePairwiseTrainingSet(decisions);
  assert.equal(set.summary.acceptedDecisions, 1);
  assert.equal(set.summary.examples, 2);
  assert.deepEqual(set.examples.map(item => item.rejectedAssetId).sort(), ['a1', 'a3']);
  assert.ok(set.examples.every(item => item.chosenAssetId === 'a2'));
  assert.deepEqual(decisions, before);
});

test('ignores invalid records, non-image decisions and blocked asset ids', () => {
  const set = createSceneImagePairwiseTrainingSet([
    record({ id: 'bad-time', timestamp: 'bad' }),
    record({ id: 'other', decisionType: 'scene-motion' }),
    record({ id: 'blocked', finalDecision: { imageAssetId: 'data:image/png;base64,x' } })
  ]);
  assert.equal(set.summary.examples, 0);
});

test('builds from multiple exports', () => {
  const set = createSceneImagePairwiseTrainingSetFromExports([{ decisions: [record()] }, { decisions: [record({ id: 'd2', projectId: 'p2' })] }]);
  assert.equal(set.summary.acceptedDecisions, 2);
  assert.equal(set.summary.examples, 4);
});
