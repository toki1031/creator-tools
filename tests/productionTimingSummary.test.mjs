import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeProductionTiming } from '../productionTimingSummary.js';

test('ranks stages by accumulated production time', () => {
  const result = summarizeProductionTiming([{stage:'scenes',durationMs:1000},{stage:'scenes',durationMs:2000},{stage:'output',durationMs:500}]);
  assert.equal(result[0].stage, 'scenes');
  assert.equal(result[0].averageMs, 1500);
});
