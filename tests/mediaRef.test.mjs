import test from 'node:test';
import assert from 'node:assert/strict';
import { createMediaRef, isMediaRef, normalizeMediaRef, chooseMediaSource, mediaRefMatchesKind } from '../mediaRef.js';

test('creates a minimal MediaRef', () => {
  const ref = createMediaRef({ id:'media-1', kind:'image', mimeType:'image/png', bytes:1234, fileName:'a.png' });
  assert.deepEqual(ref, { version:1, id:'media-1', kind:'image', mimeType:'image/png', bytes:1234, fileName:'a.png' });
  assert.equal(isMediaRef(ref), true);
});

test('rejects invalid refs safely', () => {
  assert.equal(normalizeMediaRef(null), null);
  assert.equal(normalizeMediaRef({ version:1, id:'', kind:'image' }), null);
  assert.equal(normalizeMediaRef({ version:1, id:'x', kind:'unknown' }), null);
});

test('dual-read choice prefers a valid ref over legacy embedded data', () => {
  const result = chooseMediaSource({
    mediaRef:{ version:1, id:'media-a', kind:'scene-narration', mimeType:'audio/wav', bytes:10, fileName:'n.wav' },
    legacyData:'data:audio/wav;base64,AAAA'
  });
  assert.equal(result.source, 'ref');
  assert.equal(result.ref.id, 'media-a');
  assert.equal(result.legacyData, '');
});

test('dual-read choice falls back to legacy data when no valid ref exists', () => {
  const result = chooseMediaSource({ mediaRef:null, legacyData:'data:image/png;base64,AAAA' });
  assert.equal(result.source, 'legacy');
  assert.equal(result.ref, null);
  assert.equal(result.legacyData, 'data:image/png;base64,AAAA');
});

test('kind matching prevents accidental cross-media reuse', () => {
  const ref = createMediaRef({ id:'media-b', kind:'bgm' });
  assert.equal(mediaRefMatchesKind(ref, 'bgm'), true);
  assert.equal(mediaRefMatchesKind(ref, 'image'), false);
});
