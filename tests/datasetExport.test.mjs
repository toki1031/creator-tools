import test from 'node:test';
import assert from 'node:assert/strict';
import { createDatasetExportPayload, sanitizeDatasetValue, summarizeDecisionTypes } from '../datasetExport.js';

test('creates a compact dataset export without mutating the project', () => {
  const project = {
    id: 'p1', title: 'Test', platform: 'youtube-shorts', genre: 'great-person', aspectRatio: '9:16', targetDurationSec: 60,
    mediaLibrary: [{ imageData: 'data:image/png;base64,xxx' }],
    learning: { decisions: [
      { decisionType: 'scene-image-selection', finalDecision: { assetId: 'a1' }, imageData: 'data:image/png;base64,bad' },
      { decisionType: 'publish-metadata-approval', finalDecision: { title: '公開タイトル', description: '本文' } }
    ] }
  };
  const before = structuredClone(project);
  const payload = createDatasetExportPayload(project, '2026-09-07T00:00:00.000Z');
  assert.equal(payload.exportVersion, '0.30');
  assert.equal(payload.summary.totalDecisions, 2);
  assert.deepEqual(payload.summary.decisionTypes, { 'scene-image-selection': 1, 'publish-metadata-approval': 1 });
  assert.equal(payload.project.id, 'p1');
  assert.equal('mediaLibrary' in payload, false);
  assert.equal(JSON.stringify(payload).includes('data:image'), false);
  assert.deepEqual(project, before);
});

test('recursive sanitizer removes binary data fields and data/blob URL values', () => {
  const value = {
    imageData: 'data:image/png;base64,a',
    nested: {
      keep: 'plain text',
      videoData: 'blob:https://example.test/1',
      values: ['ok', 'data:audio/wav;base64,b', { audioData: 'data:audio/wav;base64,c', source: 'blob:https://example.test/2', id: 'x' }]
    }
  };
  assert.deepEqual(sanitizeDatasetValue(value), { nested: { keep: 'plain text', values: ['ok', { id: 'x' }] } });
});

test('summary handles missing and unknown decision types', () => {
  assert.deepEqual(summarizeDecisionTypes([{ decisionType: 'a' }, { decisionType: 'a' }, {}]), { a: 2, unknown: 1 });
  const payload = createDatasetExportPayload({}, '2026-09-07T00:00:00.000Z');
  assert.equal(payload.summary.totalDecisions, 0);
  assert.deepEqual(payload.decisions, []);
  assert.equal(payload.project.targetDurationSec, null);
});
