import test from 'node:test';
import assert from 'node:assert/strict';
import { createProductionSuggestion } from '../productionSuggestion.js';

test('all supported production suggestions are advisory only', () => {
  const suggestion = createProductionSuggestion('scene-motion', {motion:'zoom-in'}, {decisionCount:8,projectCount:4,accuracy:0.7});
  assert.equal(suggestion.advisoryOnly, true);
  assert.equal(suggestion.payload.motion, 'zoom-in');
  assert.equal(createProductionSuggestion('auto-publish', {}), null);
});
