import test from 'node:test';
import assert from 'node:assert/strict';
import { auditDecisionRecord, auditDecisionRecords, auditDatasetExports } from '../datasetQualityAudit.js';

const good = {
  id: 'd1',
  decisionType: 'scene-order',
  projectId: 'p1',
  sceneId: 's1',
  humanAction: { type: 'move-scene' },
  finalDecision: { order: 1 },
  source: { type: 'human' },
  timestamp: '2026-09-07T00:00:00.000Z'
};

test('accepts a normal DecisionRecord', () => {
  assert.deepEqual(auditDecisionRecord(good), { status: 'valid', invalidReasons: [], warningReasons: [] });
});

test('detects invalid fields, blocked URLs and duplicates without mutating input', () => {
  const decisions = [good, { ...good, finalDecision: { url: 'data:image/png;base64,x' } }, { decisionType: '', timestamp: 'bad' }];
  const before = structuredClone(decisions);
  const result = auditDecisionRecords(decisions);
  assert.equal(result.summary.total, 3);
  assert.equal(result.summary.invalid, 3);
  assert.equal(result.summary.reasonCounts['duplicate-id'], 2);
  assert.equal(result.summary.reasonCounts['blocked-url-present'], 1);
  assert.equal(result.summary.reasonCounts['missing-id'], 1);
  assert.deepEqual(decisions, before);
});

test('aggregates records from multiple Dataset exports', () => {
  const result = auditDatasetExports([{ decisions: [good] }, { decisions: [{ ...good, id: 'd2' }] }, null]);
  assert.equal(result.summary.total, 2);
  assert.equal(result.summary.valid, 2);
});
