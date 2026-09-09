import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeProductionTimingEntry } from '../productionTimingPolicy.js';

test('drops unrelated payload from timing entries', () => {
  const safe = sanitizeProductionTimingEntry({stage:'scenes',durationMs:1234,script:'secret',audioData:'huge'});
  assert.deepEqual(Object.keys(safe), ['stage','startedAt','finishedAt','durationMs']);
});
