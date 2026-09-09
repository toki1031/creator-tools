import test from 'node:test';
import assert from 'node:assert/strict';
import { recommendBgmTracks } from '../bgmRecommendation.js';
test('BGM recommendation is deterministic', () => { const tracks=[{id:'a',audioData:'x'},{id:'b',audioData:'y'}]; assert.deepEqual(recommendBgmTracks(tracks,{}), recommendBgmTracks(tracks,{})); });
