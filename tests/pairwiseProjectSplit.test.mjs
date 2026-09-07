import test from 'node:test';
import assert from 'node:assert/strict';
import { splitPairwiseExamplesByProject, splitSceneImageTrainingSet } from '../pairwiseProjectSplit.js';

function example(id, projectId) {
  return { decisionId: id, projectId, chosenAssetId: 'a', rejectedAssetId: 'b' };
}

test('keeps every project in exactly one split and is deterministic', () => {
  const examples = [example('1', 'p1'), example('2', 'p1'), example('3', 'p2'), example('4', 'p3')];
  const before = structuredClone(examples);
  const first = splitPairwiseExamplesByProject(examples, { seed: 'fixed', validationRatio: 0.5 });
  const second = splitPairwiseExamplesByProject(examples, { seed: 'fixed', validationRatio: 0.5 });
  assert.deepEqual(first, second);
  const trainProjects = new Set(first.train.map(item => item.projectId));
  const validationProjects = new Set(first.validation.map(item => item.projectId));
  assert.ok([...trainProjects].every(id => !validationProjects.has(id)));
  assert.deepEqual(examples, before);
});

test('drops examples without projectId and clamps ratios', () => {
  const result = splitPairwiseExamplesByProject([example('1', 'p1'), { decisionId: 'bad' }], { validationRatio: 99 });
  assert.equal(result.validationRatio, 0.9);
  assert.equal(result.summary.acceptedExamples, 1);
});

test('accepts a v0.35 training set object', () => {
  const result = splitSceneImageTrainingSet({ examples: [example('1', 'p1')] }, { validationRatio: 0 });
  assert.equal(result.summary.trainExamples, 1);
  assert.equal(result.summary.validationExamples, 0);
});
