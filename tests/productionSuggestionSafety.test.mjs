import test from 'node:test';
import assert from 'node:assert/strict';
import { hasUnsafeProductionSuggestionPayload } from '../productionSuggestionSafety.js';

test('detects raw media bodies in suggestion payloads', () => {
  assert.equal(hasUnsafeProductionSuggestionPayload({motion:'zoom-in'}), false);
  assert.equal(hasUnsafeProductionSuggestionPayload({candidate:{imageData:'huge'}}), true);
  assert.equal(hasUnsafeProductionSuggestionPayload({audioData:'huge'}), true);
});
