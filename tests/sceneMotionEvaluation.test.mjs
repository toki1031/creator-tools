import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateSceneMotionExamples } from '../sceneMotionEvaluation.js';

function example(projectId, label, text) {
  return { projectId, label, context: { sceneText: text, platform: 'youtube', aspectRatio: '9:16', durationSec: 4, sceneIndex: 1 } };
}

test('evaluates with project-level separation and deterministic output', () => {
  const examples = [
    example('p1', 'zoom-in', '顔に近づく'),
    example('p1', 'zoom-in', '表情を強調'),
    example('p2', 'pan-left', '景色を横に見る'),
    example('p2', 'pan-left', '横方向へ移動'),
    example('p3', 'none', '静かな場面'),
    example('p3', 'none', '動かさない')
  ];
  const before = structuredClone(examples);
  const a = evaluateSceneMotionExamples(examples, { validationRatio: 0.34, seed: 'test-seed' });
  const b = evaluateSceneMotionExamples(examples, { validationRatio: 0.34, seed: 'test-seed' });
  assert.deepEqual(a, b);
  assert.deepEqual(examples, before);
  const splits = a.split.projectSplits;
  for (const projectId of new Set(examples.map(item => item.projectId))) assert.ok(['train', 'validation'].includes(splits[projectId]));
  assert.equal(a.metrics.evaluated + a.metrics.skipped, a.metrics.validationExamples);
  assert.doesNotThrow(() => JSON.stringify(a));
});

test('empty validation is safe', () => {
  const result = evaluateSceneMotionExamples([example('p1', 'zoom-in', '近づく')], { validationRatio: 0 });
  assert.equal(result.metrics.validationExamples, 0);
  assert.equal(result.metrics.accuracy, null);
});
