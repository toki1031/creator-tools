import test from 'node:test';
import assert from 'node:assert/strict';
import { sceneMotionFeatures, trainSceneMotionModel, predictSceneMotion } from '../sceneMotionModel.js';

test('trains deterministically and survives JSON round-trip', () => {
  const examples = [
    { label: 'zoom-in', context: { sceneText: '顔に近づく', platform: 'youtube', aspectRatio: '9:16', durationSec: 4, sceneIndex: 1 } },
    { label: 'zoom-in', context: { sceneText: '表情を強調', platform: 'youtube', aspectRatio: '9:16', durationSec: 5, sceneIndex: 2 } },
    { label: 'pan-left', context: { sceneText: '景色を横に見せる', platform: 'youtube', aspectRatio: '16:9', durationSec: 8, sceneIndex: 5 } }
  ];
  const before = structuredClone(examples);
  const a = trainSceneMotionModel(examples);
  const b = trainSceneMotionModel(examples);
  assert.deepEqual(a, b);
  assert.deepEqual(examples, before);
  const restored = JSON.parse(JSON.stringify(a));
  const prediction = predictSceneMotion(restored, { sceneText: '表情に近づく', platform: 'youtube', aspectRatio: '9:16', durationSec: 4, sceneIndex: 1 });
  assert.equal(prediction.label, 'zoom-in');
  assert.equal(prediction.scores.length, 5);
});

test('empty model is safe and deterministic', () => {
  const model = trainSceneMotionModel([]);
  const a = predictSceneMotion(model, { sceneText: '未知のシーン' });
  const b = predictSceneMotion(model, { sceneText: '未知のシーン' });
  assert.deepEqual(a, b);
  assert.equal(a.label, 'none');
});

test('features are compact categorical plus text n-grams', () => {
  const features = sceneMotionFeatures({ sceneText: '空へ', platform: 'youtube', aspectRatio: '9:16', durationSec: 2, sceneIndex: 0 });
  assert.ok(features.includes('platform:youtube'));
  assert.ok(features.includes('aspect:9:16'));
  assert.ok(features.includes('duration:short'));
  assert.ok(features.includes('scene-index:early'));
  assert.ok(features.some(token => token.startsWith('b:')));
});

test('ignores unsupported labels', () => {
  const model = trainSceneMotionModel([{ label: 'spin', context: { sceneText: 'x' } }]);
  assert.equal(model.totalExamples, 0);
});
