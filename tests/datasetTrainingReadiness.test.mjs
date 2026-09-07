import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateTrainingReadiness, evaluateDatasetExportsReadiness } from '../datasetTrainingReadiness.js';

function record(id, projectId, decisionType = 'scene-order', sceneId = `s-${id}`) {
  return {
    id,
    decisionType,
    projectId,
    sceneId,
    humanAction: { type: 'test' },
    finalDecision: { value: id },
    source: { type: 'human', feature: 'test', version: '1' },
    timestamp: '2026-09-07T00:00:00.000Z'
  };
}

test('returns insufficient for small datasets', () => {
  const result = evaluateTrainingReadiness([record('1', 'p1')]);
  assert.equal(result.decisionTypes['scene-order'].readiness, 'insufficient');
});

test('supports configurable collect-more and candidate thresholds', () => {
  const decisions = [record('1', 'p1'), record('2', 'p2'), record('3', 'p3')];
  const before = structuredClone(decisions);
  const result = evaluateTrainingReadiness(decisions, { thresholds: { collectMoreValid: 2, collectMoreProjects: 2, candidateValid: 3, candidateProjects: 3 } });
  assert.equal(result.decisionTypes['scene-order'].readiness, 'candidate');
  assert.equal(result.decisionTypes['scene-order'].projects, 3);
  assert.equal(result.decisionTypes['scene-order'].scenes, 3);
  assert.deepEqual(decisions, before);
});

test('aggregates exports and keeps invalid data out of candidate status', () => {
  const valid = record('1', 'p1');
  const bad = { ...record('2', 'p2'), timestamp: 'bad' };
  const result = evaluateDatasetExportsReadiness([{ decisions: [valid] }, { decisions: [bad] }], { thresholds: { collectMoreValid: 1, collectMoreProjects: 1, candidateValid: 1, candidateProjects: 1, maxInvalidRate: 0 } });
  assert.equal(result.summary.invalid, 1);
  assert.equal(result.decisionTypes['scene-order'].readiness, 'collect-more');
});
