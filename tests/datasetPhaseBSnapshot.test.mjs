import test from 'node:test';
import assert from 'node:assert/strict';
import { createDatasetPhaseBSnapshot } from '../datasetPhaseBSnapshot.js';

function record(id, projectId = 'p1') {
  return {
    id,
    decisionType: 'scene-order',
    projectId,
    sceneId: `s-${id}`,
    humanAction: { type: 'test' },
    finalDecision: { value: id },
    source: { type: 'human', feature: 'test', version: '1' },
    timestamp: '2026-09-07T00:00:00.000Z'
  };
}

function exportPayload(id, decisions) {
  return { exportVersion: '0.30', project: { id }, summary: {}, decisions };
}

test('creates one serializable Phase B report from multiple exports', () => {
  const exports = [exportPayload('p1', [record('d1', 'p1')]), exportPayload('p2', [record('d2', 'p2')])];
  const before = structuredClone(exports);
  const report = createDatasetPhaseBSnapshot(exports, { generatedAt: '2026-09-07T00:00:00.000Z', thresholds: { collectMoreValid: 1, collectMoreProjects: 1, candidateValid: 2, candidateProjects: 2 } });
  assert.equal(report.snapshotVersion, '0.34');
  assert.equal(report.inputs.valid, 2);
  assert.equal(report.aggregate.totalDecisions, 2);
  assert.equal(report.audit.valid, 2);
  assert.equal(report.readiness.decisionTypes['scene-order'].readiness, 'candidate');
  assert.doesNotThrow(() => JSON.stringify(report));
  assert.deepEqual(exports, before);
});

test('surfaces invalid export shape without crashing', () => {
  const report = createDatasetPhaseBSnapshot([null, { exportVersion: '0.29' }], { generatedAt: '2026-09-07T00:00:00.000Z' });
  assert.equal(report.inputs.invalid, 2);
  assert.equal(report.aggregate.totalDecisions, 0);
  assert.equal(report.audit.total, 0);
});
