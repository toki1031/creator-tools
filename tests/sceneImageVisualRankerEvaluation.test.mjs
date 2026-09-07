import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateSceneImageVisualRanker } from '../sceneImageVisualRankerEvaluation.js';

function visual(brightness) {
  return {
    aspectRatio: 1,
    aspectBalance: 0.5,
    brightness,
    contrast: 0.5,
    saturation: 0.5,
    edgeDensity: 0.5
  };
}

function pair(projectId, chosenBrightness, rejectedBrightness) {
  return {
    projectId,
    chosenAssetId: `${projectId}-chosen`,
    rejectedAssetId: `${projectId}-rejected`,
    chosenFeatures: visual(chosenBrightness),
    rejectedFeatures: visual(rejectedBrightness)
  };
}

test('evaluates each project with a model trained only on other projects', () => {
  const examples = [
    pair('p1', 0.9, 0.1),
    pair('p2', 0.8, 0.2),
    pair('p3', 0.7, 0.3)
  ];
  const before = structuredClone(examples);
  const report = evaluateSceneImageVisualRanker(examples);

  assert.deepEqual(examples, before);
  assert.equal(report.evaluationVersion, '0.64');
  assert.equal(report.method, 'leave-one-project-out');
  assert.equal(report.summary.projects, 3);
  assert.equal(report.summary.evaluatedProjects, 3);
  assert.equal(report.summary.evaluated, 3);
  assert.equal(report.summary.correct, 3);
  assert.equal(report.summary.pairwiseAccuracy, 1);
  for (const project of report.projects) {
    assert.equal(project.trainingExamples, 2);
    assert.equal(project.validationExamples, 1);
  }
});

test('held-out project cannot teach its own opposite preference', () => {
  const report = evaluateSceneImageVisualRanker([
    pair('train-a', 0.9, 0.1),
    pair('train-b', 0.8, 0.2),
    pair('opposite', 0.1, 0.9)
  ]);
  const heldOut = report.projects.find(project => project.projectId === 'opposite');

  assert.equal(heldOut.trainingExamples, 2);
  assert.equal(heldOut.validationExamples, 1);
  assert.equal(heldOut.correct, 0);
  assert.equal(heldOut.incorrect, 1);
});

test('aggregates ties and accuracy across multiple held-out projects', () => {
  const report = evaluateSceneImageVisualRanker([
    pair('p1', 0.9, 0.1),
    pair('p2', 0.9, 0.1),
    pair('p3', 0.5, 0.5)
  ]);
  assert.equal(report.summary.evaluated, 3);
  assert.ok(report.summary.correct >= 2);
  assert.ok(report.summary.ties >= 1);
  assert.equal(report.summary.pairwiseAccuracy, report.summary.correct / report.summary.evaluated);
});

test('single-project and malformed input are safe and unevaluable', () => {
  const one = evaluateSceneImageVisualRanker([pair('only', 0.9, 0.1)]);
  assert.equal(one.summary.evaluatedProjects, 0);
  assert.equal(one.summary.evaluated, 0);
  assert.equal(one.summary.skipped, 1);
  assert.equal(one.summary.pairwiseAccuracy, null);

  const empty = evaluateSceneImageVisualRanker([{}, null]);
  assert.equal(empty.summary.acceptedExamples, 0);
  assert.equal(empty.summary.projects, 0);
  assert.deepEqual(empty.projects, []);
});
