import test from 'node:test';
import assert from 'node:assert/strict';
import { trainSceneImageVisualRanker, scoreSceneImageVisualCandidate, rankSceneImageVisualCandidates } from '../sceneImageVisualRanker.js';

function visual(overrides = {}) {
  return {
    aspectRatio: 1,
    aspectBalance: 0.5,
    brightness: 0.5,
    contrast: 0.5,
    saturation: 0.5,
    edgeDensity: 0.5,
    ...overrides
  };
}

test('learns a deterministic visual direction where chosen scores above rejected', () => {
  const examples = [
    { chosenFeatures: visual({ brightness: 0.9 }), rejectedFeatures: visual({ brightness: 0.1 }) },
    { chosenFeatures: visual({ brightness: 0.8 }), rejectedFeatures: visual({ brightness: 0.2 }) }
  ];
  const model = trainSceneImageVisualRanker(examples);
  const chosenScore = scoreSceneImageVisualCandidate(model, visual({ brightness: 0.9 }));
  const rejectedScore = scoreSceneImageVisualCandidate(model, visual({ brightness: 0.1 }));

  assert.equal(model.modelVersion, '0.63');
  assert.equal(model.trainedPairs, 2);
  assert.ok(chosenScore > rejectedScore);
  assert.deepEqual(model, trainSceneImageVisualRanker(examples));
});

test('model survives JSON round trip and ignores asset identity when scoring', () => {
  const model = trainSceneImageVisualRanker([
    { chosenFeatures: visual({ contrast: 0.9 }), rejectedFeatures: visual({ contrast: 0.1 }) }
  ]);
  const restored = JSON.parse(JSON.stringify(model));
  const features = visual({ contrast: 0.75 });
  assert.equal(scoreSceneImageVisualCandidate(model, features), scoreSceneImageVisualCandidate(restored, features));

  const ranked = rankSceneImageVisualCandidates(model, [
    { assetId: 'asset-a', visualFeatures: features },
    { assetId: 'asset-b', visualFeatures: features }
  ]);
  assert.equal(ranked[0].score, ranked[1].score);
  assert.deepEqual(ranked.map(item => item.assetId), ['asset-a', 'asset-b']);
});

test('ranks candidates by visual score with deterministic input-order tie breaking', () => {
  const model = trainSceneImageVisualRanker([
    { chosenFeatures: visual({ saturation: 1 }), rejectedFeatures: visual({ saturation: 0 }) }
  ]);
  const ranked = rankSceneImageVisualCandidates(model, [
    { assetId: 'low', visualFeatures: visual({ saturation: 0.1 }) },
    { assetId: 'high', visualFeatures: visual({ saturation: 0.9 }) },
    { assetId: 'high-2', visualFeatures: visual({ saturation: 0.9 }) }
  ]);
  assert.deepEqual(ranked.map(item => item.assetId), ['high', 'high-2', 'low']);
});

test('handles empty and malformed training/scoring data safely', () => {
  const empty = trainSceneImageVisualRanker(null);
  assert.equal(empty.trainedPairs, 0);
  assert.equal(scoreSceneImageVisualCandidate(empty, visual()), 0);
  assert.equal(scoreSceneImageVisualCandidate(null, visual()), null);
  assert.equal(scoreSceneImageVisualCandidate(empty, { brightness: 0.5 }), null);

  const mixed = trainSceneImageVisualRanker([
    {},
    { chosenFeatures: visual(), rejectedFeatures: { brightness: 1 } },
    { chosenFeatures: visual({ edgeDensity: 1 }), rejectedFeatures: visual({ edgeDensity: 0 }) }
  ]);
  assert.equal(mixed.trainedPairs, 1);
});
