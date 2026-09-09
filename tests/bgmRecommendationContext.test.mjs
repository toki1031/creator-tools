import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBgmRecommendationContext } from '../bgmRecommendationContext.js';

test('uses total scene duration for BGM recommendation', () => {
  const context = buildBgmRecommendationContext({genre:'great-person',platform:'youtube-shorts',scenes:[{durationSec:4.2},{durationSec:5.8}]});
  assert.equal(context.durationSec, 10);
  assert.equal(context.genre, 'great-person');
});
