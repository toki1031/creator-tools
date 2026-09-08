import test from 'node:test';
import assert from 'node:assert/strict';
import { canReuseSceneNarration, createNarrationFingerprint, normalizeNarrationText, sceneNarrationStatus } from '../narrationResume.js';

test('normalizeNarrationText keeps meaningful line breaks but normalizes whitespace', () => {
  assert.equal(normalizeNarrationText('  北斎  \r\n  90歳  '), '北斎\n90歳');
});

test('matching audio, voice and text can be reused', () => {
  const text = '90歳になれば、もっと奥義に近づく。';
  const voiceId = 'jf_alpha';
  const scene = {
    narration: {
      audioData: 'data:audio/wav;base64,abc',
      durationSec: 2.4,
      fingerprint: createNarrationFingerprint({ text, voiceId })
    }
  };
  assert.equal(canReuseSceneNarration(scene, { text, voiceId }), true);
  assert.equal(sceneNarrationStatus(scene, { text, voiceId }), 'reusable');
});

test('voice or text changes mark saved audio stale', () => {
  const scene = {
    narration: {
      audioData: 'data:audio/wav;base64,abc',
      durationSec: 2.4,
      fingerprint: createNarrationFingerprint({ text: '元の文章', voiceId: 'jf_alpha' })
    }
  };
  assert.equal(sceneNarrationStatus(scene, { text: '変更後', voiceId: 'jf_alpha' }), 'stale');
  assert.equal(sceneNarrationStatus(scene, { text: '元の文章', voiceId: 'jm_kumo' }), 'stale');
});

test('legacy audio without fingerprint is treated as stale instead of silently reused', () => {
  const scene = { narration: { audioData: 'data:audio/wav;base64,abc', durationSec: 2.4 } };
  assert.equal(sceneNarrationStatus(scene, { text: '文章', voiceId: 'jf_alpha' }), 'stale');
});
