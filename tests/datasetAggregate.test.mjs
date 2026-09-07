import test from 'node:test';
import assert from 'node:assert/strict';
import { aggregateDatasetExports, inspectDatasetExport } from '../datasetAggregate.js';

test('aggregates decision counts across exports', () => {
  const result = aggregateDatasetExports([
    { decisions: [{ decisionType: 'scene-order' }, { decisionType: 'bgm-volume' }] },
    { decisions: [{ decisionType: 'scene-order' }] }
  ]);
  assert.deepEqual(result.summary, {
    exports: 2,
    totalDecisions: 3,
    decisionTypes: { 'scene-order': 2, 'bgm-volume': 1 }
  });
});

test('ignores invalid export entries', () => {
  const result = aggregateDatasetExports([null, {}, { decisions: [] }]);
  assert.equal(result.summary.exports, 1);
  assert.equal(result.summary.totalDecisions, 0);
});

test('inspects v0.30 export shape', () => {
  assert.deepEqual(inspectDatasetExport({ exportVersion: '0.30', project: {}, decisions: [] }), { valid: true, errors: [] });
  assert.equal(inspectDatasetExport({ exportVersion: '0.29', project: {}, decisions: [] }).valid, false);
});
