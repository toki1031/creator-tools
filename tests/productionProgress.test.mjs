import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeProductionProgress, productionProgressText } from '../productionProgress.js';

test('summarizes completed and pending production steps', () => {
  const summary = summarizeProductionProgress({ canExport: false, steps: [
    { id: 'scenes', status: 'kept' },
    { id: 'autofill', status: 'prepared' },
    { id: 'images', status: 'needs-input', message: '画像未設定 2 Scene' },
    { id: 'narration', status: 'needs-generation' }
  ] });
  assert.equal(summary.total, 4);
  assert.equal(summary.completed, 2);
  assert.equal(summary.percent, 50);
  assert.equal(summary.pendingCount, 2);
  assert.match(productionProgressText(summary), /残り 2工程/);
});

test('marks export ready only when no actionable work remains', () => {
  const summary = summarizeProductionProgress({ canExport: true, steps: [{ id: 'preflight', status: 'ready' }] });
  assert.equal(summary.exportReady, true);
  assert.equal(summary.percent, 100);
  assert.match(productionProgressText(summary), /MP4出力/);
});
