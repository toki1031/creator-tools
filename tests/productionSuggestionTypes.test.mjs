import test from 'node:test';
import assert from 'node:assert/strict';
import { isSupportedProductionSuggestionType } from '../productionSuggestionTypes.js';

test('supports planned v1.1 advisory suggestion families only', () => {
  assert.equal(isSupportedProductionSuggestionType('scene-structure'), true);
  assert.equal(isSupportedProductionSuggestionType('bgm-selection'), true);
  assert.equal(isSupportedProductionSuggestionType('auto-publish'), false);
});
