import test from 'node:test';
import assert from 'node:assert/strict';
import { createSceneImageVisualPairwiseTrainingSet } from '../sceneImageVisualPairwiseTraining.js';

function feature(overrides = {}) {
  return {
    visualFeatureVersion: '0.61',
    aspectRatio: 1.5,
    aspectBalance: 0.6,
    brightness: 0.5,
    contrast: 0.4,
    saturation: 0.3,
    edgeDensity: 0.2,
    imageData: 'data:image/png;base64,blocked',
    ...overrides
  };
}

function decision() {
  return {
    id: 'd1',
    decisionType: 'scene-image-selection',
    projectId: 'p1',
    sceneId: 's1',
    timestamp: '2026-09-07T00:00:00.000Z',
    humanAction: 'replace-image',
    source: 'user',
    proposal: { imageAssetId: 'a0' },
    finalDecision: { imageAssetId: 'a1' },
    alternatives: [
      { imageAssetId: 'a2' },
      { imageAssetId: 'a2' },
      { imageAssetId: 'a1' }
    ],
    context: {
      sceneText: '山の朝',
      sceneIndex: 0,
      platform: 'youtube-shorts',
      aspectRatio: '9:16'
    }
  };
}

test('pairs chosen image features with each unique rejected image feature', () => {
  const input = [decision()];
  const before = structuredClone(input);
  const featureMap = {
    a0: feature({ brightness: 0.1 }),
    a1: feature({ brightness: 0.8 }),
    a2: feature({ brightness: 0.4 })
  };

  const result = createSceneImageVisualPairwiseTrainingSet(input, featureMap);

  assert.deepEqual(input, before);
  assert.equal(result.trainingSetVersion, '0.62');
  assert.equal(result.featureVersion, '0.61');
  assert.equal(result.examples.length, 2);
  assert.deepEqual(result.examples.map(example => example.rejectedAssetId), ['a0', 'a2']);
  assert.equal(result.examples[0].chosenFeatures.brightness, 0.8);
  assert.equal('imageData' in result.examples[0].chosenFeatures, false);
  assert.equal(JSON.stringify(result).includes('data:image'), false);
});

test('skips pairs when chosen or rejected visual features are unavailable', () => {
  const noChosen = createSceneImageVisualPairwiseTrainingSet([decision()], {
    a0: feature(),
    a2: feature()
  });
  assert.equal(noChosen.examples.length, 0);
  assert.equal(noChosen.summary.missingChosenFeatures, 2);

  const noRejected = createSceneImageVisualPairwiseTrainingSet([decision()], {
    a1: feature(),
    a0: feature(),
    a2: { brightness: 0.2 }
  });
  assert.equal(noRejected.examples.length, 1);
  assert.equal(noRejected.summary.missingRejectedFeatures, 1);
});

test('supports Map feature lookup for a valid audited decision', () => {
  const map = new Map([
    ['a0', feature()],
    ['a1', feature()],
    ['a2', feature()]
  ]);
  const result = createSceneImageVisualPairwiseTrainingSet([decision()], map);
  assert.deepEqual(result.examples.map(example => example.rejectedAssetId), ['a0', 'a2']);
});

test('blocked asset URLs invalidate the source DecisionRecord before pairing', () => {
  const record = decision();
  record.alternatives = [{ imageAssetId: 'data:image/png;base64,blocked' }, { imageAssetId: 'a2' }];
  const map = new Map([
    ['a0', feature()],
    ['a1', feature()],
    ['a2', feature()]
  ]);
  const result = createSceneImageVisualPairwiseTrainingSet([record], map);
  assert.deepEqual(result.examples, []);
});

test('handles malformed input safely', () => {
  assert.deepEqual(createSceneImageVisualPairwiseTrainingSet(null, null).examples, []);
  assert.deepEqual(createSceneImageVisualPairwiseTrainingSet([{}], {}).examples, []);
});
