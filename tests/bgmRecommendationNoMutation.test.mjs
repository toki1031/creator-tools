import test from 'node:test';
import assert from 'node:assert/strict';
import { recommendBgmTracks } from '../bgmRecommendation.js';
test('BGM recommendation leaves library entries unchanged', () => { const tracks=[{id:'a',title:'A',audioData:'x'}]; const before=JSON.stringify(tracks); recommendBgmTracks(tracks,{}); assert.equal(JSON.stringify(tracks),before); });
