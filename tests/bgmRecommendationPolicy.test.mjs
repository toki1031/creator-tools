import test from 'node:test';
import assert from 'node:assert/strict';
import { canRecommendBgmTrack } from '../bgmRecommendationPolicy.js';

test('requires local audio plus license and source metadata', () => {
  assert.equal(canRecommendBgmTrack({audioData:'x',license:'CC0',sourceUrl:'https://example.test',commercialUseAllowed:true}), true);
  assert.equal(canRecommendBgmTrack({audioData:'x'}), false);
  assert.equal(canRecommendBgmTrack({audioData:'x',license:'x',sourceUrl:'https://example.test',commercialUseAllowed:false}), false);
});
