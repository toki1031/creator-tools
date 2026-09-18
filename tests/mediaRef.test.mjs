import test from 'node:test';
import assert from 'node:assert/strict';
import { createMediaRef, isMediaRef, isEmbeddedDataUrl, readMediaDual } from '../mediaRef.js';

test('creates the minimal MediaRef without changing project schema', () => {
  assert.deepEqual(createMediaRef({ id: 'media-1', kind: 'image', mimeType: 'image/jpeg', sizeBytes: 123.9 }), {
    id: 'media-1', kind: 'image', mimeType: 'image/jpeg', sizeBytes: 123
  });
  assert.equal(createMediaRef({ id: '' }), null);
});

test('validates refs and legacy Data URLs', () => {
  assert.equal(isMediaRef({ id: 'm1', kind: 'audio', mimeType: 'audio/mpeg', sizeBytes: 10 }), true);
  assert.equal(isMediaRef({ id: 'm1', kind: 'unknown', sizeBytes: 10 }), false);
  assert.equal(isEmbeddedDataUrl('data:image/png;base64,AA=='), true);
  assert.equal(isEmbeddedDataUrl('https://example.org/a.png'), false);
});

test('prefers legacy embedded data so existing projects remain readable', async () => {
  let resolverCalls = 0;
  const result = await readMediaDual({
    embeddedData: 'data:image/jpeg;base64,OLD',
    mediaRef: { id: 'm1', kind: 'image', mimeType: 'image/jpeg', sizeBytes: 3 },
    resolveMedia: async () => { resolverCalls += 1; return 'data:image/jpeg;base64,NEW'; }
  });
  assert.equal(result.status, 'resolved');
  assert.equal(result.source, 'embedded');
  assert.equal(result.data, 'data:image/jpeg;base64,OLD');
  assert.equal(resolverCalls, 0);
});

test('reads a MediaRef through an injected resolver', async () => {
  const ref = { id: 'm1', kind: 'image', mimeType: 'image/jpeg', sizeBytes: 3 };
  const result = await readMediaDual({ mediaRef: ref, resolveMedia: async input => {
    assert.deepEqual(input, ref);
    return { data: 'data:image/jpeg;base64,NEW' };
  } });
  assert.equal(result.status, 'resolved');
  assert.equal(result.source, 'media-ref');
  assert.equal(result.data, 'data:image/jpeg;base64,NEW');
});

test('missing resolver or failed resolution never deletes or invents legacy data', async () => {
  const ref = { id: 'm1', kind: 'image', mimeType: 'image/jpeg', sizeBytes: 3 };
  const missing = await readMediaDual({ mediaRef: ref });
  assert.equal(missing.status, 'missing');
  assert.equal(missing.data, '');

  const failed = await readMediaDual({ mediaRef: ref, resolveMedia: async () => { throw new Error('store unavailable'); } });
  assert.equal(failed.status, 'error');
  assert.equal(failed.data, '');
  assert.match(failed.reason, /store unavailable/);
});
