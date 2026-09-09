import test from 'node:test';
import assert from 'node:assert/strict';
import { bgmRecommendationReadiness } from '../bgmRecommendationReadiness.js';

test('waits until at least two licensed local tracks exist', () => {
  const one = [{audioData:'x',license:'CC0',sourceUrl:'https://example.test',commercialUseAllowed:true}];
  assert.equal(bgmRecommendationReadiness(one).ready, false);
  assert.equal(bgmRecommendationReadiness([...one,{audioData:'y',license:'CC0',sourceUrl:'https://example.test/2',commercialUseAllowed:true}]).ready, true);
});
