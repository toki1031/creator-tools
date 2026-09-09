import test from 'node:test';
import assert from 'node:assert/strict';
import { explainBgmRecommendation } from '../bgmRecommendationExplain.js';

test('explains that recommendation uses video duration when available', () => {
  assert.match(explainBgmRecommendation({score:2},{durationSec:58}), /58秒/);
});
