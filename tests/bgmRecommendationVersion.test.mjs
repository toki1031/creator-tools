import test from 'node:test';
import assert from 'node:assert/strict';
import { BGM_RECOMMENDATION_VERSION } from '../bgmRecommendationVersion.js';
test('BGM recommendation contract starts at version 1', () => assert.equal(BGM_RECOMMENDATION_VERSION, 1));
