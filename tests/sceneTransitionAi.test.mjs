import test from 'node:test';
import assert from 'node:assert/strict';
import { createSceneTransitionTrainingSet } from '../sceneTransitionTrainingData.js';
import { sceneTransitionFeatures, trainSceneTransitionModel, predictSceneTransition } from '../sceneTransitionModel.js';
import { evaluateSceneTransitionExamples } from '../sceneTransitionEvaluation.js';

function record(overrides = {}) {
  return {
    id: 'd1',
    decisionType: 'scene-transition',
    projectId: 'p1',
    sceneId: 's1',
    timestamp: '2026-09-07T00:00:00.000Z',
    humanAction: { type: 'select-scene-transition' },
    finalDecision: { transition: 'fade' },
    source: { type: 'human' },
    context: { sceneText: '静かに余韻を残す', sceneIndex: 0, durationSec: 5, platform: 'youtube-shorts', aspectRatio: '9:16' },
    ...overrides
  };
}

function example(projectId, label, text, sceneIndex = 0) {
  return {
    decisionId: `${projectId}-${label}-${sceneIndex}`,
    projectId,
    sceneId: `${projectId}-s${sceneIndex}`,
    context: { sceneText: text, sceneIndex, durationSec: label === 'cut' ? 2 : 6, platform: 'youtube-shorts', aspectRatio: '9:16' },
    label
  };
}

test('creates compact scene-transition examples and excludes invalid data', () => {
  const decisions = [
    record(),
    record({ id: 'cut', projectId: 'p2', sceneId: 's2', finalDecision: { transition: 'cut' } }),
    record({ id: 'bad-label', finalDecision: { transition: 'wipe' } }),
    record({ id: 'bad-time', timestamp: 'invalid' }),
    record({ id: 'other', decisionType: 'scene-motion' }),
    record({ id: 'blocked', context: { sceneText: 'data:image/png;base64,abc' } })
  ];
  const before = structuredClone(decisions);
  const output = createSceneTransitionTrainingSet(decisions);
  assert.equal(output.trainingSetVersion, '0.42');
  assert.equal(output.decisionType, 'scene-transition');
  assert.deepEqual(output.examples.map(item => item.decisionId), ['d1', 'cut']);
  assert.deepEqual(decisions, before);
  assert.equal(JSON.stringify(output).includes('data:'), false);
  assert.equal(JSON.stringify(output).includes('blob:'), false);
});

test('trains and predicts deterministically with compact features', () => {
  const examples = [
    example('p1', 'fade', '静かに余韻を残す', 0),
    example('p2', 'fade', 'ゆっくり場面が変わる', 1),
    example('p3', 'cut', '強く言い切る', 0),
    example('p4', 'cut', 'テンポよく次へ', 2)
  ];
  const modelA = trainSceneTransitionModel(examples);
  const modelB = trainSceneTransitionModel(examples);
  assert.deepEqual(modelA, modelB);
  assert.equal(modelA.modelVersion, '0.42');
  assert.equal(modelA.totalExamples, 4);
  assert.deepEqual(modelA.classDocCounts, { fade: 2, cut: 2 });
  assert.ok(sceneTransitionFeatures(examples[0].context).includes('duration:medium'));
  const predictionA = predictSceneTransition(modelA, examples[0].context);
  const predictionB = predictSceneTransition(JSON.parse(JSON.stringify(modelA)), examples[0].context);
  assert.deepEqual(predictionA, predictionB);
  assert.ok(['fade', 'cut'].includes(predictionA.label));
});

test('evaluation separates projects and is safe for empty input', () => {
  const examples = [];
  for (let i = 0; i < 10; i += 1) {
    const projectId = `p${i}`;
    examples.push(example(projectId, i % 2 ? 'cut' : 'fade', i % 2 ? '短く強い切替' : 'ゆっくり余韻', i % 5));
  }
  const result = evaluateSceneTransitionExamples(examples, { validationRatio: 0.3, seed: 'transition-test' });
  const splits = result.split.projectSplits;
  for (const projectId of new Set(examples.map(item => item.projectId))) {
    assert.ok(['train', 'validation'].includes(splits[projectId]));
  }
  assert.equal(result.evaluationVersion, '0.42');
  assert.equal(result.metrics.evaluated + result.metrics.skipped, result.metrics.validationExamples);
  assert.ok(result.metrics.accuracy === null || (result.metrics.accuracy >= 0 && result.metrics.accuracy <= 1));
  assert.deepEqual(Object.keys(result.metrics.confusionMatrix), ['fade', 'cut']);

  const empty = evaluateSceneTransitionExamples([]);
  assert.equal(empty.metrics.evaluated, 0);
  assert.equal(empty.metrics.accuracy, null);
});
