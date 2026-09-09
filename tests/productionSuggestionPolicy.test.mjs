import test from 'node:test';
import assert from 'node:assert/strict';
import { productionSuggestionReadiness } from '../productionSuggestionPolicy.js';

test('keeps suggestions gated with little real-production evidence', () => {
  assert.equal(productionSuggestionReadiness({decisionCount:2,projectCount:1,accuracy:0.9}).ready, false);
});

test('allows suggestions only after cross-project evidence and accuracy threshold', () => {
  assert.equal(productionSuggestionReadiness({decisionCount:8,projectCount:4,accuracy:0.7}).ready, true);
});
